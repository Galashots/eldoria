// ---- Mira's Guide: milestone-based onboarding (Step 7) ----
// A persistent, non-blocking objective chain that walks a brand-new player through
// the core loop: plant → harvest → use a crop → meet Mira → take a quest → reach
// the Wilds. State lives in player.onboarding (save v4, see js/06-saves.js):
//   { status: 'active' | 'skipped' | 'completed', milestones: { <id>: boolean } }
// Rules (Step 7 contract):
//   - brand-new profiles start 'active' with every milestone false;
//   - profiles migrated from v0–v3 start 'skipped' (no forced tutorial for
//     established players) — skip is permanent for that save;
//   - the visible objective is DERIVED from the first incomplete milestone in
//     ONBOARDING_MILESTONES order; no separate step index is persisted;
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
  { id: 'acceptedQuest', objective: 'Take a quest from Mira!',
    spoken: 'Mira has a quest for a brave hero. Ask her about it!' },
  { id: 'enteredWilds',  objective: 'Head right past Town into the Wilds!',
    spoken: 'You’re ready! Head right past Town into the Wilds!' }
];
var ONBOARDING_DONE_TOAST = 'You know the whole realm now — adventure awaits!';

// The first incomplete milestone (in chain order), or null when all are done.
function onboardingNextMilestone() {
  var ob = player.onboarding;
  if (!ob) return null;
  for (var i = 0; i < ONBOARDING_MILESTONES.length; i++)
    if (!ob.milestones[ONBOARDING_MILESTONES[i].id]) return ONBOARDING_MILESTONES[i];
  return null;
}

// Record one successfully-completed gameplay milestone. Idempotent: repeating an
// action records nothing new. Only an 'active' guide advances — skipped and
// completed saves ignore every call. Persists immediately through the normal save.
function recordOnboardingMilestone(id) {
  if (!gameActive || !currentProfile) return;
  var ob = player.onboarding;
  if (!ob || ob.status !== 'active') return;
  if (!(id in ob.milestones) || ob.milestones[id]) return;
  ob.milestones[id] = true;

  var next = onboardingNextMilestone();
  if (!next) {
    ob.status = 'completed';
    soundWin();
    showToast(ONBOARDING_DONE_TOAST);
    speak(ONBOARDING_DONE_TOAST);
  } else {
    speak(next.spoken);
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

function toggleOnboardingChip() {
  onboardingChipCollapsed = !onboardingChipCollapsed;
  onboardingChipLast = '';     // force a repaint with the new collapse state
  updateOnboardingChip();
}

function updateOnboardingChip() {
  var el = document.getElementById('onboardingChip');
  if (!el) return;
  // Anchor just below the real rendered HUD: on narrow screens the HUD wraps to
  // two rows, and a fixed offset would cover its Hero/Switch buttons.
  var hud = document.querySelector('.hud');
  if (hud) {
    var top = (hud.offsetTop + hud.offsetHeight + 4) + 'px';
    if (el.style.top !== top) el.style.top = top;
  }
  var ob = (gameActive && currentProfile) ? player.onboarding : null;
  var active = !!(ob && ob.status === 'active' && !combatOpen);
  var next = active ? onboardingNextMilestone() : null;
  var text = '';
  if (active && next) {
    text = onboardingChipCollapsed ? '🧭' : '🧭 Mira’s Guide: ' + next.objective;
  }
  var key = (active && next) ? (text + '|' + next.id) : '';
  if (key === onboardingChipLast) return;
  onboardingChipLast = key;
  if (active && next) {
    el.textContent = text;
    el.classList.toggle('collapsed', onboardingChipCollapsed);
    el.setAttribute('aria-label', onboardingChipCollapsed
      ? 'Show Mira’s Guide objective' : 'Hide Mira’s Guide objective');
    el.hidden = false;
  } else {
    el.hidden = true;
  }
}
