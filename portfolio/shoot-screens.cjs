// Screenshots the three mock screens (built from the app's real stylesheet) in light and dark.
// Run: node portfolio/shoot-screens.cjs
const { chromium } = require('playwright');
const path = require('node:path');

(async () => {
  const browser = await chromium.launch();
  for (const scheme of ['dark', 'light']) {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: 2,
      colorScheme: scheme,
    });
    const page = await context.newPage();
    for (const name of ['home', 'lesson', 'notebook']) {
      await page.goto('file://' + path.resolve(__dirname, 'screens', name + '.html'));
      await page.waitForLoadState('load');
      await page.screenshot({ path: path.resolve(__dirname, 'screens', `${name}-${scheme}.png`) });
    }
    await context.close();
  }
  await browser.close();
  console.log('done');
})();
