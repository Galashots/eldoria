// ---- Draw ----
function draw() {
  drawIsoWorld();
}

// ---- Main loop ----
function loop() {
  // Deterministic browser evidence may freeze the live loop after boot and
  // invoke the real renderer explicitly for a captured state.
  if (window.__terrainCaptureFrozen) return;
  update();
  draw();
  requestAnimationFrame(loop);
}

// ---- Virtual joystick ----
var joystickZone = document.getElementById('joystickZone');
var joystickBase = document.getElementById('joystickBase');
var joystickThumb = document.getElementById('joystickThumb');
var joystickActive = false;
var joystickId = null;
var JOYSTICK_RADIUS = 70;
var JOYSTICK_DEAD = 0.2;
var JOYSTICK_ZONE_WIDTH = 240;
var JOYSTICK_ZONE_HEIGHT = 220;
var JOYSTICK_ZONE_LEFT = 18;
var JOYSTICK_ZONE_BOTTOM = 18;
var JOYSTICK_EDGE_INSET = 8;
var JOYSTICK_THUMB_RADIUS = 27;
var joystickOrigin = null;
var joystickBaseCenter = null;

// iPad A/B escape hatch: ?fixedJoystick=1 persists the original fixed corner rig;
// ?fixedJoystick=0 returns to adaptive placement — a URL-persisted toggle so Leo can
// compare feel on-device without waiting for a redeploy.
if (location.search.indexOf('fixedJoystick=1') !== -1) {
  try { localStorage.setItem('eldoria_fixed_joystick', '1'); } catch (e) {}
}
if (location.search.indexOf('fixedJoystick=0') !== -1) {
  try { localStorage.removeItem('eldoria_fixed_joystick'); } catch (e) {}
}

function fixedJoystickActive() {
  try { return localStorage.getItem('eldoria_fixed_joystick') === '1'; } catch (e) { return false; }
}

function applyJoystickMode() {
  var fixed = fixedJoystickActive();
  joystickZone.classList.toggle('fixed-joystick', fixed);
  if (fixed) joystickShow();
  else joystickHide();
}

// Keep this geometry independent from the DOM so its lower-left bounds can be tested
// without event dispatch. The base itself may overflow this catchment, but the zone
// never expands into the rest of the playfield.
function joystickZoneGeometry(viewportWidth, viewportHeight) {
  var left = JOYSTICK_ZONE_LEFT;
  var bottom = viewportHeight - JOYSTICK_ZONE_BOTTOM;
  return {
    left: left,
    top: bottom - JOYSTICK_ZONE_HEIGHT,
    right: left + JOYSTICK_ZONE_WIDTH,
    bottom: bottom,
    width: JOYSTICK_ZONE_WIDTH,
    height: JOYSTICK_ZONE_HEIGHT
  };
}

function joystickPointInZone(clientX, clientY, geometry) {
  return clientX >= geometry.left && clientX <= geometry.right &&
         clientY >= geometry.top && clientY <= geometry.bottom;
}

function joystickClampBaseCenter(clientX, clientY, viewportWidth, viewportHeight) {
  var min = JOYSTICK_RADIUS + JOYSTICK_EDGE_INSET;
  return {
    x: Math.max(min, Math.min(viewportWidth - min, clientX)),
    y: Math.max(min, Math.min(viewportHeight - min, clientY))
  };
}

function joystickSetElementCenter(element, centerX, centerY, radius) {
  var rect = joystickZone.getBoundingClientRect();
  element.style.left = (centerX - rect.left - radius) + 'px';
  element.style.top = (centerY - rect.top - radius) + 'px';
}

function joystickShow() {
  joystickBase.classList.add('joystick-visible');
  joystickThumb.classList.add('joystick-visible');
}

function joystickHide() {
  joystickBase.classList.remove('joystick-visible');
  joystickThumb.classList.remove('joystick-visible');
}

function joystickUpdate(cx, cy) {
  var fixed = fixedJoystickActive();
  var ox, oy;
  if (fixed) {
    var rect = joystickZone.getBoundingClientRect();
    ox = cx - (rect.left + rect.width / 2);
    oy = cy - (rect.top + rect.height / 2);
  } else {
    ox = cx - joystickOrigin.x;
    oy = cy - joystickOrigin.y;
  }
  var dist = Math.sqrt(ox * ox + oy * oy);
  var maxDist = JOYSTICK_RADIUS - JOYSTICK_THUMB_RADIUS;
  if (dist > maxDist) { ox = ox / dist * maxDist; oy = oy / dist * maxDist; }
  if (fixed) {
    joystickThumb.style.left = (JOYSTICK_RADIUS - JOYSTICK_THUMB_RADIUS + ox) + 'px';
    joystickThumb.style.top = (JOYSTICK_RADIUS - JOYSTICK_THUMB_RADIUS + oy) + 'px';
  } else {
    joystickSetElementCenter(joystickThumb, joystickBaseCenter.x + ox, joystickBaseCenter.y + oy,
                             JOYSTICK_THUMB_RADIUS);
  }
  var nx = dist > 0 ? ox / maxDist : 0;
  var ny = dist > 0 ? oy / maxDist : 0;
  held.left  = nx < -JOYSTICK_DEAD;
  held.right = nx >  JOYSTICK_DEAD;
  held.up    = ny < -JOYSTICK_DEAD;
  held.down  = ny >  JOYSTICK_DEAD;
}

function joystickReset() {
  joystickActive = false;
  joystickId = null;
  joystickOrigin = null;
  joystickBaseCenter = null;
  if (fixedJoystickActive()) {
    joystickThumb.style.left = '43px';
    joystickThumb.style.top = '43px';
    joystickShow();
  } else {
    joystickHide();
  }
  held.left = held.right = held.up = held.down = false;
}

joystickZone.addEventListener('pointerdown', function(e) {
  // One pointer owns movement until it releases; another finger must not change course.
  if (joystickActive) return;
  e.preventDefault();
  joystickActive = true;
  joystickId = e.pointerId;
  if (fixedJoystickActive()) {
    // Original behavior: the circle remains in the corner and input is measured from
    // its center, not from the touch-down point.
    joystickOrigin = null;
    joystickBaseCenter = null;
    joystickShow();
  } else {
    joystickOrigin = { x: e.clientX, y: e.clientY };
    joystickBaseCenter = joystickClampBaseCenter(e.clientX, e.clientY, window.innerWidth, window.innerHeight);
    joystickSetElementCenter(joystickBase, joystickBaseCenter.x, joystickBaseCenter.y, JOYSTICK_RADIUS);
    joystickSetElementCenter(joystickThumb, joystickBaseCenter.x, joystickBaseCenter.y, JOYSTICK_THUMB_RADIUS);
    joystickShow();
  }
  // Synthetic test events have no browser-owned pointer to capture. Real touch/mouse
  // input always does, and keeps drag tracking alive after the finger leaves the zone.
  if (e.isTrusted) joystickZone.setPointerCapture(e.pointerId);
  joystickUpdate(e.clientX, e.clientY);
});
joystickZone.addEventListener('pointermove', function(e) {
  if (joystickActive && e.pointerId === joystickId) {
    e.preventDefault();
    joystickUpdate(e.clientX, e.clientY);
  }
});
joystickZone.addEventListener('pointerup', function(e) {
  if (e.pointerId === joystickId) joystickReset();
});
joystickZone.addEventListener('pointercancel', function(e) {
  if (e.pointerId === joystickId) joystickReset();
});

applyJoystickMode();

// iPad Safari can synthesize dblclick after rapid taps. Suppress that browser gesture
// only on game controls, leaving the rest of the document and pinch zoom accessible.
[document.getElementById('stage'), document.getElementById('actionBtn'), document.getElementById('bonusBtn')]
  .forEach(function(surface) {
    surface.addEventListener('dblclick', function(e) { e.preventDefault(); });
  });

// ---- Direct world taps ----
// Convert a canvas backing-store point into the world tile under it, using the same
// inverse projection and camera as the iso renderer.
function canvasBackingPointToTile(bx, by) {
  var projectedX = bx / isoScale + isoCamPX;
  var projectedY = by / isoScale + isoCamPY;
  var wx = isoInvX(projectedX, projectedY);
  var wy = isoInvY(projectedX, projectedY);
  var row = Math.floor(wy / TILE);
  var col = Math.floor(wx / TILE);
  if (row < 0 || row >= MAP_H || col < 0 || col >= MAP_W) return null;
  return { row: row, col: col };
}

function canvasClientPointToTile(clientX, clientY) {
  var rect = canvas.getBoundingClientRect();
  if (!rect.width || !rect.height) return null;
  var bx = (clientX - rect.left) * canvas.width / rect.width;
  var by = (clientY - rect.top) * canvas.height / rect.height;
  return canvasBackingPointToTile(bx, by);
}

// Tapping a tall thing (an NPC, a ready crop, a shopfront) should work anywhere on the
// part you can SEE. Sprites and prisms are drawn taller than the tile they stand on, so a
// head or body hangs over the ground behind it and a tap there used to resolve to empty
// ground (ELD-PT-005).
//
// The fix walks back down the screen from the tapped tile to find the base of whatever
// silhouette the finger actually landed on. Iso screen-y is (px+py)/2, so one step
// down-screen advances row AND col together.
//
// The tapped tile is always tried first, so a base tile beats anything overhanging it and
// two neighbours can never steal each other's taps. The search stops at TAP_REACH steps —
// far enough to cover our tallest sprite, close enough not to grab unrelated objects.
var TAP_REACH = 2;
function interactAtVisibleTile(row, col) {
  for (var step = 0; step <= TAP_REACH; step++) {
    var r = row + step, c = col + step;
    if (r >= MAP_H || c >= MAP_W) break;
    if (interactAtTile(r, c)) return true;
  }
  return false;
}

canvas.addEventListener('pointerdown', function(e) {
  var tile = canvasClientPointToTile(e.clientX, e.clientY);
  if (tile && interactAtVisibleTile(tile.row, tile.col)) e.preventDefault();
});

// ---- Action button ----
document.getElementById('actionBtn').addEventListener('pointerdown', function(e) {
  e.preventDefault();
  this.classList.add('flash');
  doAction();
  var self = this;
  setTimeout(function() { self.classList.remove('flash'); }, 150);
});

// ---- Bonus-Harvest button: opens the quick math question ----
document.getElementById('bonusBtn').addEventListener('pointerdown', function(e) {
  e.preventDefault();
  openMathBonus();
});

// ---- Keyboard controls ----
var KEY_DIR = {
  ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
  w: 'up', s: 'down', a: 'left', d: 'right'
};
window.addEventListener('keydown', function (e) {
  // While a modal is active the shared modal shell (js/01) owns the keyboard:
  // it routes Escape to that modal's safe path and traps Tab. World controls are
  // inert behind the overlay, so movement/action keys must not leak through either.
  if (activeModalId()) return;
  if (KEY_DIR[e.key]) {
    var dir = KEY_DIR[e.key];
    held[dir] = true;
    player.facing = dir;
    e.preventDefault();
  }
  // Space or E = action
  if (e.key === ' ' || e.key === 'e' || e.key === 'E') { doAction(); e.preventDefault(); }
});
window.addEventListener('keyup', function (e) {
  if (KEY_DIR[e.key]) { held[KEY_DIR[e.key]] = false; e.preventDefault(); }
});

// Unlock/resume audio on the first touch or key (browsers block audio until then).
window.addEventListener('pointerdown', ensureAudio);
window.addEventListener('keydown', ensureAudio);

// Recover audio after iPad tab/app switch — iOS suspends AudioContext on blur.
document.addEventListener('visibilitychange', function () {
  if (document.hidden || gameMuted || !gameActive) return;
  if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
  bgMusic.play().catch(function () {});
});

// ---- Start ----
refreshTitleLabels();   // show any previously-saved hero names on the title screen
updateHUD();
loop();
// Autosave the current profile every few seconds (covers walking/position changes).
setInterval(function () { if (gameActive) saveGame(); }, 3000);
