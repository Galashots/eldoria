// Deterministic Farm terrain before/after evidence. The same page state, camera,
// viewport, frozen clock, and hero are used for each pair; only the render flag changes.
import { mkdir, writeFile } from 'node:fs/promises';
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
  await page.waitForFunction(() => Object.keys(SPRITES)
    .filter((key) => /^player_(?:adventurer|mage)_/.test(key))
    .every((key) => SPRITES[key] && SPRITES[key].ready), { timeout: 10000 });
  await page.evaluate(() => document.fonts && document.fonts.ready);
  // The live loop is useful for play, but an evidence pair must not race a
  // requestAnimationFrame or CSS transition between the two screenshots.
  await page.evaluate(() => {
    window.__terrainCaptureFrozen = true;
    window.requestAnimationFrame = function () { return 0; };
    document.getAnimations().forEach((animation) => animation.cancel());
  });
  for (const viewport of viewports) {
    await page.setViewport(viewport);
    await page.evaluate(() => { applyCanvasMode(); drawIsoWorld(); });
    for (const profile of profiles) {
      await page.evaluate((id) => {
        localStorage.clear();
        Date.now = function () { return 1700000000000; };
        selectProfile(id);
        activateArea('farm');
        applyCanvasMode();
        player.x = 10 * TILE;
        player.y = 10 * TILE;
        player.walking = false;
        player.walkFrame = 0;
        player.walkLastAt = 1700000000000;
        player.facing = 'down';
        held.left = held.right = held.up = held.down = false;
        joystickActive = false;
        joystickId = null;
        pops = [];
        shakeUntil = 0;
        drawIsoWorld();
      }, profile);
      await new Promise((resolve) => setTimeout(resolve, 50));
      const stem = `${viewport.name}-${profile}`;
      await page.evaluate(() => {
        window.__isoTerrainForceFallback = true;
        drawIsoWorld();
      });
      await writeFile(`${outDir}/${stem}-before.png`, await page.screenshot());
      await page.evaluate(() => {
        window.__isoTerrainForceFallback = false;
        drawIsoWorld();
      });
      await writeFile(`${outDir}/${stem}-after.png`, await page.screenshot());
    }
  }
} finally {
  await browser.close();
}
console.log(`Wrote ${viewports.length * profiles.length * 2} deterministic terrain captures to ${outDir}`);
