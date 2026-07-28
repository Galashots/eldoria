// Iso engine assertions, evaluated inside the live page. Run: node tools/iso-test.mjs
import { launch } from './smoke-test.mjs';

const fails = [];
const check = (name, ok) => { console.log((ok ? 'PASS ' : 'FAIL ') + name); if (!ok) fails.push(name); };

// --- Suite 1: pure math ---
{
  const { browser, page } = await launch();
  const r = await page.evaluate(() => {
    var out = { roundTrip: true, up: null, right: null, depth: null };
    // Round-trip world -> projected -> world over a coordinate sweep
    for (var px = 0; px <= 960; px += 96) for (var py = 0; py <= 704; py += 88) {
      var sx = isoPX(px, py), sy = isoPY(px, py);
      if (Math.abs(isoInvX(sx, sy) - px) > 1e-9 || Math.abs(isoInvY(sx, sy) - py) > 1e-9)
        out.roundTrip = false;
    }
    // Screen-relative input identities (spec section 6 sanity checks)
    out.up    = [isoInputX(0, -1), isoInputY(0, -1)];   // expect [-1, -1]
    out.right = [isoInputX(1, 0),  isoInputY(1, 0)];    // expect [0.5, -0.5]
    // Depth: nearer (larger px+py) sorts later
    out.depth = isoDepthKey(64, 64) > isoDepthKey(32, 32);
    return out;
  });
  check('math: projection round-trips', r.roundTrip === true);
  check('math: push-up maps to world NW', r.up[0] === -1 && r.up[1] === -1);
  check('math: push-right maps to world SE-ish', r.right[0] === 0.5 && r.right[1] === -0.5);
  check('math: depth key increases toward viewer', r.depth === true);
  await browser.close();
}

// --- Suite 2: flag plumbing ---
{
  const { browser, page } = await launch('?iso=1');
  const r = await page.evaluate(() => {
    var on = isoActive();
    localStorage.removeItem('eldoria_iso');
    var offDefault = isoActive();            // all ISO_AREAS false in Phase 0
    return { on: on, offDefault: offDefault };
  });
  check('flag: ?iso=1 turns iso on', r.on === true);
  check('flag: default is off everywhere', r.offDefault === false);
  await browser.close();
}

// --- Suite 3: responsive canvas ---
{
  const { browser, page } = await launch('?iso=1');
  await page.setViewport({ width: 390, height: 780, deviceScaleFactor: 3 });
  const r = await page.evaluate(() => {
    selectProfile('adventurer');
    applyCanvasMode();
    var rect = canvas.getBoundingClientRect();
    return { w: canvas.width, cssW: rect.width, scale: isoScale,
             expectW: Math.round(rect.width * 2) };  // DPR capped at 2, not 3
  });
  check('canvas: backing store = css width x capped DPR', r.w === r.expectW);
  check('canvas: isoScale set and positive', r.scale > 0);
  await browser.close();
}

// --- Suite 4: iso ground renders ---
{
  const { browser, page } = await launch('?iso=1');
  const r = await page.evaluate(() => {
    selectProfile('adventurer');
    applyCanvasMode();
    drawIsoWorld();
    // Sample the canvas center: must not be the untouched black background.
    var d = ctx.getImageData(Math.floor(canvas.width / 2), Math.floor(canvas.height / 2), 1, 1).data;
    return { r: d[0], g: d[1], b: d[2] };
  });
  check('ground: canvas center is painted (not black)', (r.r + r.g + r.b) > 30);
  await browser.close();
}

// --- Suite 5: depth-sorted objects ---
{
  const { browser, page } = await launch('?iso=1');
  const r = await page.evaluate(() => {
    selectProfile('adventurer');
    applyCanvasMode();
    window.__isoDebug = true;
    // Stand the hero mid-map between the farm's border trees.
    player.x = 8 * 32; player.y = 5 * 32;
    drawIsoWorld();
    var order = window.__isoDrawOrder;
    var playerIdx = order.indexOf('player');
    // A border tree NORTH of the hero (row 0) must draw before them,
    // a border tree SOUTH (row 21) after them.
    var north = order.indexOf('tree@0,8'), south = order.indexOf('tree@21,8');
    return { playerIdx: playerIdx, north: north, south: south, n: order.length };
  });
  check('objects: some objects collected', r.n > 10);
  check('objects: north tree draws before player', r.north !== -1 && r.north < r.playerIdx);
  check('objects: south tree draws after player', r.south !== -1 && r.south > r.playerIdx);
  await browser.close();
}

if (fails.length) { console.error('ISO TEST FAILED: ' + fails.join(', ')); process.exit(1); }
console.log('Iso tests passed.');
