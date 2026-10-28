import { chromium } from '@playwright/test';
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH, args: ['--no-sandbox'] });
try {
  const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
  await page.goto(process.env.TARGET_URL || 'http://127.0.0.1:4173', { waitUntil: 'networkidle' });
  await page.evaluate(() => {
    for (const child of [...document.body.children]) if (child.tagName !== 'MAIN') child.remove();
    for (const child of [...document.querySelector('main').children]) if (!child.classList.contains('hero')) child.remove();
    document.querySelector('.hero').style.cssText = 'width:1100px;height:630px;margin:auto;padding:25px 0;display:grid;grid-template-columns:1fr 1fr;align-items:center;gap:0';
    document.querySelector('.hero-actions').remove();
    document.querySelector('.hero-footnote').innerHTML = '<p style="font-family:Georgia,serif;font-size:26px;color:#4b6043">smart terapy</p>';
    document.querySelector('h1').style.fontSize = '69px';
  });
  await page.screenshot({ path: 'public/assets/social-card.png' });
  console.log('Generated public/assets/social-card.png');
} finally { await browser.close(); }
