import assert from "node:assert/strict";
import { access, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { chromium } from "@playwright/test";

import { therapies } from "../content/therapies.mjs";

const TARGET_URL = process.env.TARGET_URL || "http://127.0.0.1:4174/";
const EXPECTED_COMMIT = process.env.EXPECTED_COMMIT?.trim();
const ROOT_URL = new URL(TARGET_URL.endsWith("/") ? TARGET_URL : `${TARGET_URL}/`);
const CHROMIUM_PATH =
  process.env.CHROMIUM_PATH || "/home/capostol/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome";
const LIBRARY_PATHS = [
  "/srv/projects/dentalflow-presentation/artifacts/browser-libs/root/usr/lib/x86_64-linux-gnu",
  "/srv/projects/wildora/.tools/browser/root/usr/lib/x86_64-linux-gnu",
  "/srv/projects/wildora/.tools/audio/root/usr/lib/x86_64-linux-gnu",
];
const ARTIFACTS_DIR = path.resolve("artifacts");
const CONSENT_KEY = "smart-terapy:consent:v1";
const ESTIMATE_KEY = "smart-terapy:atelier-estimate:v1";
const REMEMBER_KEY = "smart-terapy:remember-estimate:v1";
const CONSENT_MAX_AGE = 180 * 24 * 60 * 60 * 1000;
const checks = [];
const browserFailures = [];

function recordCheck(name, details = {}) {
  checks.push({ name, status: "passed", ...details });
}

function attachDiagnostics(page, label) {
  page.on("console", message => {
    if (message.type() === "error") browserFailures.push({ type: "console", label, message: message.text() });
  });
  page.on("pageerror", error => browserFailures.push({ type: "pageerror", label, message: error.message }));
  page.on("requestfailed", request => browserFailures.push({
    type: "requestfailed",
    label,
    url: request.url(),
    message: request.failure()?.errorText || "request failed",
  }));
  page.on("response", response => {
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
}

async function storedValue(page, key) {
  return page.evaluate(storageKey => localStorage.getItem(storageKey), key);
}

async function assertNoOptionalStorage(page) {
  assert.equal(await storedValue(page, ESTIMATE_KEY), null);
  assert.equal(await storedValue(page, REMEMBER_KEY), null);
}

async function readConsent(page) {
  const raw = await storedValue(page, CONSENT_KEY);
  return raw ? JSON.parse(raw) : null;
}

async function assertConsent(page, functional) {
  const consent = await readConsent(page);
  assert(consent, "Consent metadata must be stored after an explicit choice");
  assert.deepEqual(Object.keys(consent).sort(), ["functional", "updatedAt", "version"]);
  assert.equal(consent.version, 1);
  assert.equal(consent.functional, functional);
  assert.equal(Number.isFinite(consent.updatedAt), true);
  assert(consent.updatedAt <= Date.now() && Date.now() - consent.updatedAt < 30_000);
  return consent;
}

async function assertDialogLayout(page, width) {
  await page.setViewportSize({ width, height: width <= 390 ? 720 : 900 });
  const layout = await page.locator("#cookie-dialog").evaluate(dialog => {
    const rect = dialog.getBoundingClientRect();
    const outside = [...dialog.querySelectorAll("button, a, label, p, h2, div")]
      .filter(element => element.getClientRects().length)
      .filter(element => {
        const box = element.getBoundingClientRect();
        return box.left < rect.left - 1 || box.right > rect.right + 1;
      })
      .map(element => element.id || element.className || element.tagName);
    return {
      viewportWidth: document.documentElement.clientWidth,
      documentWidth: document.documentElement.scrollWidth,
      left: rect.left,
      right: rect.right,
      width: rect.width,
      scrollWidth: dialog.scrollWidth,
      clientWidth: dialog.clientWidth,
      outside,
    };
  });
  assert(layout.left >= -1 && layout.right <= layout.viewportWidth + 1, `${width}px dialog leaves viewport`);
  assert(layout.documentWidth <= layout.viewportWidth + 1, `${width}px document overflows`);
  assert(layout.scrollWidth <= layout.clientWidth + 1, `${width}px dialog overflows horizontally`);
  assert.deepEqual(layout.outside, [], `${width}px dialog content leaves its panel: ${JSON.stringify(layout.outside)}`);
  recordCheck(`consent dialog layout ${width}px`, layout);
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
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  attachDiagnostics(page, "consent-primary");
  await gotoOk(page, ROOT_URL.href);

  const dialog = page.locator("#cookie-dialog");
  assert.equal(await dialog.isVisible(), true, "First visit must show the consent dialog");
  assert.equal(await page.locator("#cookie-functional").isChecked(), false);
  assert.equal(await storedValue(page, CONSENT_KEY), null);
  await assertNoOptionalStorage(page);
  assert.match((await page.locator("body").innerText()), /Smart Therapy Educational/i);
  assert.doesNotMatch((await page.locator("body").innerText()), /Smart Terapy Educational/i);
  recordCheck("first visit is opt-in with no optional storage");

  for (const width of [320, 390, 1440]) await assertDialogLayout(page, width);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: path.join(ARTIFACTS_DIR, "consent-dialog-390.png"), fullPage: true });

  await page.keyboard.press("Escape");
  assert.equal(await dialog.isVisible(), false, "Escape may close the dialog without making a choice");
  assert.equal(await storedValue(page, CONSENT_KEY), null, "Escape must not record acceptance or rejection");
  await assertNoOptionalStorage(page);
  await page.reload({ waitUntil: "networkidle" });
  assert.equal(await dialog.isVisible(), true, "A dismissed unsaved choice must be requested again");
  recordCheck("Escape closes without consent and the prompt returns");

  await page.locator("#cookie-reject").click();
  assert.equal(await dialog.isVisible(), false);
  await assertConsent(page, false);
  await assertNoOptionalStorage(page);
  await page.reload({ waitUntil: "networkidle" });
  assert.equal(await dialog.isVisible(), false, "A current rejection must prevent repeat prompting");
  const rejectedReopen = await context.newPage();
  attachDiagnostics(rejectedReopen, "consent-rejected-reopen");
  await gotoOk(rejectedReopen, ROOT_URL.href);
  assert.equal(await rejectedReopen.locator("#cookie-dialog").isVisible(), false);
  await rejectedReopen.close();
  recordCheck("rejection persists across refresh and reopen for 180-day metadata");

  const settingsButton = page.locator("[data-open-consent]").last();
  assert((await settingsButton.count()) > 0, "The footer must expose cookie settings");
  await settingsButton.click();
  assert.equal(await dialog.isVisible(), true);
  assert.equal(await page.locator("#cookie-functional").isChecked(), false);
  await page.locator("#cookie-accept").click();
  assert.equal(await dialog.isVisible(), false);
  await assertConsent(page, true);
  assert.equal(await storedValue(page, REMEMBER_KEY), "yes");
  assert.equal(await page.locator("#remember-estimate").isChecked(), true);
  await page.selectOption("#atelier-type", "senzorial");
  await page.fill("#participants", "13");
  await page.selectOption("#sessions", "4");
  const savedEstimate = JSON.parse(await storedValue(page, ESTIMATE_KEY));
  assert.deepEqual(savedEstimate.selection, { type: "senzorial", participants: 13, sessions: 4 });
  recordCheck("footer settings accept syncs and saves calculator preferences");

  await settingsButton.click();
  await page.locator("#cookie-reject").click();
  assert.equal(await dialog.isVisible(), false);
  await assertConsent(page, false);
  await assertNoOptionalStorage(page);
  assert.equal(await page.locator("#remember-estimate").isChecked(), false);
  recordCheck("rejecting later clears both optional calculator keys");

  await page.locator("#remember-estimate").check();
  await assertConsent(page, true);
  assert.equal(await storedValue(page, REMEMBER_KEY), "yes");
  await settingsButton.click();
  assert.equal(await page.locator("#cookie-functional").isChecked(), true);
  await page.locator("#cookie-save").click();
  assert.equal(await dialog.isVisible(), false, "Saving a selection must close the dialog");
  await page.locator("#remember-estimate").uncheck();
  await assertConsent(page, false);
  await assertNoOptionalStorage(page);
  await settingsButton.click();
  assert.equal(await page.locator("#cookie-functional").isChecked(), false);
  await page.locator(".cookie-close").click();
  recordCheck("calculator checkbox and consent settings stay synchronized in both directions");

  await page.evaluate(({ consentKey, estimateKey, rememberKey, maxAge }) => {
    localStorage.setItem(consentKey, JSON.stringify({ version: 1, functional: true, updatedAt: Date.now() - maxAge }));
    localStorage.setItem(estimateKey, JSON.stringify({ version: 1, selection: { type: "creativ", participants: 12, sessions: 4 } }));
    localStorage.setItem(rememberKey, "yes");
  }, { consentKey: CONSENT_KEY, estimateKey: ESTIMATE_KEY, rememberKey: REMEMBER_KEY, maxAge: CONSENT_MAX_AGE });
  await page.reload({ waitUntil: "networkidle" });
  assert.equal(await dialog.isVisible(), true, "An expired 180-day choice must prompt again");
  await assertNoOptionalStorage(page);
  await page.locator("#cookie-reject").click();
  recordCheck("expired consent is ignored and optional storage is cleared");

  const freshRoutes = [
    ...therapies.map(therapy => ({ label: `therapy ${therapy.slug}`, path: `terapii/${therapy.slug}/` })),
    { label: "legal workshop", path: "ateliere/da-mana-cu-dreptul/" },
    { label: "privacy policy", path: "confidentialitate.html" },
    { label: "cookie policy", path: "cookies.html" },
  ];
  for (const route of freshRoutes) {
    const routeContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const routePage = await routeContext.newPage();
    attachDiagnostics(routePage, route.label);
    await gotoOk(routePage, new URL(route.path, ROOT_URL).href);
    assert.equal(await routePage.locator("#cookie-dialog").isVisible(), true, `${route.label} must prompt in a new context`);
    assert.equal(await routePage.locator("#cookie-functional").isChecked(), false);
    assert((await routePage.locator("[data-open-consent]").count()) > 0, `${route.label} must expose settings`);
    await assertNoOptionalStorage(routePage);
    const visibleText = await routePage.locator("body").innerText();
    assert.match(visibleText, /Smart Therapy Educational/i);
    assert.doesNotMatch(visibleText, /Smart Terapy Educational/i);
    await routeContext.close();
  }
  recordCheck("every therapy, workshop, and policy route prompts in a fresh browser context", {
    routes: freshRoutes.map(route => route.path),
  });

  if (EXPECTED_COMMIT) {
    const buildInfoResponse = await context.request.get(new URL("build-info.json", ROOT_URL).href);
    assert(buildInfoResponse.ok(), `Could not read build-info.json: HTTP ${buildInfoResponse.status()}`);
    const buildInfo = await buildInfoResponse.json();
    assert.equal(buildInfo.commit, EXPECTED_COMMIT);
    recordCheck("verified expected public build", { commit: buildInfo.commit });
  }

  assert.deepEqual(browserFailures, [], `Browser errors or missing assets: ${JSON.stringify(browserFailures, null, 2)}`);
  await writeFile(
    path.join(ARTIFACTS_DIR, "consent-browser-evidence.json"),
    `${JSON.stringify({ target: ROOT_URL.href, expectedCommit: EXPECTED_COMMIT || null, checks, browserFailures }, null, 2)}\n`,
  );
  console.log(`Consent browser verification passed (${checks.length} checks) at ${ROOT_URL.href}`);
} finally {
  await browser.close();
}
