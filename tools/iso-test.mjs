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

if (fails.length) { console.error('ISO TEST FAILED: ' + fails.join(', ')); process.exit(1); }
console.log('Iso tests passed.');
