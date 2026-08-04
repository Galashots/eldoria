// ---- Mira's Guide: milestone-based onboarding (Step 7) ----
// A persistent, non-blocking objective chain that walks a brand-new player through
// the core loop: plant → harvest → use a crop → meet Mira and receive a quest →
// reach the Wilds. State lives in player.onboarding (save v4, see js/06-saves.js):
//   { status: 'active' | 'skipped' | 'completed', milestones: { <id>: boolean } }
// Rules (Step 7 contract):
//   - brand-new profiles start 'active' with every milestone false;
//   - profiles migrated from v0–v3 start 'skipped' (no forced tutorial for
//     established players) — skip is permanent for that save;
//   - the visible objective is DERIVED from the first incomplete visible milestone
//     in ONBOARDING_MILESTONES order; Mira's real interaction completes metMira and
//     acceptedQuest together, so the visible chain has five objectives while the
//     persisted progress indicator remains six milestones;
//   - milestones may record out of order (a child who sells a crop before ever
//     talking to Mira is never asked to repeat something already done);
//   - when every milestone is true the status becomes 'completed'.
// Progress records ONLY from the existing successful gameplay paths (plantSeed,
// the harvest branch, sellCrops/cookRecipe, openQuest, checkTravel) via a single
// explicit call — recordOnboardingMilestone('<id>') — never by monkey-patching.

// Ordered milestone chain. `objective` is the chip text for the NEXT thing to do;
// each line is short and child-readable. `spoken` is what the voice path reads
// aloud when the objective advances (same speak() conventions as quests: the
// early-reader Mage slot hears it, the Ranger reads it).
var ONBOARDING_MILESTONES = [
  { id: 'planted',       objective: 'Plant a seed in the soft soil!',
    spoken: 'Tap a soil plot to plant your first seed!' },
  { id: 'harvested',     objective: 'Harvest your crop when it’s ready!',
    spoken: 'Your crop is growing! Harvest it when it’s ready!' },
  { id: 'usedCrop',      objective: 'Sell a crop at the store — or cook it!',
    spoken: 'Great harvest! Sell your crop at the store, or cook it in the pot!' },
  { id: 'metMira',       objective: 'Walk right to Town and talk to Mira!',
    spoken: 'Walk right along the road to Town and say hello to Mira!' },
  // acceptedQuest remains persisted for save compatibility but is completed by the
  // same real Mira interaction as metMira. It is never rendered as a standalone step.
  { id: 'acceptedQuest', objective: '', spoken: '' },
  { id: 'enteredWilds',  objective: 'Head right past Town into the Wilds!',
    spoken: 'You’re ready! Head right past Town into the Wilds!' }
];
var ONBOARDING_DONE_TOAST = 'You know the whole realm now — adventure awaits!';
var ONBOARDING_MIRA_TOAST = 'Mira gave you a quest! Head into the Wilds!';
var ONBOARDING_MIRA_SPOKEN = 'Mira gave you a quest! Head into the Wilds!';
var onboardingMiraNarrationDeferred = false;
var onboardingMiraNarrationPending = false;

// The first incomplete visible milestone (in chain order), or null when all are done.
function onboardingNextMilestone() {
  var ob = player.onboarding;
  if (!ob) return null;
  for (var i = 0; i < ONBOARDING_MILESTONES.length; i++)
    if (ONBOARDING_MILESTONES[i].objective && !ob.milestones[ONBOARDING_MILESTONES[i].id])
      return ONBOARDING_MILESTONES[i];
  return null;
}

function onboardingProgressCount() {
  var ob = player.onboarding;
  if (!ob) return 0;
  var count = 0;
  for (var i = 0; i < ONBOARDING_MILESTONES.length; i++)
    if (ob.milestones[ONBOARDING_MILESTONES[i].id]) count++;
  return count;
}

function onboardingObjectiveId() {
  var next = onboardingNextMilestone();
  return next ? next.id : 'done';
}

function onboardingAreaName(area) {
  var names = {
    farm: 'the Farm', town: 'Town', wilds: 'the Wilds',
    deepwoods: 'the Deep Woods', mine: 'the Mine'
  };
  return names[area] || area;
}

function onboardingObjectiveArea(next) {
  if (!next) return null;
  if (next.id === 'planted' || next.id === 'harvested' || next.id === 'usedCrop') return 'farm';
  if (next.id === 'metMira') return 'town';
  if (next.id === 'enteredWilds') return 'wilds';
  return null;
}

function onboardingNativeTargetAvailable(next) {
  if (!next) return false;
  if ((next.id === 'planted' || next.id === 'harvested') && currentArea === 'farm') return true;
  if (next.id === 'usedCrop' && (currentArea === 'farm' || currentArea === 'town')) return true;
  if (next.id === 'metMira' && (currentArea === 'farm' || currentArea === 'town')) return true;
  if (next.id === 'enteredWilds' && currentArea === 'town') return true;
  return false;
}

// Use the same linear adjacency source as checkTravel in js/07-hud-movement.js.
// This is presentation-only: the overlay never changes the travel or collision rules.
function onboardingRoutePresentation(next) {
  var objectiveArea = onboardingObjectiveArea(next);
  var currentIndex = AREA_ORDER.indexOf(currentArea);
  var objectiveIndex = AREA_ORDER.indexOf(objectiveArea);
  if (!objectiveArea || onboardingNativeTargetAvailable(next) || currentArea === objectiveArea ||
      currentIndex < 0 || objectiveIndex < 0)
    return null;
  var direction = objectiveIndex < currentIndex ? 'left' : 'right';
  var nextHop = AREA_ORDER[currentIndex + (direction === 'left' ? -1 : 1)];
  if (!nextHop) return null;
  var destination = onboardingAreaName(nextHop);
  return {
    objective: 'Head ' + direction + ' to ' + destination + '!',
    spoken: 'Head ' + direction + ' to ' + destination + '!',
    direction: direction,
    nextHop: nextHop
  };
}

function onboardingObjectivePresentation(next) {
  return onboardingRoutePresentation(next) || { objective: next.objective, spoken: next.spoken };
}

function onboardingObjectiveLabel(next, presentation) {
  var view = presentation || onboardingObjectivePresentation(next);
  return '🧭 Mira’s Guide: ' + view.objective;
}

function onboardingDeferMiraNarration() {
  onboardingMiraNarrationDeferred = true;
}

function onboardingFlushMiraNarration(queued) {
  var pending = onboardingMiraNarrationPending;
  onboardingMiraNarrationDeferred = false;
  onboardingMiraNarrationPending = false;
  if (pending) {
    showToast(ONBOARDING_MIRA_TOAST);
    if (queued) speakQueued(ONBOARDING_MIRA_SPOKEN);
    else speak(ONBOARDING_MIRA_SPOKEN);
  }
}

// Record one successfully-completed gameplay milestone. Idempotent: repeating an
// action records nothing new. Only an 'active' guide advances — skipped and
// completed saves ignore every call. Persists immediately through the normal save.
function recordOnboardingMilestone(id) {
  if (!gameActive || !currentProfile) return;
  var ob = player.onboarding;
  if (!ob || ob.status !== 'active') return;
  if (!(id in ob.milestones) || ob.milestones[id]) return;
  var beforeObjective = onboardingObjectiveId();
  ob.milestones[id] = true;

  // Planner ruling: there is no separate accept-quest interaction. The real Mira
  // interaction completes both persisted milestones in one synchronous transition.
  if (id === 'metMira') ob.milestones.acceptedQuest = true;

  var next = onboardingNextMilestone();
  if (!next) {
    ob.status = 'completed';
  }
  var afterObjective = onboardingObjectiveId();
  if (beforeObjective !== afterObjective) {
    if (id === 'metMira') {
      if (onboardingMiraNarrationDeferred) onboardingMiraNarrationPending = true;
      else {
        showToast(ONBOARDING_MIRA_TOAST);
        speak(ONBOARDING_MIRA_SPOKEN);
      }
    } else if (!next) {
      soundWin();
      showToast(ONBOARDING_DONE_TOAST);
      speak(ONBOARDING_DONE_TOAST);
    } else {
      var presentation = onboardingObjectivePresentation(next);
      showToast(presentation.objective);
      speak(presentation.spoken);
    }
  }
  updateOnboardingChip();
  saveGame();
}

// ---- The Mira's Guide chip ----
// One compact HUD chip (never a modal). Tapping it collapses it to a small compass
// badge for kids who want the screen clear; tapping again expands it. Collapse is
// session-only UI state, not save state. The chip hides completely during combat
// so it can never contend with the slash window on iPad, and hides whenever the
// guide is not actively running (title screen, skipped, completed).
var onboardingChipCollapsed = false;
var onboardingChipLast = '';   // cache: skip DOM writes when nothing changed
var onboardingSkipArmed = false;
var onboardingSkipTimer = null;

function toggleOnboardingChip() {
  onboardingChipCollapsed = !onboardingChipCollapsed;
  onboardingChipLast = '';     // force a repaint with the new collapse state
  updateOnboardingChip();
  var focusId = onboardingChipCollapsed ? 'onboardingCompass' : 'onboardingChip';
  var focusEl = document.getElementById(focusId);
  if (focusEl) focusEl.focus();
}

function updateOnboardingChip() {
  var panel = document.getElementById('onboardingGuide');
  var el = document.getElementById('onboardingChip');
  var compass = document.getElementById('onboardingCompass');
  var speakBtn = document.getElementById('onboardingSpeak');
  var skipBtn = document.getElementById('onboardingSkip');
  if (!panel || !el || !compass || !speakBtn || !skipBtn) return;
  // Anchor just below the real rendered HUD: on narrow screens the HUD wraps to
  // two rows, and a fixed offset would cover its Hero/Switch buttons.
  var hud = document.querySelector('.hud');
  if (hud) {
    var top = (hud.offsetTop + hud.offsetHeight + 4) + 'px';
    if (panel.style.top !== top) panel.style.top = top;
  }
  var ob = (gameActive && currentProfile) ? player.onboarding : null;
  var active = !!(ob && ob.status === 'active' && !combatOpen);
  var next = active ? onboardingNextMilestone() : null;
  var presentation = active && next ? onboardingObjectivePresentation(next) : null;
  var text = active && next ? onboardingObjectiveLabel(next, presentation) : '';
  var key = (active && next) ? (text + '|' + next.id + '|' + onboardingProgressCount() +
    '|' + onboardingChipCollapsed + '|' + onboardingSkipArmed) : 'inactive';
  if (key === onboardingChipLast) return;
  onboardingChipLast = key;
  if (active && next) {
    panel.hidden = false;
    el.innerHTML = '<span class="onboarding-title"></span><span class="onboarding-progress"></span>';
    el.querySelector('.onboarding-title').textContent = text;
    el.querySelector('.onboarding-progress').textContent = onboardingProgressCount() + ' of 6';
    el.hidden = onboardingChipCollapsed;
    compass.hidden = !onboardingChipCollapsed;
    speakBtn.hidden = onboardingChipCollapsed;
    skipBtn.hidden = onboardingChipCollapsed;
    el.setAttribute('aria-label', 'Hide Mira’s Guide objective');
    compass.setAttribute('aria-label', 'Show Mira’s Guide objective');
    speakBtn.setAttribute('aria-label', 'Read aloud: ' + presentation.objective);
    skipBtn.textContent = onboardingSkipArmed ? 'Tap again to skip' : 'Skip';
    skipBtn.classList.toggle('armed', onboardingSkipArmed);
  } else {
    panel.hidden = true;
    el.hidden = true;
    compass.hidden = true;
    speakBtn.hidden = true;
    skipBtn.hidden = true;
  }
}

function onboardingReadAloud(event) {
  if (event) event.stopPropagation();
  var next = onboardingNextMilestone();
  if (!next || !player.onboarding || player.onboarding.status !== 'active') return;
  speakToAll(onboardingObjectiveLabel(next));
}

function onboardingSkipPressed(event) {
  if (event) event.stopPropagation();
  if (!player.onboarding || player.onboarding.status !== 'active') return;
  if (!onboardingSkipArmed) {
    onboardingSkipArmed = true;
    clearTimeout(onboardingSkipTimer);
    onboardingSkipTimer = setTimeout(function () {
      onboardingSkipArmed = false;
      onboardingChipLast = '';
      updateOnboardingChip();
    }, 2500);
    onboardingChipLast = '';
    updateOnboardingChip();
    var skipBtn = document.getElementById('onboardingSkip');
    if (skipBtn) skipBtn.focus();
    return;
  }
  clearTimeout(onboardingSkipTimer);
  onboardingSkipArmed = false;
  player.onboarding.status = 'skipped';
  saveGame();
  onboardingChipLast = '';
  updateOnboardingChip();
  var action = document.getElementById('actionBtn');
  if (action) action.focus();
}

// ---- Mira's Guide world highlights ----
// This is deliberately a draw-only overlay. It never changes collision, reach,
// interaction dispatch, or travel rules. The existing top-down and iso renderers
// call it once after their world pass, using their established pulse/arrow language.
function onboardingHighlightTargets() {
  var next = onboardingNextMilestone();
  if (combatOpen || !next || !player.onboarding || player.onboarding.status !== 'active') return [];
  var targets = [];
  var objectiveArea = onboardingObjectiveArea(next);
  if (!onboardingNativeTargetAvailable(next) && objectiveArea && currentArea !== objectiveArea) {
    var routeTarget = onboardingRouteTargetToward(objectiveArea);
    if (routeTarget) return [routeTarget];
  }
  var addNearestCrop = function (predicate) {
    var best = null, bestDist = Infinity;
    for (var key in cropData) {
      var crop = cropData[key];
      if (!predicate(crop)) continue;
      var parts = key.split(','), row = parseInt(parts[0], 10), col = parseInt(parts[1], 10);
      var dx = col * TILE + TILE / 2 - (player.x + player.size / 2);
      var dy = row * TILE + TILE / 2 - (player.y + player.size / 2);
      var dist = dx * dx + dy * dy;
      if (dist < bestDist) { bestDist = dist; best = { row: row, col: col }; }
    }
    if (best) targets.push(best);
  };
  if (next.id === 'planted' && currentArea === 'farm') addNearestCrop(function (c) { return c.status === 'empty'; });
  else if (next.id === 'harvested' && currentArea === 'farm') addNearestCrop(function (c) {
    return c.status === 'growing' || c.status === 'ready';
  });
  else if (next.id === 'usedCrop') {
    if (currentArea === 'farm') targets.push({ row: FARM_COOKPOT.row, col: FARM_COOKPOT.col, label: 'cookpot' });
    if (currentArea === 'town') {
      for (var r = 0; r < MAP_H; r++) for (var c = 0; c < MAP_W; c++)
        if (map[r][c] === DOOR) targets.push({ row: r, col: c, label: 'store' });
    }
  } else if (next.id === 'metMira') {
    if (currentArea === 'farm') targets.push(onboardingRightExitTarget());
    else if (currentArea === 'town') {
      var mira = NPCS.filter(function (n) { return n.id === 'mira'; })[0];
      if (mira) targets.push({ row: mira.row, col: mira.col, label: 'Mira' });
    }
  } else if (next.id === 'enteredWilds' && currentArea === 'town') {
    targets.push(onboardingRightExitTarget());
  }
  return targets.filter(Boolean);
}

function onboardingRightExitTarget() {
  return onboardingEdgeExitTarget('right', 'exit');
}

function onboardingEdgeExitTarget(direction, label) {
  var col = direction === 'left' ? 0 : MAP_W - 1;
  for (var r = 0; r < MAP_H; r++)
    if (map[r][col] === EXIT)
      return { row: r, col: col, label: label || 'route', direction: direction };
  return null;
}

function onboardingRouteTargetToward(objectiveArea) {
  var currentIndex = AREA_ORDER.indexOf(currentArea);
  var objectiveIndex = AREA_ORDER.indexOf(objectiveArea);
  if (currentIndex < 0 || objectiveIndex < 0 || currentIndex === objectiveIndex) return null;
  var direction = objectiveIndex < currentIndex ? 'left' : 'right';
  // Keep the original semantic label for the Town → Wilds onboarding exit.
  var label = (currentArea === 'town' && objectiveArea === 'wilds') ? 'exit' : 'route';
  return onboardingEdgeExitTarget(direction, label);
}

function drawOnboardingWorldHighlight(now) {
  if (!gameActive || !currentProfile || combatOpen) return;
  var targets = onboardingHighlightTargets();
  if (!targets.length) return;
  var pulse = 0.45 + 0.55 * Math.abs(Math.sin(now / 260));
  var isIso = typeof isoActive === 'function' && isoActive();
  ctx.save();
  ctx.strokeStyle = 'rgba(255, 232, 146,' + pulse + ')';
  ctx.fillStyle = 'rgba(255, 232, 146,' + (0.12 + pulse * 0.12) + ')';
  ctx.lineWidth = isIso ? 2.5 : 3;
  for (var i = 0; i < targets.length; i++) {
    var t = targets[i];
    var wx = (t.col + 0.5) * TILE, wy = (t.row + 0.5) * TILE;
    if (isIso) {
      var cx = isoPX(wx, wy), cy = isoPY(wx, wy);
      drawIsoDiamondAt(cx, cy, ISO_TW / 2 + 4, ISO_TH / 2 + 4, 'rgba(255,232,146,' + (0.08 + pulse * 0.08) + ')');
      ctx.strokeStyle = 'rgba(255,232,146,' + pulse + ')';
      ctx.beginPath(); ctx.moveTo(cx, cy - ISO_TH / 2 - 4); ctx.lineTo(cx + ISO_TW / 2 + 4, cy);
      ctx.lineTo(cx, cy + ISO_TH / 2 + 4); ctx.lineTo(cx - ISO_TW / 2 - 4, cy); ctx.closePath(); ctx.stroke();
      drawArrow(cx, cy - ISO_TH / 2 - 16 - Math.sin(now / 220) * 3, 7, 'down', '#fff2b0');
    } else {
      var camera = topDownCamera();
      var sx = t.col * TILE - camera.x, sy = t.row * TILE - camera.y;
      ctx.fillRect(sx + 2, sy + 2, TILE - 4, TILE - 4);
      ctx.strokeRect(sx + 1.5, sy + 1.5, TILE - 3, TILE - 3);
      drawArrow(sx + TILE / 2, sy - 5 - Math.sin(now / 220) * 3, 7, 'down', '#fff2b0');
    }
  }
  ctx.restore();
}
