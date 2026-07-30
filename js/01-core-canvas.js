var canvas = document.getElementById('game');
var ctx = canvas.getContext('2d');

// ---- Responsive canvas (iso only; spec section 5b) ----
// Same vertical field of view on every device: TARGET_VIEW_ROWS world rows always fit
// vertically, so a phone simply sees fewer columns than the iPad. Legacy top-down mode
// keeps its original fixed 640x480 store untouched.
var isoScale = 1, isoCamW = 0, isoCamH = 0;
function applyCanvasMode() {
  if (typeof isoActive === 'function' && isoActive()) {
    canvas.classList.add('iso-mode');
    var rect = canvas.getBoundingClientRect();
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var cssW = rect.width || 640, cssH = rect.height || 480;
    canvas.width = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);
    // Projected px per world row is TILE/2; fit TARGET_VIEW_ROWS of them into the css height.
    isoScale = (cssH / (TARGET_VIEW_ROWS * TILE / 2)) * dpr;
    isoCamW = canvas.width / isoScale;
    isoCamH = canvas.height / isoScale;
    // Resizing the backing store resets context state — keep pixel art crisp.
    ctx.imageSmoothingEnabled = false;
  } else {
    canvas.classList.remove('iso-mode');
    if (canvas.width !== 640) canvas.width = 640;
    if (canvas.height !== 480) canvas.height = 480;
  }
}
window.addEventListener('resize', applyCanvasMode);
window.addEventListener('orientationchange', applyCanvasMode);
// Crisp pixel art: never bilinear-smooth our 32px sprites when drawImage scales/samples.
// (CSS image-rendering: pixelated only governs the final CSS upscale, not canvas sampling.)
ctx.imageSmoothingEnabled = false;
ctx.mozImageSmoothingEnabled = false;
ctx.webkitImageSmoothingEnabled = false;

// Focus management for modals: move focus into the dialog on open, restore on close.
var _priorFocus = null;
function focusModal(modalId) {
  _priorFocus = document.activeElement || null;
  var el = document.getElementById(modalId);
  if (el && el.querySelector) {
    var target = el.querySelector('button, input, textarea, [tabindex]');
    if (target && target.focus) target.focus();
  }
}
function restoreFocus() {
  if (_priorFocus && _priorFocus.focus) _priorFocus.focus();
  _priorFocus = null;
}

var TILE = 32;
var MAP_W = 30;
var MAP_H = 22;

// ---- Iso math (Phase 0) ----
// True 2:1 isometric as a RENDER-ONLY transform over the unchanged world space.
// See docs/superpowers/specs/2026-07-27-isometric-conversion-design.md (sections 5, 5b, 6).
var ISO_TW = 64, ISO_TH = 32;            // ground diamond size in projected px
var ISO_X_OFF = MAP_H * TILE;            // shifts projected x non-negative (704)
var TARGET_VIEW_ROWS = 18;               // vertical FOV in world rows — the ONE zoom knob
                                         // (14 felt zoomed-in on Leo's phone, 2026-07-27)

function isoPX(px, py) { return (px - py) + ISO_X_OFF; }
function isoPY(px, py) { return (px + py) / 2; }
function isoInvX(sx, sy) { return sy + (sx - ISO_X_OFF) / 2; }
function isoInvY(sx, sy) { return sy - (sx - ISO_X_OFF) / 2; }
// Screen-relative joystick: screen vector -> world vector (inverse projection, offset-free).
function isoInputX(jx, jy) { return jy + jx / 2; }
function isoInputY(jx, jy) { return jy - jx / 2; }
// Painter's-algorithm sort key: larger = nearer the viewer, drawn later.
function isoDepthKey(px, py) { return px + py; }

// Test hook: run the movement step N times with a fixed joystick vector. Used only by
// tools/iso-test.mjs; harmless in play (nothing calls it). Mirrors the live movement
// block's iso transform exactly.
function __isoTestMove(jx, jy, frames) {
  for (var i = 0; i < frames; i++) {
    var dx = jx, dy = jy;
    if (isoActive() && (dx !== 0 || dy !== 0)) {
      var wx = isoInputX(dx, dy), wy = isoInputY(dx, dy);
      var wl = Math.sqrt(wx * wx + wy * wy);
      dx = wx / wl; dy = wy / wl;
    }
    dx *= 2; dy *= 2;   // 2 px/frame, matching the walk speed order of magnitude
    if (dx !== 0 && !boxIsBlocked(player.x + dx, player.y)) player.x += dx;
    if (dy !== 0 && !boxIsBlocked(player.x, player.y + dy)) player.y += dy;
  }
}

