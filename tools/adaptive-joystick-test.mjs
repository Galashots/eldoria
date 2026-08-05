// Adaptive joystick regressions from Leo's iPad playtest (2026-08-05).
// Run: node tools/adaptive-joystick-test.mjs
import { launch } from './smoke-test.mjs';

const fails = [];
const check = (name, ok) => { console.log((ok ? 'PASS ' : 'FAIL ') + name); if (!ok) fails.push(name); };
const options = { tolerateNavigationTimeout: true, navigationTimeout: 2000 };

// Synthetic events validate the pure geometry and visual/digital output contract.
{
  const { browser, page, errors } = await launch('?iso=1', options);
  await page.setViewport({ width: 1194, height: 834, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const r = await page.evaluate(() => {
    selectProfile('adventurer');
    var zone = document.getElementById('joystickZone'), base = document.getElementById('joystickBase'), thumb = document.getElementById('joystickThumb');
    var geometry = joystickZoneGeometry(1194, 834), zoneTouches = 0, canvasTouches = 0;
    zone.addEventListener('pointerdown', function() { zoneTouches++; });
    canvas.addEventListener('pointerdown', function() { canvasTouches++; });
    function pointer(type, target, id, x, y) {
      target.dispatchEvent(new PointerEvent(type, { bubbles: true, pointerId: id, pointerType: 'touch', clientX: x, clientY: y }));
    }
    var startX = geometry.left + 90, startY = geometry.bottom - 90;
    pointer('pointerdown', zone, 501, startX, startY);
    var start = { active: joystickActive, id: joystickId, visible: base.classList.contains('joystick-visible') && thumb.classList.contains('joystick-visible'),
      baseCenterX: joystickBaseCenter.x, baseCenterY: joystickBaseCenter.y };
    pointer('pointerdown', zone, 502, startX + 10, startY + 10);
    var secondIgnored = joystickId === 501 && zoneTouches === 2;
    pointer('pointermove', zone, 501, startX + 500, startY);
    var moved = { thumbX: parseFloat(thumb.style.left), baseX: parseFloat(base.style.left), heldRight: held.right };
    pointer('pointerup', zone, 501, startX + 500, startY);
    var released = !joystickActive && !base.classList.contains('joystick-visible') && !thumb.classList.contains('joystick-visible') && !held.left && !held.right && !held.up && !held.down;
    var outside = { x: geometry.right + 1, y: geometry.bottom - 1 };
    pointer('pointerdown', canvas, 503, outside.x, outside.y);
    return { geometry, inside: joystickPointInZone(startX, startY, geometry), outside: joystickPointInZone(outside.x, outside.y, geometry),
      start, secondIgnored, moved, released, zoneTouches, canvasTouches, dead: JOYSTICK_DEAD,
      zoneSize: { width: zone.getBoundingClientRect().width, height: zone.getBoundingClientRect().height } };
  });
  check('joystick: pure geometry is the approved bounded 240x220 corner zone', r.geometry.width === 240 && r.geometry.height === 220 && r.zoneSize.width === 240 && r.zoneSize.height === 220);
  check('joystick: inside touch engages at its own origin and makes controls visible', r.inside && r.start.active && r.start.id === 501 && r.start.visible && Math.abs(r.start.baseCenterX - (r.geometry.left + 90)) < 1e-9 && Math.abs(r.start.baseCenterY - (r.geometry.bottom - 90)) < 1e-9);
  check('joystick: second touch cannot steal the active joystick', r.secondIgnored);
  check('joystick: drag clamps the thumb at the movement radius and still outputs digital right', Math.abs((r.moved.thumbX + 27) - (r.moved.baseX + 70) - (70 - 27)) < 1e-9 && r.moved.heldRight);
  check('joystick: release hides both controls and clears the unchanged digital output', r.released && r.dead === 0.2);
  check('joystick: just-outside point does not engage and still reaches the world canvas', !r.outside && r.canvasTouches === 1 && r.zoneTouches === 2);
  check('joystick: synthetic contract path has no console errors', errors.length === 0);
  await browser.close();
}

// A real Puppeteer mouse pointer is trusted by the browser: verify it is captured,
// then drag beyond the zone and prove movement still reaches the joystick listener.
{
  const { browser, page, errors } = await launch('?iso=1', options);
  await page.setViewport({ width: 1194, height: 834, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const origin = await page.evaluate(() => {
    selectProfile('adventurer');
    var zone = document.getElementById('joystickZone');
    window.__joystickGotCapture = 0;
    window.__joystickCapturedMoves = 0;
    zone.addEventListener('gotpointercapture', function() { window.__joystickGotCapture++; });
    zone.addEventListener('pointermove', function() { if (joystickActive) window.__joystickCapturedMoves++; });
    var rect = zone.getBoundingClientRect();
    return { x: rect.left + 90, y: rect.top + 90 };
  });
  await page.mouse.move(origin.x, origin.y);
  await page.mouse.down();
  await page.mouse.move(origin.x + 500, origin.y);
  const r = await page.evaluate(() => ({ active: joystickActive, trustedCapture: window.__joystickGotCapture, capturedMoves: window.__joystickCapturedMoves, heldRight: held.right }));
  await page.mouse.up();
  check('joystick: trusted child-input path acquires pointer capture and tracks an out-of-zone drag', r.active && r.trustedCapture === 1 && r.capturedMoves > 0 && r.heldRight);
  check('joystick: trusted capture path has no console errors', errors.length === 0);
  await browser.close();
}

// The persisted opt-out must restore the original fixed-corner behavior for iPad A/B.
{
  const { browser, page, errors } = await launch('?iso=1&fixedJoystick=1', options);
  await page.setViewport({ width: 1194, height: 834, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const r = await page.evaluate(() => {
    selectProfile('adventurer');
    var zone = document.getElementById('joystickZone'), base = document.getElementById('joystickBase');
    var zoneRect = zone.getBoundingClientRect(), before = base.getBoundingClientRect();
    var x = zoneRect.right - 4, y = zoneRect.top + zoneRect.height / 2;
    zone.dispatchEvent(new PointerEvent('pointerdown', {
      bubbles: true, pointerId: 601, pointerType: 'touch', clientX: x, clientY: y
    }));
    var after = base.getBoundingClientRect();
    return {
      persisted: localStorage.getItem('eldoria_fixed_joystick'), fixed: fixedJoystickActive(),
      zone: { width: zoneRect.width, height: zoneRect.height }, alwaysVisible: base.classList.contains('joystick-visible'),
      baseStayedFixed: before.left === after.left && before.top === after.top,
      centerOriginDrivesRight: held.right && !held.left && !held.up && !held.down
    };
  });
  check('joystick fallback: persisted flag restores the 140px fixed corner zone', r.persisted === '1' && r.fixed && r.zone.width === 140 && r.zone.height === 140);
  check('joystick fallback: base remains visible and does not spawn at the touch point', r.alwaysVisible && r.baseStayedFixed);
  check('joystick fallback: touch offsets are measured from the fixed zone center', r.centerOriginDrivesRight);
  check('joystick fallback: no console errors', errors.length === 0);
  await browser.close();
}

if (fails.length) { console.error('ADAPTIVE JOYSTICK TEST FAILED: ' + fails.join(', ')); process.exit(1); }
console.log('Adaptive joystick test passed.');
