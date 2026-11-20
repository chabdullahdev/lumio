// Full-page previews of the case study (desktop light, mobile dark) to check the layout.
const { chromium } = require('playwright');
const path = require('node:path');

(async () => {
  const browser = await chromium.launch();
  const url = 'file://' + path.resolve(__dirname, 'lumio-case-study.html');
  for (const [name, viewport, scheme] of [
    ['preview-desktop', { width: 1280, height: 900 }, 'light'],
    ['preview-mobile', { width: 390, height: 844 }, 'dark'],
  ]) {
    const context = await browser.newContext({ viewport, colorScheme: scheme, deviceScaleFactor: 1 });
    const page = await context.newPage();
    await page.goto(url);
    await page.waitForLoadState('load');
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
    console.log(name, 'horizontal overflow:', overflow);
    await page.screenshot({ path: path.resolve(__dirname, name + '.png'), fullPage: true });
    await context.close();
  }
  await browser.close();
})();
