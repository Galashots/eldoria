// Captures for the iPad zoom and iso-speed hotfix. Run: node tools/zoom-speed-capture.mjs
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { launch } from './smoke-test.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = resolve(root, 'docs/playtest/hotfix-input-feel');
await mkdir(outDir, { recursive: true });
const { browser, page, errors } = await launch('?iso=1', { tolerateNavigationTimeout: true, navigationTimeout: 2000 });
await page.setViewport({ width: 1194, height: 834, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
await page.evaluate(() => selectProfile('adventurer'));

async function captureFixedFrames(name, forceIso) {
  await page.evaluate((iso) => {
    localStorage.setItem('eldoria_iso', iso ? '1' : '0'); activateArea('farm'); player.x = 10 * TILE; player.y = 10 * TILE;
    held.left = held.right = held.up = held.down = false; held.right = true;
    for (var frame = 0; frame < 30; frame++) update();
    held.right = false;
  }, forceIso);
  await page.screenshot({ path: resolve(outDir, name), fullPage: false });
}
await captureFixedFrames('speed-topdown-30-frames.png', false);
await captureFixedFrames('speed-iso-30-frames.png', true);
await page.evaluate(() => { localStorage.setItem('eldoria_iso', '1'); activateArea('farm'); });
await page.screenshot({ path: resolve(outDir, 'double-tap-before.png'), fullPage: false });
const doubleTap = await page.evaluate(() => {
  var game = document.getElementById('game'), rect = game.getBoundingClientRect();
  var before = window.visualViewport ? window.visualViewport.scale : 1;
  for (var n = 0; n < 2; n++) game.dispatchEvent(new PointerEvent('pointerdown', {
    bubbles: true, pointerId: 800 + n, pointerType: 'touch', clientX: rect.left + rect.width / 2, clientY: rect.top + rect.height / 2
  }));
  return { before, after: window.visualViewport ? window.visualViewport.scale : 1 };
});
await page.screenshot({ path: resolve(outDir, 'double-tap-after.png'), fullPage: false });
const state = await page.evaluate(() => ({
  viewport: { width: innerWidth, height: innerHeight, scale: window.visualViewport ? window.visualViewport.scale : 1 },
  isoSpeedMultiplier: ISO_SPEED_MULT,
  viewportMeta: document.querySelector('meta[name="viewport"]').content
}));
await writeFile(resolve(outDir, 'zoom-speed-evidence.json'), JSON.stringify({
  capture: 'iPad reference viewport 1194x834 CSS px, DPR 2', doubleTap, state, consoleErrors: errors
}, null, 2) + '\n');
await browser.close();
if (errors.length) { console.error('Capture completed with console errors: ' + errors.join(' | ')); process.exit(1); }
console.log('Wrote zoom/speed evidence to ' + outDir);
