// Renders each style in index.html to a PNG next to this file.
// Usage: node texture-previews/render.mjs   (needs playwright installed somewhere resolvable;
// set PLAYWRIGHT_PATH to a node_modules/playwright dir if it is not in this checkout)
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1000, height: 800 } });
page.on('pageerror', e => console.error('page error:', e.message));
for (const html of ['index.html', 'interiors.html']) {
  await page.goto(pathToFileURL(path.join(here, html)).href);
  await page.waitForFunction(() => window.__done, null, { timeout: 120000 });
  const figs = await page.$$('figure[data-style], figure[data-file]');
  for (const [i, fig] of figs.entries()) {
    const name = (await fig.getAttribute('data-file')) || `${String(i).padStart(2, '0')}-${await fig.getAttribute('data-style')}`;
    const file = path.join(here, `${name}.png`);
    await fig.screenshot({ path: file });
    console.log('wrote', path.relative(process.cwd(), file));
  }
}
await browser.close();
