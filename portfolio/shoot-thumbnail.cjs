// Renders thumbnail.html to lumio-thumbnail.png (1600x1000) and lumio-thumbnail@2x.png (3200x2000).
// Run after shoot-screens.cjs:  node portfolio/shoot-thumbnail.cjs
const { chromium } = require('playwright');
const path = require('node:path');

(async () => {
  const browser = await chromium.launch();
  for (const [scale, name] of [[1, 'lumio-thumbnail.png'], [2, 'lumio-thumbnail@2x.png']]) {
    const context = await browser.newContext({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: scale });
    const page = await context.newPage();
    await page.goto('file://' + path.resolve(__dirname, 'thumbnail.html'));
    await page.waitForLoadState('load');
    await page.screenshot({ path: path.resolve(__dirname, name) });
    await context.close();
  }
  await browser.close();
  console.log('done');
})();
