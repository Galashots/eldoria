// Zoom and iso-speed hotfix regressions from Leo's iPad playtest (2026-08-05).
// Run: node tools/zoom-speed-test.mjs
import { launch } from './smoke-test.mjs';

const fails = [];
const check = (name, ok) => { console.log((ok ? 'PASS ' : 'FAIL ') + name); if (!ok) fails.push(name); };

// --- ELD-PT-011: rapid taps must remain game input, not page zoom ---
{
  const { browser, page, errors } = await launch('?iso=1', { tolerateNavigationTimeout: true, navigationTimeout: 2000 });
  await page.setViewport({ width: 1194, height: 834, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const r = await page.evaluate(() => {
    selectProfile('adventurer');
    var action = document.getElementById('actionBtn'), hud = document.querySelector('.hud'), game = document.getElementById('game');
    var actionTaps = 0, hudTaps = 0, gameTaps = 0;
    action.addEventListener('pointerdown', function() { actionTaps++; });
    hud.addEventListener('pointerdown', function() { hudTaps++; });
    game.addEventListener('pointerdown', function() { gameTaps++; });
    function rapidTap(el, id) {
      var rect = el.getBoundingClientRect();
      for (var n = 0; n < 2; n++) el.dispatchEvent(new PointerEvent('pointerdown', {
        bubbles: true, pointerId: id + n, pointerType: 'touch', clientX: rect.left + rect.width / 2,
        clientY: rect.top + rect.height / 2
      }));
    }
    var before = window.visualViewport ? window.visualViewport.scale : 1;
    rapidTap(game, 101); rapidTap(hud, 201); rapidTap(action, 301);
    return { before, after: window.visualViewport ? window.visualViewport.scale : 1, actionTaps, hudTaps, gameTaps,
      viewport: document.querySelector('meta[name="viewport"]').content,
      gameTouchAction: getComputedStyle(game).touchAction, hudTouchAction: getComputedStyle(hud).touchAction,
      actionTouchAction: getComputedStyle(action).touchAction };
  });
  check('ELD-PT-011: rapid taps preserve viewport scale', r.before === 1 && r.after === 1);
  check('ELD-PT-011: each rapid second tap reaches farm, HUD, and Action', r.gameTaps === 2 && r.hudTaps === 2 && r.actionTaps === 2);
  check('ELD-PT-011: viewport keeps accessibility zoom enabled', !/user-scalable=no/i.test(r.viewport));
  check('ELD-PT-011: game surfaces use manipulation touch handling', r.gameTouchAction === 'manipulation' && r.hudTouchAction === 'manipulation' && r.actionTouchAction === 'manipulation');
  check('ELD-PT-011: no console errors', errors.length === 0);
  await browser.close();
}

// --- Iso-only speed: preserve top-down while making projected movement tunable ---
{
  const { browser, page, errors } = await launch('?iso=1', { tolerateNavigationTimeout: true, navigationTimeout: 2000 });
  const r = await page.evaluate(() => {
    selectProfile('adventurer');
    function resetAt(x, y) { player.x = x; player.y = y; held.left = held.right = held.up = held.down = false; player.walking = false; }
    function singleRightStep(iso) {
      localStorage.setItem('eldoria_iso', iso ? '1' : '0'); activateArea('farm'); resetAt(10 * TILE, 10 * TILE);
      var before = { x: player.x, y: player.y }; held.right = true; update(); held.right = false;
      return Math.hypot(player.x - before.x, player.y - before.y);
    }
    var topDown = singleRightStep(false), iso = singleRightStep(true);
    activateArea('farm'); localStorage.setItem('eldoria_iso', '1'); resetAt(0, 10 * TILE); held.left = true;
    for (var i = 0; i < 20; i++) update();
    held.left = false;
    return { topDown, iso, multiplier: ISO_SPEED_MULT, playerSpeed: player.speed, boundaryX: player.x };
  });
  check('movement: top-down step remains the base player speed', Math.abs(r.topDown - r.playerSpeed) < 1e-9);
  check('movement: iso step is base speed times the iso-only multiplier', Math.abs(r.iso - r.topDown * r.multiplier) < 1e-9);
  check('movement: iso speed knob starts at the approved 1.5x', r.multiplier === 1.5);
  check('movement: faster iso step cannot tunnel through a blocked map edge', r.boundaryX === 0);
  check('movement: no console errors', errors.length === 0);
  await browser.close();
}

if (fails.length) { console.error('ZOOM/SPEED TEST FAILED: ' + fails.join(', ')); process.exit(1); }
console.log('Zoom/speed test passed.');
