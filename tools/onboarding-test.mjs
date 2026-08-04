// Acceptance tests for Step 7 — Mira's Guide onboarding (save v4):
//   - state & migration: fresh profiles start 'active'; every v0–v3 fixture
//     migrates deterministically to v4 with the guide 'skipped'; malformed
//     onboarding blocks are rejected; canonical state survives save/reload,
//     export/import, and profile isolation; SAVE_VERSION is exactly 4
//   - progress behavior: each successful gameplay verb records its milestone,
//     failed actions record nothing, repeats are idempotent, out-of-order
//     actions never require repetition, sell and cook both satisfy usedCrop,
//     entering the Wilds completes the chain
//   - chip UI: the derived objective renders, collapses, hides during combat,
//     and disappears for skipped/completed saves
// Run: node tools/onboarding-test.mjs
import { launch } from './smoke-test.mjs';

const fails = [];
const check = (name, ok) => { console.log((ok ? 'PASS ' : 'FAIL ') + name); if (!ok) fails.push(name); };

// --- State & migration ---
{
  const { browser, page } = await launch();
  const r = await page.evaluate(() => {
    localStorage.clear();
    var out = {};
    var IDS = ONBOARDING_MILESTONE_IDS;

    // (1) A brand-new profile starts 'active' with every milestone false at Plant.
    selectProfile('adventurer');
    var ob = player.onboarding;
    out.freshActive = ob.status === 'active' &&
      IDS.every(function (id) { return ob.milestones[id] === false; }) &&
      onboardingNextMilestone().id === 'planted';

    // (2) Every v0–v3 fixture migrates deterministically to v4 with the guide
    // 'skipped' and all milestones false.
    var fixtures = [
      { gold: 33, seeds: 3 },                                             // v0 flat
      { gold: 44, farmTiles: { '4,15': { status: 'ready', plantedAt: 1, type: 'corn' } } }, // v1
      { version: 2, player: { gold: 55 }, areas: {} },                    // v2
      { version: 3, player: { gold: 66 }, areas: {} }                     // v3
    ];
    out.migratedSkipped = fixtures.every(function (s) {
      var res = ingestSaveObject(s);
      return res.ok && res.state.version === 4 &&
        res.state.player.onboarding.status === 'skipped' &&
        IDS.every(function (id) { return res.state.player.onboarding.milestones[id] === false; });
    });

    // (3) A valid v4 block round-trips exactly; missing milestone keys default false.
    var v4 = { version: 4, player: { onboarding: { status: 'active',
      milestones: { planted: true, harvested: true } } }, areas: {} };
    var rv4 = ingestSaveObject(v4);
    out.v4Preserved = rv4.ok && rv4.state.player.onboarding.status === 'active' &&
      rv4.state.player.onboarding.milestones.planted === true &&
      rv4.state.player.onboarding.milestones.harvested === true &&
      rv4.state.player.onboarding.milestones.usedCrop === false;

    // (4) Malformed onboarding blocks are rejected, never defaulted.
    out.rejects = [
      { version: 4, player: { onboarding: 'yes' }, areas: {} },
      { version: 4, player: { onboarding: { status: 'later', milestones: {} } }, areas: {} },
      { version: 4, player: { onboarding: { status: 'active' } }, areas: {} },
      { version: 4, player: { onboarding: { status: 'active', milestones: { planted: 'yep' } } }, areas: {} },
      { version: 4, player: { onboarding: { status: 'active', milestones: { flying: true } } }, areas: {} }
    ].map(function (s) { return ingestSaveObject(s).ok === false; });

    // (5) Active, skipped, and completed states survive canonical re-ingestion.
    out.statusesSurvive = ['active', 'skipped', 'completed'].every(function (st) {
      var res = ingestSaveObject({ version: 4,
        player: { onboarding: { status: st, milestones: {} } }, areas: {} });
      var re = ingestSaveText(res.canonicalText);
      return res.ok && re.ok && re.state.player.onboarding.status === st &&
        JSON.stringify(re.state) === JSON.stringify(res.state);
    });

    // (6) Save/reload preserves recorded progress for the active profile.
    recordOnboardingMilestone('planted');
    saveGame();
    applyState(loadGame('adventurer'));
    out.reloadKeepsProgress = player.onboarding.status === 'active' &&
      player.onboarding.milestones.planted === true &&
      player.onboarding.milestones.harvested === false;

    // (7) Profiles are isolated: Adventurer's progress never touches Mage.
    switchProfile();
    selectProfile('mage');
    out.profileIsolated = player.onboarding.status === 'active' &&
      player.onboarding.milestones.planted === false;
    switchProfile();

    // (8) SAVE_VERSION is exactly 4 and the stored save says so.
    selectProfile('adventurer');
    saveGame();
    out.version4 = SAVE_VERSION === 4 &&
      JSON.parse(localStorage.getItem('eldoria_save_adventurer')).version === 4;
    switchProfile();
    localStorage.clear();
    return out;
  });
  check('ONB-STATE: fresh profile starts active at Plant', r.freshActive);
  check('ONB-STATE: every v0-v3 fixture migrates to v4 with the guide skipped', r.migratedSkipped);
  check('ONB-STATE: a valid v4 block round-trips, missing milestones default false', r.v4Preserved);
  check('ONB-STATE: malformed onboarding blocks are rejected', r.rejects.every(Boolean));
  check('ONB-STATE: active/skipped/completed all survive canonical re-ingestion', r.statusesSurvive);
  check('ONB-STATE: save/reload preserves recorded progress', r.reloadKeepsProgress);
  check('ONB-STATE: onboarding progress is profile-isolated', r.profileIsolated);
  check('ONB-STATE: SAVE_VERSION is exactly 4, stored saves carry it', r.version4);
  await browser.close();
}

// --- Progress behavior through the real gameplay verbs ---
{
  const { browser, page } = await launch();
  const r = await page.evaluate(() => {
    localStorage.clear();
    var out = {};
    selectProfile('adventurer');
    var ms = function () { return player.onboarding.milestones; };

    // (1) Planting through the real path records 'planted'; a failed plant
    // (no seeds) records nothing.
    player.seeds = { turnip: 0, carrot: 0, corn: 0, pumpkin: 0, starfruit: 0 };
    interactCropTile({ row: 3, col: 14 });          // "No seeds!" — must not record
    out.failedPlantNothing = ms().planted === false;
    player.seeds.turnip = 2;
    interactCropTile({ row: 3, col: 14 });          // real plant (single seed type)
    out.planted = ms().planted === true && onboardingNextMilestone().id === 'harvested';

    // (2) Harvesting the ready crop records 'harvested'.
    cropData['3,14'].plantedAt = Date.now() - 999999;
    updateCrops();
    interactCropTile({ row: 3, col: 14 });          // real harvest
    out.harvested = ms().harvested === true && player.crops.turnip === 1;

    // (3) An empty sell records nothing; a real sale records 'usedCrop'.
    var cropsNow = player.crops.turnip;
    player.crops.turnip = 0;
    sellCrops();                                     // guard: totalCrops()===0 → no-op
    out.emptySellNothing = ms().usedCrop === false;
    player.crops.turnip = cropsNow;
    sellCrops();
    out.usedCropSell = ms().usedCrop === true;

    // (4) Repeating actions is idempotent: nothing un-records, nothing double-fires.
    var snapshot = JSON.stringify(player.onboarding);
    player.seeds.turnip = 1;
    interactCropTile({ row: 4, col: 15 });          // plant again
    out.idempotent = JSON.stringify(player.onboarding) === snapshot;

    // (5) Meeting Mira through the real interaction records 'metMira' and the
    // quest offer inside it records 'acceptedQuest'.
    var mira = NPCS.filter(function (n) { return n.id === 'mira'; })[0];
    activateArea('town');
    player.x = mira.col * TILE; player.y = (mira.row + 1) * TILE;  // stand adjacent
    interactNPC(mira);
    out.metMira = ms().metMira === true;
    out.acceptedQuest = ms().acceptedQuest === true && player.killQuest !== null;
    closeQuest();

    // (6) Entering the Wilds through the real travel system completes the chain
    // exactly once, flipping status to 'completed'.
    activateArea('town');
    var exitRow = 9;
    for (var sr = 0; sr < MAP_H; sr++) { if (areas.town.map[sr][MAP_W - 1] === EXIT) { exitRow = sr; break; } }
    player.x = (MAP_W - 1) * TILE; player.y = exitRow * TILE;
    checkTravel();
    out.enteredWilds = currentArea === 'wilds' && ms().enteredWilds === true;
    out.completed = player.onboarding.status === 'completed';

    // (7) A completed guide ignores further recording and stays completed on reload.
    recordOnboardingMilestone('planted');
    out.completedInert = player.onboarding.status === 'completed';
    saveGame();
    applyState(loadGame('adventurer'));
    out.completedPersists = player.onboarding.status === 'completed';

    // (8) Out-of-order: a fresh profile that sells first is never asked to repeat it.
    switchProfile();
    localStorage.clear();
    selectProfile('mage');
    player.crops.turnip = 3;
    sellCrops();
    out.outOfOrder = player.onboarding.milestones.usedCrop === true &&
      player.onboarding.status === 'active' &&
      onboardingNextMilestone().id === 'planted';   // derived objective, no step index

    // (9) A skipped guide records nothing through the same real verbs.
    player.onboarding = defaultOnboarding('skipped');
    player.seeds.turnip = 1;
    interactCropTile({ row: 3, col: 14 });
    out.skippedInert = player.onboarding.status === 'skipped' &&
      player.onboarding.milestones.planted === false;
    switchProfile();
    localStorage.clear();
    return out;
  });
  check('ONB-PLAY: failed plant records nothing', r.failedPlantNothing);
  check('ONB-PLAY: real plant records planted', r.planted);
  check('ONB-PLAY: real harvest records harvested', r.harvested);
  check('ONB-PLAY: empty sell records nothing', r.emptySellNothing);
  check('ONB-PLAY: real sale records usedCrop', r.usedCropSell);
  check('ONB-PLAY: repeated actions are idempotent', r.idempotent);
  check('ONB-PLAY: meeting Mira records metMira', r.metMira);
  check('ONB-PLAY: Mira\'s quest offer records acceptedQuest', r.acceptedQuest);
  check('ONB-PLAY: entering the Wilds records enteredWilds', r.enteredWilds);
  check('ONB-PLAY: all milestones true flips status to completed', r.completed);
  check('ONB-PLAY: a completed guide ignores further recording', r.completedInert);
  check('ONB-PLAY: completed status survives save/reload', r.completedPersists);
  check('ONB-PLAY: out-of-order progress is kept, objective stays derived', r.outOfOrder);
  check('ONB-PLAY: a skipped guide records nothing', r.skippedInert);
  await browser.close();
}

// --- Cooking satisfies usedCrop the same as selling ---
{
  const { browser, page } = await launch();
  const r = await page.evaluate(() => {
    localStorage.clear();
    var out = {};
    selectProfile('adventurer');
    // veggie_soup costs 2 turnips (see RECIPES); cook it through the real path.
    player.crops.turnip = RECIPES.veggie_soup.cost.turnip;
    cookRecipe('veggie_soup');
    out.usedCropCook = player.onboarding.milestones.usedCrop === true &&
      player.food.veggie_soup >= 1;
    modalShellClose('doubleBatchModal');   // dismiss the bonus question it opened
    // A failed cook (no crops) records nothing on a fresh block.
    player.onboarding = defaultOnboarding('active');
    player.crops.turnip = 0;
    cookRecipe('veggie_soup');             // canCook fails → no-op
    out.failedCookNothing = player.onboarding.milestones.usedCrop === false;
    switchProfile();
    localStorage.clear();
    return out;
  });
  check('ONB-COOK: successful cooking records usedCrop', r.usedCropCook);
  check('ONB-COOK: failed cooking records nothing', r.failedCookNothing);
  await browser.close();
}

// --- Chip UI: derived objective, collapse, combat hiding, terminal states ---
{
  const { browser, page } = await launch();
  const r = await page.evaluate(() => {
    localStorage.clear();
    var out = {};
    var chip = document.getElementById('onboardingChip');

    // Hidden on the title screen, visible with the first derived objective in play.
    out.hiddenOnTitle = chip.hidden === true;
    selectProfile('adventurer');
    updateOnboardingChip();
    out.showsFirstObjective = chip.hidden === false &&
      chip.textContent.indexOf('Mira’s Guide') >= 0 &&
      chip.textContent.indexOf(ONBOARDING_MILESTONES[0].objective) >= 0;

    // The chip text advances with the derived objective.
    recordOnboardingMilestone('planted');
    out.advances = chip.textContent.indexOf(ONBOARDING_MILESTONES[1].objective) >= 0;

    // Collapse: tap → compass badge only; tap again → full objective.
    toggleOnboardingChip();
    out.collapses = chip.hidden === false && chip.classList.contains('collapsed') &&
      chip.textContent === '🧭';
    toggleOnboardingChip();
    out.expands = !chip.classList.contains('collapsed') &&
      chip.textContent.indexOf(ONBOARDING_MILESTONES[1].objective) >= 0;

    // Combat: opening a battle hides the chip on the next tick; closing restores it.
    activateArea('wilds');
    openCombat(currentEnemies[0]);
    update();
    out.hiddenInCombat = chip.hidden === true;
    fleeCombat();
    update();
    out.backAfterCombat = chip.hidden === false;

    // Completed and skipped guides both remove the chip.
    for (var i = 0; i < ONBOARDING_MILESTONE_IDS.length; i++)
      recordOnboardingMilestone(ONBOARDING_MILESTONE_IDS[i]);
    out.hiddenWhenCompleted = player.onboarding.status === 'completed' && chip.hidden === true;
    player.onboarding = defaultOnboarding('skipped');
    updateOnboardingChip();
    out.hiddenWhenSkipped = chip.hidden === true;
    switchProfile();
    out.hiddenAfterSwitch = chip.hidden === true;
    localStorage.clear();
    return out;
  });
  check('ONB-UI: chip is hidden on the title screen', r.hiddenOnTitle);
  check('ONB-UI: chip shows the first derived objective in play', r.showsFirstObjective);
  check('ONB-UI: chip advances with the derived objective', r.advances);
  check('ONB-UI: tapping collapses to the compass badge', r.collapses);
  check('ONB-UI: tapping again restores the objective', r.expands);
  check('ONB-UI: chip hides while combat is open', r.hiddenInCombat);
  check('ONB-UI: chip returns after combat closes', r.backAfterCombat);
  check('ONB-UI: a completed guide removes the chip', r.hiddenWhenCompleted);
  check('ONB-UI: a skipped guide removes the chip', r.hiddenWhenSkipped);
  check('ONB-UI: switching profiles removes the chip', r.hiddenAfterSwitch);
  await browser.close();
}

// --- Visual evidence: expanded chip, advanced objective, collapsed chip, and the
// completion moment — both heroes, desktop / iPad landscape / phone portrait, into
// artifacts/ (retained on the CI workflow run, never committed).
{
  const { mkdir } = await import('node:fs/promises');
  const { fileURLToPath } = await import('node:url');
  const evidenceDir = new URL('../artifacts/', import.meta.url);
  await mkdir(evidenceDir, { recursive: true });
  const VIEWPORTS = { desktop: [1280, 800], 'ipad-landscape': [1180, 820], 'phone-portrait': [390, 844] };
  for (const [label, [w, h]] of Object.entries(VIEWPORTS)) {
    for (const hero of ['adventurer', 'mage']) {
      const { browser, page } = await launch();
      await page.setViewport({ width: w, height: h });
      const shot = name =>
        page.screenshot({ path: fileURLToPath(new URL(`onboarding-${name}-${hero}-${label}.png`, evidenceDir)) });
      await page.evaluate(`(() => { localStorage.clear(); selectProfile('${hero}'); })()`);
      await shot('chip-first-objective');
      await page.evaluate(`(() => { recordOnboardingMilestone('planted'); })()`);
      await shot('chip-advanced');
      await page.evaluate(`(() => { toggleOnboardingChip(); })()`);
      await shot('chip-collapsed');
      await page.evaluate(`(() => {
        toggleOnboardingChip();
        ONBOARDING_MILESTONE_IDS.forEach(function (id) { recordOnboardingMilestone(id); });
      })()`);
      await shot('completed');
      await page.evaluate(`(() => { switchProfile(); localStorage.clear(); })()`);
      await browser.close();
    }
  }
  console.log('PASS visual evidence: Mira’s Guide frames captured (2 heroes x 3 viewports x 4 states)');
}

if (fails.length) {
  console.error('\n' + fails.length + ' onboarding test(s) failed.');
  process.exit(1);
}
console.log('Onboarding (Mira’s Guide) tests passed.');
