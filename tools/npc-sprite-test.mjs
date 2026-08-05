// Town NPC sprite integration checks. Run with --capture to refresh the committed
// visual evidence through the real isometric renderer.
import { launch } from './smoke-test.mjs';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const NPC_IDS = ['mira', 'bram', 'gunnar'];
const fails = [];
const check = (name, ok) => {
  console.log((ok ? 'PASS ' : 'FAIL ') + name);
  if (!ok) fails.push(name);
};

const { browser, page, errors } = await launch('?iso=1');
try {
  const result = await page.evaluate((ids) => {
    selectProfile('adventurer');
    activateArea('town');
    applyCanvasMode();
    window.__isoDebug = true;
    window.__isoNpcDraws = [];
    player.x = 13 * TILE;
    player.y = 10 * TILE;
    drawIsoWorld();
    const bindings = ids.map(id => {
      const key = 'iso_npc_' + id + '_' + ISO_NPC_IDLE_DIRECTION_KEY;
      const rec = SPRITES[key];
      return {
        id,
        key,
        ready: !!(rec && rec.ready),
        width: rec && rec.img.naturalWidth,
        height: rec && rec.img.naturalHeight,
        path: rec && rec.img.getAttribute('src')
      };
    });
    return { bindings, draws: window.__isoNpcDraws.slice(), iso: isoActive() };
  }, NPC_IDS);

  check('boot: zero console errors', errors.length === 0);
  if (errors.length) console.log('  errors: ' + errors.join(' | '));
  check('runtime: Town isometric mode is active', result.iso === true);
  check('runtime: all three normalized NPC idle files load at 64x64',
    result.bindings.every(b => b.ready && b.width === 64 && b.height === 64));
  check('runtime: each Town NPC is drawn through the sprite branch',
    NPC_IDS.every(id => result.draws.indexOf(id) !== -1));
  check('runtime: paths stay in the isometric NPC asset family',
    result.bindings.every(b => /assets\/iso\/npc\/(mira|bram|gunnar)-down-right\.png$/.test(b.path || '')));

  if (process.argv.includes('--capture')) {
    const evidenceDir = fileURLToPath(new URL('../docs/playtest/2026-08-05-npc-sprite-integration/', import.meta.url));
    await mkdir(evidenceDir, { recursive: true });
    const captures = [
      { name: 'town-mira-desktop', width: 1363, height: 936, player: [13, 10] },
      { name: 'town-bram-desktop', width: 1363, height: 936, player: [6, 7] },
      { name: 'town-gunnar-desktop', width: 1363, height: 936, player: [20, 7] },
      { name: 'town-mira-ipad-landscape', width: 1180, height: 820, player: [13, 10] },
      { name: 'town-mira-phone-portrait', width: 390, height: 780, player: [13, 10] }
    ];
    for (const capture of captures) {
      const { browser: captureBrowser, page: capturePage } = await launch('?iso=1');
      await capturePage.setViewport({ width: capture.width, height: capture.height, deviceScaleFactor: 2 });
      await capturePage.evaluate((playerTile) => {
        selectProfile('adventurer');
        activateArea('town');
        applyCanvasMode();
        player.x = playerTile[0] * TILE;
        player.y = playerTile[1] * TILE;
        // Fix the animation clock and state, then let Chromium paint the live
        // canvas surface before the screenshot. Freezing the loop before a
        // compositor paint produces a false black canvas on Windows Chromium.
        Date.now = () => 1700000000000;
        drawIsoWorld();
      }, capture.player);
      await new Promise(resolve => setTimeout(resolve, 100));
      await capturePage.screenshot({
        path: join(evidenceDir, capture.name + '.png'),
        fullPage: true
      });
      await captureBrowser.close();
    }
    check('visual evidence: desktop, iPad landscape, and phone Town captures written', true);
  }
} finally {
  await browser.close();
}

if (fails.length) {
  console.error('\nNPC SPRITE TEST FAILED: ' + fails.join(', '));
  process.exit(1);
}
console.log('NPC sprite tests passed.');
