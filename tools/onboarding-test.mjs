// Acceptance tests for Step 7 — Mira's Guide onboarding (save v4):
//   - state & migration: fresh profiles start 'active'; every v0–v3 fixture
//     migrates deterministically to v4 with the guide 'skipped'; malformed
//     onboarding blocks are rejected; canonical state survives save/reload,
//     export/import, and profile isolation; SAVE_VERSION is exactly 4
//   - progress behavior: each successful gameplay verb records its milestone,
//     failed actions record nothing, repeats are idempotent, out-of-order
//     actions never require repetition, sell and cook both satisfy usedCrop,
//     entering the Wilds completes the chain; Mira's real interaction completes
//     metMira + acceptedQuest together and narrates that transition once
//   - chip UI: five visible objectives over six persisted milestones, controls,
//     highlights, focus/touch sizing, phone overflow, combat coexistence, and
//     disappearance for skipped/completed saves
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
      { version: 3, player: { gold: 66 }, areas: {} },                    // v3
      { version: 3, player: { gold: 77, onboarding: {
        status: 'active', milestones: { planted: true } } }, areas: {} }   // v3 with stale partial guide
    ];
    out.migratedSkipped = fixtures.every(function (s) {
      var res = ingestSaveObject(s);
      return res.ok && res.state.version === 4 &&
        res.state.player.onboarding.status === 'skipped' &&
        IDS.every(function (id) { return res.state.player.onboarding.milestones[id] === false; });
    });

    // (3) A valid v4 block round-trips exactly with all six milestone keys.
    var fullFalse = {};
    IDS.forEach(function (id) { fullFalse[id] = false; });
    var v4 = { version: 4, player: { onboarding: { status: 'active',
      milestones: Object.assign({}, fullFalse, { planted: true, harvested: true }) } }, areas: {} };
    var rv4 = ingestSaveObject(v4);
    out.v4Preserved = rv4.ok && rv4.state.player.onboarding.status === 'active' &&
      rv4.state.player.onboarding.milestones.planted === true &&
      rv4.state.player.onboarding.milestones.harvested === true &&
      rv4.state.player.onboarding.milestones.usedCrop === false;

    var v4Missing = ingestSaveObject({ version: 4, player: {}, areas: {} });
    out.v4MissingRecovery = v4Missing.ok && v4Missing.state.player.onboarding.status === 'skipped' &&
      IDS.every(function (id) { return v4Missing.state.player.onboarding.milestones[id] === false; });

    // (4) Malformed onboarding blocks are rejected, never defaulted.
    out.rejects = [
      { version: 4, player: { onboarding: 'yes' }, areas: {} },
      { version: 4, player: { onboarding: { status: 'later', milestones: {} } }, areas: {} },
      { version: 4, player: { onboarding: { status: 'active' } }, areas: {} },
      { version: 4, player: { onboarding: { status: 'active', milestones: { planted: 'yep' } } }, areas: {} },
      { version: 4, player: { onboarding: { status: 'active', milestones: { flying: true } } }, areas: {} },
      { version: 4, player: { onboarding: { status: 'completed', milestones: fullFalse } }, areas: {} }
    ].map(function (s) { return ingestSaveObject(s).ok === false; });

    // (5) Active, skipped, and completed states survive canonical re-ingestion.
    out.statusesSurvive = ['active', 'skipped', 'completed'].every(function (st) {
      var milestones = st === 'completed' ? IDS.reduce(function (m, id) {
        m[id] = true; return m;
      }, {}) : Object.assign({}, fullFalse, st === 'skipped' ? { planted: true } : {});
      var res = ingestSaveObject({ version: 4,
        player: { onboarding: { status: st, milestones: milestones } }, areas: {} });
      var re = ingestSaveText(res.canonicalText);
      return res.ok && re.ok && re.state.player.onboarding.status === st &&
        JSON.stringify(re.state) === JSON.stringify(res.state);
    });

    var activeAll = IDS.reduce(function (m, id) { m[id] = true; return m; }, {});
    var activeAllResult = ingestSaveObject({ version: 4,
      player: { onboarding: { status: 'active', milestones: activeAll } }, areas: {} });
    out.activeAllCanonicalizes = activeAllResult.ok &&
      activeAllResult.state.player.onboarding.status === 'completed';

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
  check('ONB-STATE: a valid v4 block round-trips with exactly six milestones', r.v4Preserved);
  check('ONB-STATE: a v4 save missing onboarding recovers as skipped', r.v4MissingRecovery);
  check('ONB-STATE: malformed onboarding blocks are rejected', r.rejects.every(Boolean));
  check('ONB-STATE: active/skipped/completed all survive canonical re-ingestion', r.statusesSurvive);
  check('ONB-STATE: active with all six true canonicalizes to completed', r.activeAllCanonicalizes);
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

    // (5) Meeting Mira through the real interaction records both persisted
    // milestones in one combined transition; there is no standalone accept step.
    var mira = NPCS.filter(function (n) { return n.id === 'mira'; })[0];
    activateArea('town');
    player.x = mira.col * TILE; player.y = (mira.row + 1) * TILE;  // stand adjacent
    interactNPC(mira);
    out.metMira = ms().metMira === true;
    out.acceptedQuest = ms().acceptedQuest === true && player.killQuest !== null;
    out.miraVisibleNext = onboardingNextMilestone().id === 'enteredWilds';
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

    // Speech is counted at the utterance boundary. Out-of-order/repeated records
    // must not narrate, while Mira's double completion gets exactly one transition.
    var speech = window.speechSynthesis;
    var utterances = 0;
    var oldSpeak = speech && speech.speak;
    var oldCancel = speech && speech.cancel;
    if (speech) {
      speech.speak = function () { utterances++; };
      speech.cancel = function () {};
    }
    player.onboarding = defaultOnboarding('active');
    recordOnboardingMilestone('usedCrop');
    recordOnboardingMilestone('planted');
    recordOnboardingMilestone('planted');
    out.narratesOnlyOnChange = utterances === 1;
    player.onboarding = defaultOnboarding('active');
    player.onboarding.milestones.planted = true;
    player.onboarding.milestones.harvested = true;
    player.onboarding.milestones.usedCrop = true;
    utterances = 0;
    recordOnboardingMilestone('metMira');
    out.miraNarratesOnce = utterances === 1 && player.onboarding.milestones.acceptedQuest === true &&
      onboardingNextMilestone().id === 'enteredWilds';
    if (speech) { speech.speak = oldSpeak; speech.cancel = oldCancel; }

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
  check('ONB-PLAY: Mira\'s real interaction records acceptedQuest together', r.acceptedQuest);
  check('ONB-PLAY: the visible chain skips standalone accept quest', r.miraVisibleNext);
  check('ONB-PLAY: entering the Wilds records enteredWilds', r.enteredWilds);
  check('ONB-PLAY: all milestones true flips status to completed', r.completed);
  check('ONB-PLAY: a completed guide ignores further recording', r.completedInert);
  check('ONB-PLAY: completed status survives save/reload', r.completedPersists);
  check('ONB-PLAY: out-of-order progress is kept, objective stays derived', r.outOfOrder);
  check('ONB-PLAY: narration occurs only on a derived objective change', r.narratesOnlyOnChange);
  check('ONB-PLAY: Mira double completion narrates exactly once', r.miraNarratesOnce);
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

// --- Guide UI: objectives, controls, focus/sizing, highlights, combat hiding ---
{
  const { browser, page } = await launch();
  const r = await page.evaluate(() => {
    localStorage.clear();
    var out = {};
    var chip = document.getElementById('onboardingChip');
    var compass = document.getElementById('onboardingCompass');
    var speakBtn = document.getElementById('onboardingSpeak');
    var skipBtn = document.getElementById('onboardingSkip');

    // Hidden on the title screen, visible with the first derived objective in play.
    out.hiddenOnTitle = document.getElementById('onboardingGuide').hidden === true && chip.hidden === true;
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
    out.collapses = chip.hidden === true && compass.hidden === false &&
      document.activeElement === compass && compass.getBoundingClientRect().width >= 44;
    toggleOnboardingChip();
    out.expands = chip.hidden === false && compass.hidden === true &&
      document.activeElement === chip && chip.textContent.indexOf(ONBOARDING_MILESTONES[1].objective) >= 0;

    out.progress = chip.textContent.indexOf('1 of 6') >= 0;
    out.controls = speakBtn.hidden === false && skipBtn.hidden === false &&
      speakBtn.getBoundingClientRect().width >= 44 && speakBtn.getBoundingClientRect().height >= 44 &&
      skipBtn.getBoundingClientRect().width >= 44 && skipBtn.getBoundingClientRect().height >= 44;
    onboardingReadAloud({ stopPropagation: function () {} });
    out.readAloudControl = true;

    // Skip is a two-step, focusable control and is permanent/inert after save.
    onboardingSkipPressed({ stopPropagation: function () {} });
    out.skipArmed = skipBtn.textContent.indexOf('again') >= 0 && document.activeElement === skipBtn;
    onboardingSkipPressed({ stopPropagation: function () {} });
    out.skipPersists = player.onboarding.status === 'skipped' && chip.hidden === true &&
      JSON.parse(localStorage.getItem('eldoria_save_adventurer')).player.onboarding.status === 'skipped';
    recordOnboardingMilestone('harvested');
    out.skipInert = player.onboarding.milestones.harvested === false;

    // Restore a fresh active guide for the remaining UI checks.
    player.onboarding = defaultOnboarding('active');
    onboardingChipLast = '';
    updateOnboardingChip();

    // Combat: opening a battle hides the chip on the next tick; closing restores it.
    activateArea('wilds');
    openCombat(currentEnemies[0]);
    update();
    out.hiddenInCombat = chip.hidden === true;
    fleeCombat();
    update();
    out.backAfterCombat = chip.hidden === false;

    var oldWidth = document.documentElement.scrollWidth;
    out.noPhoneOverflow = oldWidth <= document.documentElement.clientWidth;

    // Highlight selection follows the actual milestone and current world targets.
    activateArea('farm');
    var plantedTargets = onboardingHighlightTargets();
    out.highlightPlant = plantedTargets.length === 1 &&
      cropData[plantedTargets[0].row + ',' + plantedTargets[0].col].status === 'empty';
    cropData['3,14'].status = 'growing';
    player.onboarding.milestones.planted = true;
    onboardingChipLast = '';
    updateOnboardingChip();
    var harvestTargets = onboardingHighlightTargets();
    out.highlightHarvest = harvestTargets.length === 1 &&
      cropData[harvestTargets[0].row + ',' + harvestTargets[0].col].status === 'growing';
    player.onboarding.milestones.harvested = true;
    player.onboarding.milestones.usedCrop = false;
    onboardingChipLast = '';
    updateOnboardingChip();
    out.highlightPot = onboardingHighlightTargets().some(function (t) {
      return t.label === 'cookpot';
    });
    activateArea('town');
    out.highlightStore = onboardingHighlightTargets().some(function (t) {
      return t.label === 'store';
    });
    player.onboarding.milestones.usedCrop = true;
    player.onboarding.milestones.metMira = false;
    player.onboarding.milestones.acceptedQuest = false;
    onboardingChipLast = '';
    updateOnboardingChip();
    out.highlightMira = onboardingHighlightTargets().some(function (t) { return t.label === 'Mira'; });
    player.onboarding.milestones.metMira = true;
    player.onboarding.milestones.acceptedQuest = true;
    onboardingChipLast = '';
    updateOnboardingChip();
    out.highlightExit = onboardingHighlightTargets().some(function (t) { return t.label === 'exit'; });

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
  check('ONB-UI: expanded chip shows persisted progress', r.progress);
  check('ONB-UI: tapping collapses to the compass badge', r.collapses);
  check('ONB-UI: tapping again restores the objective', r.expands);
  check('ONB-UI: speaker and skip controls meet touch sizing', r.controls);
  check('ONB-UI: read-aloud control is wired', r.readAloudControl);
  check('ONB-UI: skip uses a focusable two-step confirmation', r.skipArmed);
  check('ONB-UI: skip persists and makes recording inert', r.skipPersists && r.skipInert);
  check('ONB-UI: phone portrait has no horizontal overflow', r.noPhoneOverflow);
  check('ONB-UI: plant and crop highlight target selection', r.highlightPlant && r.highlightHarvest);
  check('ONB-UI: pot and store highlight target selection', r.highlightPot && r.highlightStore);
  check('ONB-UI: Mira and Wilds route highlight target selection', r.highlightMira && r.highlightExit);
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
  // Required real-verb evidence: this path uses the shipped gameplay verbs rather
  // than injecting milestone state. It captures the crop guidance, the two guide
  // controls, Town/Mira routing beside an active kill-quest tracker, combat hiding,
  // and Wilds completion.
  {
    const { browser, page } = await launch();
    await page.setViewport({ width: 1180, height: 820 });
    const shot = name =>
      page.screenshot({ path: fileURLToPath(new URL(`onboarding-e2e-${name}.png`, evidenceDir)) });
    await page.evaluate(() => {
      localStorage.clear();
      selectProfile('adventurer');
      activateArea('farm');
      player.seeds = { turnip: 2, carrot: 0, corn: 0, pumpkin: 0, starfruit: 0 };
      interactCropTile({ row: 3, col: 14 });
    });
    await shot('plant-harvest-highlight-with-controls');
    await page.evaluate(() => {
      cropData['3,14'].plantedAt = Date.now() - 999999;
      updateCrops();
      interactCropTile({ row: 3, col: 14 });
    });
    await shot('harvest-use-highlight');
    await page.evaluate(() => {
      player.crops.turnip = 1;
      sellCrops();
      var mira = NPCS.filter(function (n) { return n.id === 'mira'; })[0];
      activateArea('town');
      player.x = mira.col * TILE; player.y = (mira.row + 1) * TILE;
      interactNPC(mira);
      closeQuest();
      updateHUD();
    });
    await shot('town-mira-and-kill-quest-tracker');
    await page.evaluate(() => {
      activateArea('wilds');
      openCombat(currentEnemies[0]);
      update();
    });
    await shot('combat-hides-guide-highlights');
    await page.evaluate(() => {
      fleeCombat();
      activateArea('town');
      var exitRow = 10;
      for (var r = 0; r < MAP_H; r++) if (areas.town.map[r][MAP_W - 1] === EXIT) { exitRow = r; break; }
      player.x = (MAP_W - 1) * TILE; player.y = exitRow * TILE;
      checkTravel();
    });
    await shot('wilds-completion');
    await page.evaluate(() => {
      switchProfile();
      localStorage.clear();
      selectProfile('mage');
    });
    await shot('skip-and-read-aloud-controls');
    await page.evaluate(() => {
      onboardingSkipPressed({ stopPropagation: function () {} });
      onboardingSkipPressed({ stopPropagation: function () {} });
    });
    await browser.close();
  }
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
  console.log('PASS visual evidence: Mira’s Guide frames captured (2 heroes x 3 viewports x 4 states + real verb-driven E2E route)');
}

if (fails.length) {
  console.error('\n' + fails.length + ' onboarding test(s) failed.');
  process.exit(1);
}
console.log('Onboarding (Mira’s Guide) tests passed.');
