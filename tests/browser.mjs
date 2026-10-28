import assert from "node:assert/strict";
import { access, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { chromium } from "@playwright/test";

const TARGET_URL = process.env.TARGET_URL || "http://127.0.0.1:4173";
const EXPECTED_COMMIT = process.env.EXPECTED_COMMIT?.trim();
const DEFAULT_CHROMIUM_PATH = "/home/capostol/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome";
const CHROMIUM_PATH = process.env.CHROMIUM_PATH || DEFAULT_CHROMIUM_PATH;
const LIBRARY_PATHS = [
  "/srv/projects/dentalflow-presentation/artifacts/browser-libs/root/usr/lib/x86_64-linux-gnu",
  "/srv/projects/wildora/.tools/browser/root/usr/lib/x86_64-linux-gnu",
  "/srv/projects/wildora/.tools/audio/root/usr/lib/x86_64-linux-gnu",
];
const ARTIFACTS_DIR = path.resolve("artifacts");

const browserFailures = [];
const checks = [];

function recordCheck(name, details = {}) {
  checks.push({ name, status: "passed", ...details });
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
      browserFailures.push({
        type: "http",
        label,
        url: response.url(),
        message: `HTTP ${response.status()}`,
      });
    }
  });
}

async function openSite(page) {
  const response = await page.goto(TARGET_URL, { waitUntil: "networkidle" });
  assert(response, `No navigation response for ${TARGET_URL}`);
  assert(response.ok(), `Navigation failed with HTTP ${response.status()} at ${TARGET_URL}`);
  await page.evaluate(() => document.fonts.ready);
  assert.match(await page.title(), /^Smart Terapy\b/, "The page title must start with Smart Terapy");
}

async function assertNoHorizontalOverflow(page, label) {
  const metrics = await page.evaluate(() => ({
    viewportWidth: document.documentElement.clientWidth,
    documentWidth: document.documentElement.scrollWidth,
    bodyWidth: document.body.scrollWidth,
  }));
  assert(
    metrics.documentWidth <= metrics.viewportWidth + 1 && metrics.bodyWidth <= metrics.viewportWidth + 1,
    `${label} has horizontal overflow: ${JSON.stringify(metrics)}`,
  );
  recordCheck(`${label} has no horizontal overflow`, metrics);
}

function moneyNumber(text) {
  const digits = text.replace(/\D/g, "");
  return digits ? Number(digits) : Number.NaN;
}

async function assertEstimate(page, { type, participants, sessions, total }) {
  await page.selectOption("#atelier-type", type);
  await page.fill("#participants", String(participants));
  await page.selectOption("#sessions", String(sessions));
  await page.waitForFunction(
    ({ expectedTotal }) => {
      const output = document.querySelector("#estimate-total")?.textContent || "";
      return Number(output.replace(/\D/g, "")) === expectedTotal;
    },
    { expectedTotal: total },
  );

  const renderedTotal = (await page.locator("#estimate-total").textContent()) || "";
  assert.equal(moneyNumber(renderedTotal), total, `Unexpected estimate for ${type}`);
  assert.equal((await page.locator("#estimate-error").textContent())?.trim(), "");
  assert.equal(await page.locator("#copy-request").isDisabled(), false);
  assert.notEqual(await page.locator("#request-message").inputValue(), "");
  recordCheck(`estimate ${type}/${participants}/${sessions}`, { total, renderedTotal });
}

async function assertSavedValues(page) {
  assert.equal(await page.locator("#atelier-type").inputValue(), "creativ");
  assert.equal(await page.locator("#participants").inputValue(), "12");
  assert.equal(await page.locator("#sessions").inputValue(), "4");
  assert.equal(moneyNumber((await page.locator("#estimate-total").textContent()) || ""), 2376);
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
  attachDiagnostics(page, "desktop-mobile-primary");

  await openSite(page);
  await assertNoHorizontalOverflow(page, "desktop 1440px");
  await page.screenshot({ path: path.join(ARTIFACTS_DIR, "desktop.png"), fullPage: true });
  recordCheck("desktop screenshot", { path: "artifacts/desktop.png" });

  for (const width of [360, 390, 768, 1024, 1440, 1920]) {
    await page.setViewportSize({ width, height: width <= 390 ? 844 : 1000 });
    await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    await assertNoHorizontalOverflow(page, `responsive ${width}px`);
  }

  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload({ waitUntil: "networkidle" });
  await page.evaluate(() => document.fonts.ready);
  await assertNoHorizontalOverflow(page, "mobile 390px");

  const menuToggle = page.locator("#menu-toggle");
  const navigation = page.locator("#site-nav");
  assert.equal(await menuToggle.getAttribute("aria-expanded"), "false");
  assert.equal(await navigation.isVisible(), false, "Mobile navigation should begin closed");
  await menuToggle.click();
  assert.equal(await menuToggle.getAttribute("aria-expanded"), "true");
  assert.equal(await navigation.isVisible(), true, "Mobile navigation should open from its toggle");
  await menuToggle.click();
  assert.equal(await navigation.isVisible(), false, "Mobile navigation should close from its toggle");
  recordCheck("mobile menu toggle");

  const atelierOptions = await page.locator("#atelier-type option").evaluateAll((options) => options.map((option) => option.value));
  const sessionOptions = await page.locator("#sessions option").evaluateAll((options) => options.map((option) => option.value));
  assert.deepEqual(atelierOptions, ["creativ", "senzorial", "scoala", "parinte"]);
  assert.deepEqual(sessionOptions, ["1", "4"]);
  recordCheck("calculator option contract", { atelierOptions, sessionOptions });

  await assertEstimate(page, { type: "creativ", participants: 12, sessions: 1, total: 660 });
  await assertEstimate(page, { type: "creativ", participants: 12, sessions: 4, total: 2376 });
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.locator("#copy-request").click();
  await page.waitForFunction(() => document.querySelector("#copy-status").textContent.includes("Mesaj copiat"));
  assert.equal(await page.evaluate(() => navigator.clipboard.readText()), await page.locator("#request-message").inputValue());
  recordCheck("request text copies correctly to clipboard");

  await page.reload({ waitUntil: "networkidle" });
  await assertSavedValues(page);
  recordCheck("calculator values persist after reload");

  await page.close();
  const reopenedPage = await context.newPage();
  attachDiagnostics(reopenedPage, "reopened-page");
  await openSite(reopenedPage);
  await assertSavedValues(reopenedPage);
  recordCheck("calculator values persist after reopen");

  await assertEstimate(reopenedPage, { type: "scoala", participants: 15, sessions: 1, total: 675 });

  await reopenedPage.fill("#participants", "0");
  await reopenedPage.waitForFunction(() => Boolean(document.querySelector("#estimate-error")?.textContent?.trim()));
  assert.notEqual((await reopenedPage.locator("#estimate-error").textContent())?.trim(), "");
  assert.doesNotMatch((await reopenedPage.locator("#estimate-total").textContent()) || "", /lei|RON/i);
  assert.equal(await reopenedPage.locator("#request-message").inputValue(), "");
  assert.equal(await reopenedPage.locator("#copy-request").isDisabled(), true);
  recordCheck("invalid participant counts suppress quote copy");

  await reopenedPage.setViewportSize({ width: 390, height: 844 });
  await assertEstimate(reopenedPage, { type: "creativ", participants: 12, sessions: 4, total: 2376 });
  await assertNoHorizontalOverflow(reopenedPage, "mobile screenshot 390px");
  await reopenedPage.screenshot({ path: path.join(ARTIFACTS_DIR, "mobile.png"), fullPage: true });
  recordCheck("mobile screenshot", { path: "artifacts/mobile.png" });

  if (EXPECTED_COMMIT) {
    const rootUrl = TARGET_URL.endsWith("/") ? TARGET_URL : `${TARGET_URL}/`;
    const buildInfoUrl = new URL("build-info.json", rootUrl).href;
    const buildInfoResponse = await context.request.get(buildInfoUrl);
    assert(buildInfoResponse.ok(), `Could not read ${buildInfoUrl}: HTTP ${buildInfoResponse.status()}`);
    const buildInfo = await buildInfoResponse.json();
    assert.equal(buildInfo.commit, EXPECTED_COMMIT, "Live build commit does not match EXPECTED_COMMIT");
    recordCheck("deployed commit", { commit: buildInfo.commit });
  }

  assert.deepEqual(browserFailures, [], `Browser errors or missing assets: ${JSON.stringify(browserFailures, null, 2)}`);

  await writeFile(
    path.join(ARTIFACTS_DIR, "browser-evidence.json"),
    `${JSON.stringify({ target: TARGET_URL, expectedCommit: EXPECTED_COMMIT || null, checks, browserFailures }, null, 2)}\n`,
  );
  console.log(`Browser verification passed (${checks.length} checks) at ${TARGET_URL}`);
} finally {
  await browser.close();
}
