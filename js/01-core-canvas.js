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

// ---- Shared modal lifecycle (Foundation C2) ----
// ONE controller owns the DOM/accessibility lifecycle of every .modal-overlay:
// open/close presentation, focus capture + Tab trap, Escape routed to each modal's
// existing safe close/skip/flee path, background inertness, and stale-state cleanup
// when something closes a modal indirectly (profile switch, combat victory).
//
// Gameplay logic and its boolean flags (shopOpen, combatOpen, cookingOpen, ...) stay
// with their modals: the shell never decides WHETHER a modal may open, only HOW it
// presents once its owner opens it. The cooking → double-batch flow stacks two
// overlays by design, so the shell keeps a stack; only the TOP entry is active
// (focused, trapping Tab, receiving Escape) and everything beneath is inert.
var MODAL_SAFE_ESCAPE = {};    // modalId -> that modal's existing safe close path
var modalStack = [];           // ids of open overlays; the active modal is last
var _modalPriorFocus = {};     // modalId -> element to refocus when it closes

// Each modal's owner registers its safe Escape route once at load.
function registerModal(modalId, safeEscape) { MODAL_SAFE_ESCAPE[modalId] = safeEscape; }
function activeModalId() { return modalStack.length ? modalStack[modalStack.length - 1] : null; }

// Everything that must go inert behind an active modal. Overlays lower in the stack
// are handled separately in syncModalInert.
var MODAL_BACKGROUND_IDS = ['stage', 'titleScreen', 'joystickZone', 'actionBtn', 'bonusBtn'];

function setInert(el, on) {
  if (!el) return;
  // inert blocks focus/AT/clicks in modern browsers; aria-hidden is the fallback
  // for engines that don't support it yet. The full-screen overlay already blocks
  // pointer events visually either way.
  if ('inert' in el) el.inert = on;
  if (on) el.setAttribute('aria-hidden', 'true');
  else el.removeAttribute('aria-hidden');
}

function syncModalInert() {
  var active = activeModalId();
  for (var i = 0; i < MODAL_BACKGROUND_IDS.length; i++)
    setInert(document.getElementById(MODAL_BACKGROUND_IDS[i]), !!active);
  for (var s = 0; s < modalStack.length; s++)
    setInert(document.getElementById(modalStack[s]), modalStack[s] !== active);
}

// Open a registered overlay: show it, remember who had focus, move focus inside,
// and push it as the active modal.
function modalShellOpen(modalId) {
  var el = document.getElementById(modalId);
  if (!el) return;
  if (modalStack.indexOf(modalId) === -1) modalStack.push(modalId);
  _modalPriorFocus[modalId] = document.activeElement || null;
  el.classList.add('open');
  syncModalInert();
  var target = el.querySelector('button, input, textarea, [tabindex]');
  if (target && target.focus) target.focus();
}

// Close an overlay wherever it sits in the stack (covers indirect closes), then
// restore focus to whoever opened it — if that opener is still on screen.
function modalShellClose(modalId) {
  var el = document.getElementById(modalId);
  if (el) el.classList.remove('open');
  var idx = modalStack.indexOf(modalId);
  if (idx !== -1) modalStack.splice(idx, 1);
  syncModalInert();
  var prior = _modalPriorFocus[modalId];
  delete _modalPriorFocus[modalId];
  if (prior && prior.focus && document.contains(prior)) prior.focus();
}

// Close every open modal through its registered SAFE path (topmost first). Used by
// profile switching so no overlay or stack entry can outlive the world it belongs to.
function closeAllModals() {
  var guard = 0;
  while (modalStack.length && guard++ < 20) {
    var top = activeModalId();
    var esc = MODAL_SAFE_ESCAPE[top];
    if (esc) esc();
    // A broken escape path must never loop forever — force-close as a last resort.
    if (activeModalId() === top) modalShellClose(top);
  }
}

// One capture-phase listener enforces the active modal's keyboard contract:
// Tab / Shift+Tab cycle inside it, Escape follows its safe path. Other keys pass
// through untouched (typing in the Save Tools textarea must keep working).
document.addEventListener('keydown', function (e) {
  var active = activeModalId();
  if (!active) return;
  if (e.key === 'Escape') {
    e.preventDefault();
    e.stopPropagation();
    var esc = MODAL_SAFE_ESCAPE[active];
    if (esc) esc();
    return;
  }
  if (e.key !== 'Tab') return;
  var el = document.getElementById(active);
  if (!el) return;
  var nodes = el.querySelectorAll('button, input, textarea, select, a[href], [tabindex]');
  var focusables = [];
  for (var i = 0; i < nodes.length; i++) {
    if (!nodes[i].disabled && nodes[i].offsetParent !== null) focusables.push(nodes[i]);
  }
  if (!focusables.length) { e.preventDefault(); return; }
  var first = focusables[0], last = focusables[focusables.length - 1];
  var current = document.activeElement;
  if (el.contains(current)) {
    if (!e.shiftKey && current === last) { e.preventDefault(); first.focus(); }
    else if (e.shiftKey && current === first) { e.preventDefault(); last.focus(); }
  } else {
    // Focus escaped (or never entered): pull it back inside the active dialog.
    e.preventDefault();
    first.focus();
  }
}, true);

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
// iPad tuning knob: iso projection feels slower on screen, while top-down keeps the
// established player.speed. Leo may tune this without changing the shared base speed.
var ISO_SPEED_MULT = 1.5;

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

