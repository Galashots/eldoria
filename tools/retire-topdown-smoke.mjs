// Five-area iso smoke matrix — rollback-custody evidence for retiring top-down (combat/armor
// spec sub-project 1, §7). For each area it boots the game, activates the area, renders through
// the iso renderer, asserts the iso object pass ran with zero console errors, and writes one
// screenshot per area under docs/playtest/2026-08-06-retire-topdown/. Standalone evidence tool
// (not part of `npm test`, like the other *-capture scripts). Run: node tools/retire-topdown-smoke.mjs
import { launch } from './smoke-test.mjs';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const AREAS = ['farm', 'town', 'wilds', 'deepwoods', 'mine'];
const fails = [];
const check = (name, ok) => { console.log((ok ? 'PASS ' : 'FAIL ') + name); if (!ok) fails.push(name); };

const evidenceDir = fileURLToPath(new URL('../docs/playtest/2026-08-06-retire-topdown/', import.meta.url));
await mkdir(evidenceDir, { recursive: true });

for (const area of AREAS) {
  const { browser, page, errors } = await launch();
  await page.setViewport({ width: 1180, height: 820, deviceScaleFactor: 2 });
  const r = await page.evaluate((a) => {
    selectProfile('adventurer');
    activateArea(a);
    applyCanvasMode();
    player.x = 12 * TILE; player.y = 10 * TILE;   // mid-map, representative frame
    window.__isoDebug = true; window.__isoDrawOrder = null;
    Date.now = () => 1700000000000;               // deterministic clock for the capture
    drawIsoWorld();                                // throws if the area still expected top-down
    var mid = ctx.getImageData(Math.floor(canvas.width / 2), Math.floor(canvas.height / 2), 1, 1).data;
    return {
      objectPass: Array.isArray(window.__isoDrawOrder) && window.__isoDrawOrder.length > 0,
      centerRGB: mid[0] + mid[1] + mid[2]          // recorded for the reviewer, not asserted
    };
  }, area);
  await new Promise(res => setTimeout(res, 100));  // let Chromium paint before the screenshot
  await page.screenshot({ path: join(evidenceDir, 'iso-' + area + '.png'), fullPage: true });
  check(area + ': renders through the iso object pass', r.objectPass);
  check(area + ': zero console errors during iso render', errors.length === 0);
  if (errors.length) console.log('  errors: ' + errors.join(' | '));
  await browser.close();
}

if (fails.length) { console.error('\nRETIRE-TOPDOWN SMOKE FAILED: ' + fails.join(', ')); process.exit(1); }
console.log('Five-area iso smoke matrix passed. Evidence: docs/playtest/2026-08-06-retire-topdown/');
