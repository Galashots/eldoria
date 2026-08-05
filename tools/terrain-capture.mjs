// Deterministic Farm terrain before/after evidence. The same page state, camera,
// viewport, frozen clock, and hero are used for each pair; only the render flag changes.
import { mkdir } from 'node:fs/promises';
import { launch } from './smoke-test.mjs';

const outDir = 'docs/playtest/step8-farm-terrain';
await mkdir(outDir, { recursive: true });
const viewports = [
  { name: 'desktop', width: 1280, height: 800, deviceScaleFactor: 1 },
  { name: 'ipad-landscape', width: 1180, height: 820, deviceScaleFactor: 2 },
  { name: 'phone-portrait', width: 390, height: 844, deviceScaleFactor: 2 },
];
const profiles = ['adventurer', 'mage'];
const { browser, page } = await launch('?iso=1');
try {
  await page.waitForFunction(() => window.isoTerrainPreloadSettled === true, { timeout: 10000 });
  for (const viewport of viewports) {
    await page.setViewport(viewport);
    for (const profile of profiles) {
      await page.evaluate((id) => {
        localStorage.clear();
        Date.now = function () { return 1700000000000; };
        selectProfile(id);
        activateArea('farm');
        applyCanvasMode();
        player.x = 10 * TILE;
        player.y = 10 * TILE;
        player.facing = 'down';
        drawIsoWorld();
      }, profile);
      const stem = `${viewport.name}-${profile}`;
      await page.evaluate(() => {
        window.__isoTerrainForceFallback = true;
        drawIsoWorld();
      });
      await page.screenshot({ path: `${outDir}/${stem}-before.png` });
      await page.evaluate(() => {
        window.__isoTerrainForceFallback = false;
        drawIsoWorld();
      });
      await page.screenshot({ path: `${outDir}/${stem}-after.png` });
    }
  }
} finally {
  await browser.close();
}
console.log(`Wrote ${viewports.length * profiles.length * 2} deterministic terrain captures to ${outDir}`);
