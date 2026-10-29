import assert from "node:assert/strict";
import { access, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { chromium } from "@playwright/test";

import { therapies } from "../content/therapies.mjs";
import { SITE_URL } from "../scripts/render-site.mjs";

const TARGET_URL = process.env.TARGET_URL || "http://127.0.0.1:4174/";
const EXPECTED_COMMIT = process.env.EXPECTED_COMMIT?.trim();
const CHROMIUM_PATH =
  process.env.CHROMIUM_PATH || "/home/capostol/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome";
const LIBRARY_PATHS = [
  "/srv/projects/dentalflow-presentation/artifacts/browser-libs/root/usr/lib/x86_64-linux-gnu",
  "/srv/projects/wildora/.tools/browser/root/usr/lib/x86_64-linux-gnu",
  "/srv/projects/wildora/.tools/audio/root/usr/lib/x86_64-linux-gnu",
];
const ARTIFACTS_DIR = path.resolve("artifacts");
const ROOT_URL = new URL(TARGET_URL.endsWith("/") ? TARGET_URL : `${TARGET_URL}/`);
const checks = [];
const browserFailures = [];

function recordCheck(name, details = {}) {
  checks.push({ name, status: "passed", ...details });
}

function therapyUrl(slug) {
  return new URL(`terapii/${slug}/`, ROOT_URL).href;
}

function normalizeText(value) {
  return value.replace(/\s+/g, " ").trim();
}

async function rejectConsentIfVisible(page) {
  const dialog = page.locator("#cookie-dialog");
  if ((await dialog.count()) && (await dialog.isVisible())) {
    await page.locator("#cookie-reject").click();
    assert.equal(await dialog.isVisible(), false, "Rejecting optional storage must close the consent dialog");
    recordCheck("initial consent prompt rejected for pages verification");
  }
}

function attachDiagnostics(page, label) {
  page.on("console", (message) => {
    if (message.type() === "error") {
      browserFailures.push({ type: "console", label, message: message.text() });
    }
  });
  page.on("pageerror", (error) => {
    browserFailures.push({ type: "pageerror", label, message: error.message });
  });
  page.on("requestfailed", (request) => {
    browserFailures.push({
      type: "requestfailed",
      label,
      url: request.url(),
      message: request.failure()?.errorText || "request failed",
    });
  });
  page.on("response", (response) => {
    if (response.status() >= 400) {
      browserFailures.push({ type: "http", label, url: response.url(), message: `HTTP ${response.status()}` });
    }
  });
}

async function gotoOk(page, url) {
  const response = await page.goto(url, { waitUntil: "networkidle" });
  assert(response, `No navigation response for ${url}`);
  assert(response.ok(), `${url} returned HTTP ${response.status()}`);
  await page.evaluate(() => document.fonts.ready);
  await rejectConsentIfVisible(page);
}

async function assertNoHorizontalOverflow(page, label) {
  const metrics = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    document: document.documentElement.scrollWidth,
    body: document.body.scrollWidth,
  }));
  assert(
    metrics.document <= metrics.viewport + 1 && metrics.body <= metrics.viewport + 1,
    `${label} has horizontal overflow: ${JSON.stringify(metrics)}`,
  );
  const clippedText = await page.locator("main h1, main h2, main p, .therapy-page-nav a").evaluateAll(elements =>
    elements.filter(element => element.clientWidth > 0 && element.scrollWidth > element.clientWidth + 1)
      .map(element => element.textContent.trim()),
  );
  assert.deepEqual(clippedText, [], `${label} has clipped text: ${JSON.stringify(clippedText)}`);
}

async function assertLocalAssets(page, slug) {
  const urls = await page.locator('link[rel="stylesheet"][href], link[rel="icon"][href], script[src], img[src]').evaluateAll(
    (elements) => [...new Set(elements.map((element) => new URL(element.href || element.src, location.href).href))],
  );
  assert(urls.length >= 4, `${slug} should load its shared local assets`);
  for (const url of urls) {
    assert.equal(new URL(url).origin, ROOT_URL.origin, `${slug} references a non-local asset: ${url}`);
  }
}

async function assertTherapyPage(page, therapy) {
  const expectedUrl = therapyUrl(therapy.slug);
  await gotoOk(page, expectedUrl);
  assert.equal(page.url(), expectedUrl);
  assert.equal(normalizeText(await page.title()), `${therapy.title} — Smart Therapy Educational`);
  assert.equal(normalizeText((await page.locator("h1[data-therapy-title]").textContent()) || ""), therapy.title);
  assert.equal(await page.locator('link[rel="canonical"]').getAttribute("href"), new URL(`terapii/${therapy.slug}/`, SITE_URL).href);
  assert.equal(await page.locator(".therapy-page-nav a").count(), 10);
  assert.equal(await page.locator('.therapy-page-nav a[aria-current="page"]').count(), 1);
  assert.equal(
    normalizeText((await page.locator('.therapy-page-nav a[aria-current="page"]').textContent()) || "").replace(/●$/, "").trim(),
    therapy.title,
  );
  assert.equal(await page.locator(".breadcrumbs a").first().getAttribute("href"), "../../");
  assert.equal(await page.locator(".therapy-overview-link").getAttribute("href"), "../../#terapii");
  await assertLocalAssets(page, therapy.slug);
}

await access(CHROMIUM_PATH);
await mkdir(ARTIFACTS_DIR, { recursive: true });

const inheritedLibraryPath = process.env.LD_LIBRARY_PATH ? [process.env.LD_LIBRARY_PATH] : [];
const browser = await chromium.launch({
  executablePath: CHROMIUM_PATH,
  headless: true,
  args: ["--no-sandbox"],
  env: {
    ...process.env,
    LD_LIBRARY_PATH: [...LIBRARY_PATHS, ...inheritedLibraryPath].join(":"),
  },
});

try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();
  attachDiagnostics(page, "therapy-pages");

  await gotoOk(page, ROOT_URL.href);
  const therapyMenu = page.locator("details#therapy-menu");
  const therapyMenuToggle = page.locator("summary#therapy-menu-toggle");
  assert.equal(await therapyMenu.getAttribute("open"), null);
  await therapyMenuToggle.click();
  assert.equal(await therapyMenu.getAttribute("open"), "");

  const menuLinks = page.locator("#therapy-submenu li a");
  assert.equal(await menuLinks.count(), 9);
  const menuPaths = await menuLinks.evaluateAll((links) => links.map((link) => new URL(link.href).pathname));
  assert.deepEqual(
    menuPaths.map((pathname) => pathname.slice(ROOT_URL.pathname.length)),
    therapies.map(({ slug }) => `terapii/${slug}/`),
  );
  assert.equal(await page.locator('#therapy-submenu a[href$="#terapii"]').count(), 1);
  recordCheck("desktop therapy menu exposes the overview and nine canonical routes");

  await page.locator("#remember-estimate").check();
  await page.selectOption("#atelier-type", "creativ");
  await page.fill("#participants", "13");
  await page.selectOption("#sessions", "4");
  if (!(await therapyMenu.evaluate(element => element.open))) await therapyMenuToggle.click();
  await menuLinks.filter({ hasText: "Logopedia" }).click();
  assert.equal(page.url(), therapyUrl("logopedie"));
  assert.equal(normalizeText((await page.locator("h1[data-therapy-title]").textContent()) || ""), "Logopedia");
  await page.goBack({ waitUntil: "networkidle" });
  assert.equal(await page.locator("#atelier-type").inputValue(), "creativ");
  assert.equal(await page.locator("#participants").inputValue(), "13");
  assert.equal(await page.locator("#sessions").inputValue(), "4");
  recordCheck("browser back preserves the homepage calculator selection");

  for (const viewport of [
    { width: 1440, height: 1000, label: "desktop" },
    { width: 390, height: 844, label: "mobile" },
  ]) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    for (const therapy of therapies) {
      await assertTherapyPage(page, therapy);
      await assertNoHorizontalOverflow(page, `${viewport.label} ${therapy.slug}`);
      await page.reload({ waitUntil: "networkidle" });
      assert.equal(normalizeText((await page.locator("h1[data-therapy-title]").textContent()) || ""), therapy.title);
    }
    recordCheck(`${viewport.label} deep links reload for all nine therapy pages`);
  }

  const longestTherapy = therapies.reduce((longest, item) =>
    item.title.length > longest.title.length ? item : longest,
  );
  await page.setViewportSize({ width: 1440, height: 1000 });
  await assertTherapyPage(page, longestTherapy);
  await page.screenshot({ path: path.join(ARTIFACTS_DIR, "pages-desktop.png"), fullPage: true });
  await page.setViewportSize({ width: 360, height: 800 });
  await page.reload({ waitUntil: "networkidle" });
  await assertNoHorizontalOverflow(page, `mobile 360px ${longestTherapy.slug}`);
  await page.screenshot({ path: path.join(ARTIFACTS_DIR, "pages-mobile.png"), fullPage: true });
  recordCheck("longest therapy page fits desktop and 360px mobile viewports", { slug: longestTherapy.slug });

  await page.setViewportSize({ width: 390, height: 844 });
  await gotoOk(page, ROOT_URL.href);
  const mobileToggle = page.locator("#menu-toggle");
  const mobileNav = page.locator("#site-nav");
  await mobileToggle.click();
  assert.equal(await mobileToggle.getAttribute("aria-expanded"), "true");
  assert.equal(await mobileNav.isVisible(), true);
  await page.locator("#therapy-menu-toggle").click();
  assert.equal(await page.locator("#therapy-menu").getAttribute("open"), "");
  assert.equal(await page.locator("#therapy-submenu li a").count(), 9);
  const submenuOverflow = await page.locator("#therapy-submenu").evaluate((submenu) => ({
    overflowY: getComputedStyle(submenu).overflowY,
    clientHeight: submenu.clientHeight,
    scrollHeight: submenu.scrollHeight,
  }));
  assert.match(submenuOverflow.overflowY, /auto|scroll/);
  const lastMobileLink = page.locator("#therapy-submenu li a").last();
  await lastMobileLink.scrollIntoViewIfNeeded();
  assert.equal(await lastMobileLink.isVisible(), true);
  await page.screenshot({ path: path.join(ARTIFACTS_DIR, "menu-mobile.png"), fullPage: true });

  await page.keyboard.press("Escape");
  assert.equal(await page.locator("#therapy-menu").getAttribute("open"), null);
  assert.equal(await mobileToggle.getAttribute("aria-expanded"), "true");
  assert.equal(await mobileNav.isVisible(), true);
  await page.keyboard.press("Escape");
  assert.equal(await mobileToggle.getAttribute("aria-expanded"), "false");
  assert.equal(await mobileNav.isVisible(), false);

  await mobileToggle.click();
  await page.locator("#therapy-menu-toggle").click();
  await page.locator("#therapy-submenu li a").last().scrollIntoViewIfNeeded();
  await page.locator("#therapy-submenu li a").last().click();
  assert.equal(page.url(), therapyUrl(therapies.at(-1).slug));
  assert.equal(
    normalizeText((await page.locator("h1[data-therapy-title]").textContent()) || ""),
    therapies.at(-1).title,
  );
  recordCheck("mobile therapy menu scrolls, follows its last route, and closes in two Escape levels", submenuOverflow);

  await gotoOk(page, ROOT_URL.href);
  await page.locator('.legal-workshop-copy .button').click();
  assert.equal(page.url(), new URL('ateliere/da-mana-cu-dreptul/', ROOT_URL).href);
  assert.match(await page.locator('h1').textContent(), /Dă mâna cu Dreptul/);
  assert((await page.locator('.workshop-topics li').count()) >= 14);
  const workshopText = await page.locator('main').textContent();
  assert.match(workshopText, /60–90/);
  assert.match(workshopText, /7–16/);
  assert.match(workshopText, /cerere/i);
  for (const width of [360, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.reload({ waitUntil: 'networkidle' });
    await assertNoHorizontalOverflow(page, `legal workshop ${width}px`);
    await page.screenshot({ path: path.join(ARTIFACTS_DIR, `workshop-${width}.png`), fullPage: true });
  }
  await page.locator('main a[href="../../#contact"]').first().click();
  await page.waitForURL(`${ROOT_URL.href}#contact`);
  assert.equal(await page.locator('#contact-service option[value="Dă mâna cu Dreptul — educație juridică"]').count(), 1);
  recordCheck('legal workshop page, all themes, responsive layout and contact navigation');

  if (EXPECTED_COMMIT) {
    const buildInfoResponse = await context.request.get(new URL("build-info.json", ROOT_URL).href);
    assert(buildInfoResponse.ok());
    const buildInfo = await buildInfoResponse.json();
    assert.equal(buildInfo.commit, EXPECTED_COMMIT);
    assert.deepEqual(
      buildInfo.therapyPages,
      therapies.map(({ slug }) => `terapii/${slug}/`),
    );
    recordCheck("deployed commit and route manifest", { commit: buildInfo.commit });
  }

  assert.deepEqual(browserFailures, [], `Browser errors or missing assets: ${JSON.stringify(browserFailures, null, 2)}`);
  await writeFile(
    path.join(ARTIFACTS_DIR, "pages-browser-evidence.json"),
    `${JSON.stringify({ target: ROOT_URL.href, expectedCommit: EXPECTED_COMMIT || null, checks, browserFailures }, null, 2)}\n`,
  );
  console.log(`Therapy pages browser verification passed (${checks.length} checks) at ${ROOT_URL.href}`);
} finally {
  await browser.close();
}
