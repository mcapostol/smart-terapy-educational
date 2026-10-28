import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from '@playwright/test';

const target = process.env.TARGET_URL || 'http://127.0.0.1:4174/';
const root = new URL(target.endsWith('/') ? target : `${target}/`);
const expectedCommit = process.env.EXPECTED_COMMIT;
const failures = [];
const checks = [];
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || '/home/capostol/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome',
  headless: true,
  args: ['--no-sandbox'],
  env: { ...process.env, LD_LIBRARY_PATH: [
    '/srv/projects/dentalflow-presentation/artifacts/browser-libs/root/usr/lib/x86_64-linux-gnu',
    '/srv/projects/wildora/.tools/browser/root/usr/lib/x86_64-linux-gnu',
    '/srv/projects/wildora/.tools/audio/root/usr/lib/x86_64-linux-gnu',
    process.env.LD_LIBRARY_PATH || '',
  ].join(':') },
});
const record = name => checks.push({ name, status: 'passed' });
try {
  await mkdir('artifacts', { recursive: true });
  const context = await browser.newContext({ permissions: ['clipboard-read', 'clipboard-write'] });
  const page = await context.newPage();
  page.on('pageerror', error => failures.push(error.message));
  page.on('console', message => { if (message.type() === 'error') failures.push(message.text()); });
  page.on('request', request => { if (request.method() !== 'GET') failures.push(`Unexpected ${request.method()} request`); });
  page.on('response', response => { if (response.status() >= 400) failures.push(`${response.status()} ${response.url()}`); });
  assert((await page.goto(root.href, { waitUntil: 'networkidle' })).ok());
  await page.evaluate(() => document.fonts.ready);
  assert.equal(await page.locator('#contact-service option').count(), 14);
  assert.equal(await page.locator('#contact-draft').isVisible(), false);

  for (const width of [320, 390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.locator('#contact').scrollIntoViewIfNeeded();
    const metrics = await page.locator('#contact').evaluate(section => ({
      width: document.documentElement.clientWidth,
      scroll: document.documentElement.scrollWidth,
      outside: [...section.querySelectorAll('input, select, textarea, button, label, p, a')]
        .filter(el => el.getClientRects().length && !el.closest('[hidden]') && (el.getBoundingClientRect().left < -1 || el.getBoundingClientRect().right > innerWidth + 1))
        .map(el => el.id || el.tagName),
    }));
    assert(metrics.scroll <= metrics.width + 1, `${width}px: document overflow`);
    assert.deepEqual(metrics.outside, [], `${width}px: contact fields outside viewport`);
    if ([390, 1440].includes(width)) await page.locator('#contact').screenshot({ path: `artifacts/contact-${width}.png` });
    record(`contact form layout ${width}px`);
  }

  const submit = page.locator('#contact-form button[type="submit"]');
  await submit.click();
  assert.equal(await page.locator('#contact-name').getAttribute('aria-invalid'), 'true');
  assert.equal(await page.locator('#contact-email').getAttribute('aria-invalid'), 'true');
  assert.equal(await page.locator('#contact-message').getAttribute('aria-invalid'), 'true');
  assert.equal(await page.locator('#contact-draft').isVisible(), false);
  await page.fill('#contact-name', 'Ioana Ștefan');
  await page.fill('#contact-email', 'email-invalid');
  await page.selectOption('#contact-service', { label: 'Logopedia' });
  await page.fill('#contact-message', 'Bună! Aș dori detalii & programări.\nMulțumesc!');
  await submit.click();
  assert.equal(await page.locator('#contact-email').getAttribute('aria-invalid'), 'true');
  assert.equal(await page.locator('#contact-draft').isVisible(), false);
  record('required and invalid fields prevent email preparation');

  await page.fill('#contact-email', 'ioana+test@example.com');
  await submit.click();
  assert.equal(await page.locator('#contact-draft').isVisible(), true);
  const uri = new URL(await page.locator('#contact-open-email').getAttribute('href'));
  assert.equal(uri.protocol, 'mailto:');
  assert.equal(uri.pathname, 'contact@smartterapy.ro');
  assert.match(uri.searchParams.get('subject'), /Logopedia/);
  assert.match(uri.searchParams.get('body'), /Ioana Ștefan/);
  assert.match(uri.searchParams.get('body'), /ioana\+test@example.com/);
  assert.match(uri.searchParams.get('body'), /Bună! Aș dori detalii & programări\.\r\nMulțumesc!/);
  assert.match(await page.locator('#contact-status').textContent(), /pregătit/);
  assert.doesNotMatch(await page.locator('#contact-status').textContent(), /trimis cu succes|mesaj primit/i);
  record('valid form composes the correct recipient and encoded email without claiming delivery');

  await page.locator('#contact-copy').click();
  assert.equal(await page.evaluate(() => navigator.clipboard.readText()), await page.locator('#contact-preview').inputValue());
  record('copy fallback retains the complete message');
  const saved = await page.evaluate(() => JSON.stringify({ local: { ...localStorage }, session: { ...sessionStorage } }));
  assert.doesNotMatch(saved, /Ioana|ioana|programări/);
  await page.fill('#contact-message', 'Un mesaj modificat.');
  assert.equal(await page.locator('#contact-draft').isVisible(), false);
  assert.equal(await page.locator('#contact-preview').inputValue(), '');
  assert.equal(await page.locator('#contact-open-email').getAttribute('href'), 'mailto:contact@smartterapy.ro');
  record('editing clears the old draft and personal data are not stored');

  await page.reload({ waitUntil: 'networkidle' });
  assert.equal(await page.locator('#contact-form').count(), 1);
  await page.goto(new URL('terapii/logopedie/', root).href, { waitUntil: 'networkidle' });
  assert.equal(await page.locator('.footer-email').getAttribute('href'), 'mailto:contact@smartterapy.ro');
  await page.locator('.therapy-detail-hero a.button').click();
  await page.waitForURL(`${root.href}#contact`);
  assert.equal(await page.locator('#contact-form').count(), 1);
  const reopened = await context.newPage();
  await reopened.goto(`${root.href}#contact`, { waitUntil: 'networkidle' });
  assert.equal(await reopened.locator('#contact-form').count(), 1);
  assert.equal(await reopened.locator('.footer-email').getAttribute('href'), 'mailto:contact@smartterapy.ro');
  record('contact remains available after refresh, reopen and therapy navigation');

  await page.locator('#remember-estimate').check();
  await page.fill('#participants', '13');
  await page.evaluate(() => localStorage.setItem('unrelated-test-key', 'preserve'));
  assert.notEqual(await page.evaluate(() => localStorage.getItem('smart-terapy:atelier-estimate:v1')), null);
  for (const route of ['confidentialitate.html', 'cookies.html']) {
    for (const width of [360, 1440]) {
      await page.setViewportSize({ width, height: 1000 });
      assert((await page.goto(new URL(route, root).href, { waitUntil: 'networkidle' })).ok());
      assert.match(await page.locator('h1').textContent(), /Politica/);
      assert.equal(await page.locator('a[href="mailto:contact@smartterapy.ro"]').count() > 0, true);
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
      if (width === 360) await page.screenshot({ path: `artifacts/${route.replace('.html', '')}-mobile.png`, fullPage: true });
    }
    record(`${route} loads with contact details and responsive text`);
  }
  await page.locator('#clear-preferences').click();
  assert.match(await page.locator('#preferences-status').textContent(), /șterse/);
  assert.equal(await page.evaluate(() => localStorage.getItem('smart-terapy:atelier-estimate:v1')), null);
  assert.equal(await page.evaluate(() => localStorage.getItem('smart-terapy:remember-estimate:v1')), null);
  assert.equal(await page.evaluate(() => localStorage.getItem('unrelated-test-key')), 'preserve');
  await page.goto(root.href, { waitUntil: 'networkidle' });
  assert.equal(await page.locator('#remember-estimate').isChecked(), false);
  assert.equal(await page.locator('#participants').inputValue(), '12');
  await page.evaluate(() => localStorage.removeItem('unrelated-test-key'));
  record('cookie policy clears only owned preferences and disables persistence');

  if (expectedCommit) {
    const info = await context.request.get(new URL('build-info.json', root).href);
    assert(info.ok());
    assert.equal((await info.json()).commit, expectedCommit);
    record('verified expected public build');
  }
  assert.deepEqual(failures, []);
  await writeFile('artifacts/contact-browser-evidence.json', JSON.stringify({ target: root.href, expectedCommit, checks, browserFailures: failures }, null, 2));
  console.log(`Contact verification passed (${checks.length} checks) at ${root.href}`);
} finally {
  await browser.close();
}
