// Acceptance tests for Combat progression integrity (ELD-PLAY-001):
// per-question damage budgets, multi-question bosses, slash-window cap behavior.
// Run: node tools/combat-progression-test.mjs
import { launch } from './smoke-test.mjs';

const fails = [];
const check = (name, ok) => { console.log((ok ? 'PASS ' : 'FAIL ') + name); if (!ok) fails.push(name); };

// Shared in-page helpers are defined per-evaluate (puppeteer serializes functions).
const LOADOUTS = `
  function setLoadout(kind) {
    player.gear = { weapon: null, head: null, body: null, cape: null };
    player.atkUpgrades = 0; player.level = 1;
    if (kind === 'strongest') {
      player.gear = { weapon: 'eldoria_blade', head: 'titan_helm', body: 'wyrm_scale', cape: 'dragon_cape' };
      player.level = 25;
    } else if (kind === 'upgrades') {
      player.atkUpgrades = 50;
      player.level = 10;
    }
    player.maxHp = 9999; player.hp = 9999;   // survive many boss counterattacks
  }
  function mash(n) { for (var i = 0; i < n; i++) executeSlash(); }
`;

// --- Damage invariants on a regular enemy ---
{
  const { browser, page, errors } = await launch();
  const r = await page.evaluate(LOADOUTS + `(() => {
    localStorage.clear();
    var out = {};
    selectProfile('adventurer');
    activateArea('wilds');
    var slime = currentEnemies[0];
    function freshFight() {
      slime.alive = true;
      openCombat(slime);
      combatEnemy.hp = combatEnemy.maxHp = 999999;
    }
    setLoadout('baseline');
    var base = playerDamage();

    // (1) Correct answer, zero taps = exactly 2 x base.
    freshFight();
    var b0 = combatEnemy.hp;
    answerCombat(combatAnswer);
    out.correctZeroTap = (b0 - combatEnemy.hp) === base * 2;
    endSlashPhase(); closeCombat();

    // (2) Wrong-answer total never exceeds 1 x base (200 direct calls).
    freshFight();
    var b1 = combatEnemy.hp;
    answerCombat(combatAnswer + 1);
    mash(200);
    out.wrongCapped = (b1 - combatEnemy.hp) === base;
    endSlashPhase(); closeCombat();

    // (3)+(5) Correct-answer total caps at 4 x base even under 500 direct calls.
    freshFight();
    var b2 = combatEnemy.hp;
    answerCombat(combatAnswer);
    mash(500);
    out.correctCapped = (b2 - combatEnemy.hp) === base * 4;

    // (6) Timer-edge: once capped, extra endSlashPhase/executeSlash cannot duplicate
    // damage or counterattacks or produce two next questions.
    var hpBefore = player.hp;
    var answerBefore = combatAnswer;
    endSlashPhase();                       // legitimate end: ONE counterattack + next question
    var afterOne = player.hp;
    var answerAfterOne = combatAnswer;
    endSlashPhase(); endSlashPhase();      // duplicates: must be no-ops (slashActive guard)
    mash(5);                               // window closed: no damage possible
    var b3 = combatEnemy.hp;
    out.oneCounterattack = (hpBefore - afterOne) === combatEnemy.attack && player.hp === afterOne;
    out.oneNextQuestion = (answerAfterOne !== answerBefore) && combatAnswer === answerAfterOne;
    out.noLateDamage = combatEnemy.hp === b3;
    closeCombat();

    // (4) Correct zero-tap strictly beats the wrong maximum across representative
    // loadouts, on a regular enemy AND on a boss (budget-derived, exercised live).
    out.strictOrder = ['baseline', 'strongest', 'upgrades'].every(function (kind) {
      setLoadout(kind);
      var b = playerDamage();
      // regular
      freshFight();
      var r0 = combatEnemy.hp;
      answerCombat(combatAnswer);
      var correctZero = r0 - combatEnemy.hp;
      endSlashPhase(); closeCombat();
      freshFight();
      var r1 = combatEnemy.hp;
      answerCombat(combatAnswer + 1);
      mash(300);
      var wrongMax = r1 - combatEnemy.hp;
      endSlashPhase(); closeCombat();
      // boss (Shadow Warden)
      activateArea('deepwoods');
      var warden = currentEnemies[3];
      warden.alive = true;
      openCombat(warden);
      var w0 = combatEnemy.hp;
      answerCombat(combatAnswer);
      var bossCorrectZero = w0 - combatEnemy.hp;
      endSlashPhase(); closeCombat();
      warden.alive = true;
      openCombat(warden);
      combatEnemy.hp = combatEnemy.maxHp;   // reset for the wrong-answer measurement
      var w1 = combatEnemy.hp;
      answerCombat(combatAnswer + 1);
      mash(300);
      var bossWrongMax = w1 - combatEnemy.hp;
      endSlashPhase(); closeCombat();
      activateArea('wilds');
      return correctZero === 2 * b &&
             correctZero > wrongMax && bossCorrectZero > bossWrongMax;
    });
    switchProfile();
    localStorage.clear();
    return out;
  })()`);
  check('DMG: correct answer with zero taps deals exactly 2x base', r.correctZeroTap);
  check('DMG: wrong-answer total capped at 1x base under 200 direct calls', r.wrongCapped);
  check('DMG: correct-answer total capped at 4x base under 500 direct calls', r.correctCapped);
  check('DMG: correct zero-tap strictly beats wrong max across loadouts, incl. bosses', r.strictOrder);
  check('DMG: capped phase ends with exactly one counterattack', r.oneCounterattack);
  check('DMG: capped phase produces exactly one next question', r.oneNextQuestion);
  check('DMG: input after the window closes deals nothing', r.noLateDamage);
  check('DMG: no console errors', errors.length === 0);
  await browser.close();
}

// --- Multi-question bosses ---
{
  const { browser, page } = await launch();
  const r = await page.evaluate(LOADOUTS + `(() => {
    localStorage.clear();
    var out = {};
    selectProfile('adventurer');

    // Fight a boss to the death with a given answer pattern; count answered questions.
    // pattern(qIndex) returns true for a correct answer this question.
    function fightBoss(area, index, kind, pattern) {
      activateArea(area);
      var boss = currentEnemies[index];
      boss.alive = true;
      setLoadout(kind);
      openCombat(boss);
      combatEnemy.hp = combatEnemy.maxHp;   // pristine boss
      var phaseCap = Math.ceil(combatEnemy.maxHp / 3);
      var questions = 0, capRespected = true, guard = 40;
      while (combatOpen && guard-- > 0) {
        var hpBefore = combatEnemy.hp;
        var correct = pattern(questions);
        answerCombat(correct ? combatAnswer : combatAnswer + 1);
        mash(200);
        questions++;
        var dealt = hpBefore - combatEnemy.hp;
        if (dealt > phaseCap) capRespected = false;
        if (combatOpen) endSlashPhase();
      }
      return { questions: questions, capRespected: capRespected, dead: !boss.alive };
    }
    function alwaysRight() { return true; }

    // (7) Shadow Warden needs >= 3 answered questions in all three configs.
    out.warden = ['baseline', 'strongest', 'upgrades'].map(function (kind) {
      return fightBoss('deepwoods', 3, kind, alwaysRight);
    });
    // (8) Crystal Wyrm, same three configs.
    out.wyrm = ['baseline', 'strongest', 'upgrades'].map(function (kind) {
      return fightBoss('mine', 2, kind, alwaysRight);
    });
    // (9) Mixed and wrong-heavy sequences also respect the per-question cap.
    out.mixed = fightBoss('deepwoods', 3, 'strongest', function (q) { return q % 2 === 0; });
    out.wrongHeavy = fightBoss('mine', 2, 'upgrades', function (q) { return q % 3 === 2; });

    // (11) A lethal permitted phase pays out exactly once: XP, guaranteed boss loot,
    // kill credit, death state, and persistence.
    activateArea('mine');
    var wyrm = currentEnemies[2];
    wyrm.alive = true;
    setLoadout('baseline');
    var base = playerDamage();
    openCombat(wyrm);
    combatEnemy.hp = Math.min(base * 2, Math.ceil(combatEnemy.maxHp / 3)) - 1; // dies to the free hit
    var xpBefore = player.xp + 0;
    var killsBefore = (player.killCounts.crystal_wyrm || 0);
    var hadScale = player.gear.body === 'wyrm_scale' ? 1 : 0;
    var levelBefore = player.level;
    answerCombat(combatAnswer);            // lethal free hit → winCombat exactly once
    var xpGained = (player.level === levelBefore)
      ? (player.xp - xpBefore) : ENEMIES.crystal_wyrm.xpReward; // level-up consumes xp
    out.lethal = {
      closed: combatOpen === false,
      dead: wyrm.alive === false && wyrm.respawnAt > Date.now(),
      xpOnce: xpGained === ENEMIES.crystal_wyrm.xpReward,
      killOnce: (player.killCounts.crystal_wyrm || 0) === killsBefore + 1,
      lootOnce: player.gear.body === 'wyrm_scale' || player.inventory.indexOf('wyrm_scale') >= 0 || hadScale === 1,
      persisted: (function () {
        var saved = JSON.parse(localStorage.getItem('eldoria_save_adventurer'));
        return saved.player.killCounts.crystal_wyrm === killsBefore + 1 &&
               saved.areas.mine.enemies[wyrm.id].alive === false;
      })()
    };

    // (13) SAVE_VERSION untouched. (14) Profile isolation intact after boss kills.
    out.saveVersion = SAVE_VERSION === 3;
    switchProfile();
    selectProfile('mage');
    activateArea('mine');
    out.mageIsolated = currentEnemies.every(function (e) { return e.alive; });
    // (15) Both profiles keep their question generators + spoken prompts wired.
    var qm = makeCombatQuestion();
    out.mageQuestion = qm && typeof qm.answer === 'number' && typeof qm.text === 'string';
    switchProfile();
    selectProfile('adventurer');
    var qa = makeCombatQuestion();
    out.advQuestion = qa && typeof qa.answer === 'number' && typeof qa.text === 'string';
    out.speakWired = typeof speak === 'function';
    switchProfile();
    localStorage.clear();
    return out;
  })()`);
  const min3 = list => list.every(f => f.dead && f.questions >= 3 && f.capRespected);
  check('BOSS: Shadow Warden needs >=3 answered questions in all three loadouts', min3(r.warden));
  check('BOSS: Crystal Wyrm needs >=3 answered questions in all three loadouts', min3(r.wyrm));
  check('BOSS: mixed-answer sequence respects the per-question cap', r.mixed.capRespected && r.mixed.dead);
  check('BOSS: wrong-heavy sequence respects the per-question cap', r.wrongHeavy.capRespected && r.wrongHeavy.dead);
  check('BOSS: lethal permitted hit closes combat via winCombat once', r.lethal.closed && r.lethal.dead);
  check('BOSS: lethal phase grants XP exactly once', r.lethal.xpOnce);
  check('BOSS: lethal phase grants kill credit exactly once', r.lethal.killOnce);
  check('BOSS: guaranteed boss loot arrives', r.lethal.lootOnce);
  check('BOSS: the kill persists to the profile save', r.lethal.persisted);
  check('REGRESSION: SAVE_VERSION remains 3', r.saveVersion);
  check('REGRESSION: profile-owned enemy state stays isolated', r.mageIsolated);
  check('REGRESSION: both profiles keep question generators + speech wiring',
    r.mageQuestion && r.advQuestion && r.speakWired);
  await browser.close();
}

// --- Visual evidence: slash state, reached-cap feedback, next boss question,
// victory state — desktop / iPad landscape / phone portrait, into artifacts/
// (retained on the CI workflow run, never committed).
{
  const { mkdir } = await import('node:fs/promises');
  const { fileURLToPath } = await import('node:url');
  const evidenceDir = new URL('../artifacts/', import.meta.url);
  await mkdir(evidenceDir, { recursive: true });
  const VIEWPORTS = { desktop: [1280, 800], 'ipad-landscape': [1180, 820], 'phone-portrait': [390, 844] };
  for (const [label, [w, h]] of Object.entries(VIEWPORTS)) {
    const { browser, page } = await launch();
    await page.setViewport({ width: w, height: h });
    const shot = name =>
      page.screenshot({ path: fileURLToPath(new URL(`combat-${name}-${label}.png`, evidenceDir)) });
    await page.evaluate(LOADOUTS + `(() => {
      localStorage.clear();
      selectProfile('adventurer');
      activateArea('deepwoods');
      var boss = currentEnemies[3];
      boss.alive = true;
      setLoadout('strongest');
      openCombat(boss);
      combatEnemy.hp = combatEnemy.maxHp;
      answerCombat(combatAnswer);       // free hit banked, slash window open
    })()`);
    await shot('slash-state');
    await page.evaluate(`(() => { for (var i = 0; i < 300; i++) executeSlash(); })()`);
    await shot('cap-feedback');         // budget spent: cap message showing
    await page.evaluate(`(() => { endSlashPhase(); })()`);
    await shot('next-boss-question');
    await page.evaluate(`(() => {
      combatEnemy.hp = 1;
      answerCombat(combatAnswer);       // lethal permitted hit → victory
    })()`);
    await shot('victory');
    await page.evaluate(`(() => { localStorage.clear(); })()`);
    await browser.close();
  }
  console.log('PASS visual evidence: combat progression frames captured (3 viewports x 4 states)');
}

if (fails.length) {
  console.error('\n' + fails.length + ' combat-progression test(s) failed.');
  process.exit(1);
}
console.log('Combat progression integrity tests passed.');
