// Compliance tests for the owner's ELD-PT-013 ruling (2026-07-29) and the boss
// respawn ruling (2026-08-05). These assert the ABSENCE of pressure patterns, so if
// anyone reintroduces a bulk discount or a "save up" nudge, this names it.
// Run: node tools/dumpling-compliance-test.mjs
import { launch } from './smoke-test.mjs';

const fails = [];
const check = (name, ok) => { console.log((ok ? 'PASS ' : 'FAIL ') + name); if (!ok) fails.push(name); };

// --- No discounted bundle: pulling more must never be cheaper per pull ---
{
  const { browser, page, errors } = await launch();
  const r = await page.evaluate(() => {
    selectProfile('adventurer');
    const perPull = DUMPLING_PULL_COUNTS.map(c => ({ count: c, each: dumplingPullCost(c) / c }));
    player.gold = 1000;
    openDumplingVendor();
    // Compare PRICES, not the gold delta: duplicate refunds pay gold back, so a
    // before/after balance measures the economy, not what was charged.
    const tenCost = dumplingPullCost(10);
    const oneCost = dumplingPullCost(1);
    const rejectsUnknown = buyDumplingBundle(7) === false;   // only declared counts
    return { perPull, tenCost, oneCost, rejectsUnknown };
  });

  check('013: every pull count costs the same per pull (no bulk discount)',
    r.perPull.every(p => p.each === r.perPull[0].each));
  check('013: ten pulls cost exactly ten times one pull',
    r.tenCost === 10 * r.oneCost);
  check('013: an undeclared pull count is refused', r.rejectsUnknown);
  check('013: no console errors', errors.length === 0);
  await browser.close();
}

// --- No "save up for a better deal" nudge anywhere the child can see or hear ---
{
  const { browser, page, errors } = await launch();
  const r = await page.evaluate(() => {
    selectProfile('mage');
    const spoken = [];
    window.speechSynthesis.speak = u => spoken.push(u.text);
    player.gold = 500;
    openDumplingVendor();
    const visible = document.getElementById('dumplingModal').textContent;
    buyDumplingBundle(1);
    const allSpeech = spoken.join(' | ');
    return { visible, allSpeech, oddsShown: document.getElementById('dumplingOdds').textContent };
  });

  const forbidden = /save (up )?(gold )?for|better deal|best value|save more|bundle deal|cheaper/i;
  check('013: no saving/better-deal nudge in the visible stall', !forbidden.test(r.visible));
  check('013: no saving/better-deal nudge in anything spoken', !forbidden.test(r.allSpeech));
  check('013: no per-pull "each" discount maths shown', !/each/i.test(r.visible));
  check('013: odds are visible in plain language', /%/.test(r.oddsShown) && /legendary/i.test(r.oddsShown));
  check('013: no console errors', errors.length === 0);
  await browser.close();
}

// --- Displayed odds must match the odds actually rolled ---
{
  const { browser, page, errors } = await launch();
  const r = await page.evaluate(() => {
    selectProfile('adventurer');
    const sum = DUMPLING_ODDS.reduce((t, b) => t + b.chance, 0);
    // Drive the roll to each band boundary and confirm it lands where the table says.
    const original = Math.random;
    const sampled = {};
    let cumulative = 0;
    for (const band of DUMPLING_ODDS) {
      const mid = cumulative + band.chance / 2;
      Math.random = () => mid;
      player.dumplings = {};
      player.pullsSinceLegendary = 0;
      sampled[band.rarity] = rollDumpling().rarity;
      cumulative += band.chance;
    }
    Math.random = original;
    return { sum, sampled, text: dumplingOddsText() };
  });

  check('013: odds bands total 100%', Math.abs(r.sum - 1) < 1e-9);
  check('013: each band rolls the rarity it advertises',
    Object.keys(r.sampled).every(k => r.sampled[k] === k));
  check('013: the odds text is built from the same table', /55% common/.test(r.text));
  check('013: no console errors', errors.length === 0);
  await browser.close();
}

// --- Dough is a real deterministic completion path, not a dead currency ---
{
  const { browser, page, errors } = await launch();
  const r = await page.evaluate(() => {
    selectProfile('adventurer');
    player.gold = 0;
    player.dumplings = {};
    player.dumplingDough = 0;
    openDumplingVendor();

    const blockedWhenPoor = pickDumplingWithDough('golden_dumpling') === false;
    player.dumplingDough = DUMPLING_DOUGH_PER_PICK;

    // The child picks the one they want — not a random one.
    const picked = pickDumplingWithDough('golden_dumpling');
    const owned = (player.dumplings.golden_dumpling || 0) > 0;
    const doughSpent = player.dumplingDough;

    // Cannot re-buy something already owned.
    player.dumplingDough = DUMPLING_DOUGH_PER_PICK;
    const blockedWhenOwned = pickDumplingWithDough('golden_dumpling') === false;

    // A complete shelf turns spare dough into gold instead of stranding it.
    for (const d of DUMPLINGS) player.dumplings[d.id] = 1;
    const goldBefore = player.gold;
    const traded = exchangeDoughForGold();
    return {
      blockedWhenPoor, picked, owned, doughSpent, blockedWhenOwned,
      traded, goldGained: player.gold - goldBefore,
      // Save state nests gameplay fields under `player`.
      survives: (() => { const s = JSON.parse(localStorage.getItem('eldoria_save_adventurer'));
        return !!(s && s.player && s.player.dumplings && s.player.dumplings.golden_dumpling > 0); })()
    };
  });

  check('013: dough below the threshold cannot pick', r.blockedWhenPoor);
  check('013: enough dough picks the exact dumpling the child chose',
    r.picked && r.owned && r.doughSpent === 0);
  check('013: dough cannot be spent on an already-owned dumpling', r.blockedWhenOwned);
  check('013: a complete shelf trades spare dough for gold',
    r.traded && r.goldGained === 50);
  check('013: a dough pick is saved', r.survives);
  check('013: no console errors', errors.length === 0);
  await browser.close();
}

// --- Boss respawn: daily, not 30 seconds (owner ruling 2026-08-05) ---
{
  const { browser, page, errors } = await launch();
  const r = await page.evaluate(() => {
    selectProfile('adventurer');

    const killAndRead = (area, wantBoss) => {
      activateArea(area);
      const target = currentEnemies.find(e => !!(ENEMIES[e.type] && ENEMIES[e.type].boss) === wantBoss);
      if (!target) return null;
      target.alive = true;
      openCombat(target);
      combatEnemy.hp = 0;
      const t0 = Date.now();
      winCombat();
      return { delay: target.respawnAt - t0, type: target.type };
    };

    // Bosses live in the Deep Woods and the Mine, not the Wilds.
    const boss = killAndRead('deepwoods', true);
    const normal = killAndRead('wilds', false);
    return { boss, normal, bossConst: BOSS_RESPAWN_MS, normalConst: ENEMY_RESPAWN_MS };
  });

  check('boss respawn: constants are a day and half a minute',
    r.bossConst === 86400000 && r.normalConst === 30000);
  check('boss respawn: a defeated boss stays down for a day',
    r.boss && Math.abs(r.boss.delay - 86400000) < 2000);
  check('boss respawn: ordinary enemies still come back quickly',
    r.normal && Math.abs(r.normal.delay - 30000) < 2000);
  check('boss respawn: no console errors', errors.length === 0);
  await browser.close();
}

// --- A1 TTS boundary: opening the stall must be SILENT, and Read Odds is the only
//     speech it can produce. Without this assertion a future "friendly welcome" line
//     silently reintroduces routine-action speech that the owner ruling forbids. ---
{
  const { browser, page, errors } = await launch();
  const r = await page.evaluate(() => {
    selectProfile('mage');            // early reader: the profile that speaks the most
    const spoken = [];
    window.speechSynthesis.speak = u => spoken.push(u.text);
    player.gold = 500;
    openDumplingVendor();
    const onOpen = spoken.length;
    closeDumplingVendor();
    openDumplingVendor();
    const onReopen = spoken.length;   // still zero: reopening is not a new event
    readDumplingOdds();
    const afterTap = spoken.length;
    return { onOpen, onReopen, afterTap, tapped: spoken[spoken.length - 1] || '' };
  });

  check('A1: opening the stall speaks nothing', r.onOpen === 0);
  check('A1: closing and reopening speaks nothing', r.onReopen === 0);
  check('A1: Read Odds speaks only when tapped', r.afterTap === 1);
  check('A1: the spoken odds state the price', /20 gold/.test(r.tapped));
  // Spoken text is deliberately NOT the visible percentage string: reading "6%"
  // aloud does not help the reader who could not read it in the first place.
  check('A1: the spoken odds rank the rarities in plain words',
    /common is most likely/i.test(r.tapped) && /rare is less likely/i.test(r.tapped) &&
    /epic is hard to find/i.test(r.tapped) && /legendary is very rare/i.test(r.tapped));
  check('A1: the spoken odds state the pity guarantee', /within 15 pulls/i.test(r.tapped));
  check('A1: the spoken odds do not read percentages aloud', !/%/.test(r.tapped));
  check('A1: no console errors', errors.length === 0);
  await browser.close();
}

// --- Odds wording: the pity counter forces a Legendary, so a flat "every pull"
//     percentage would be untrue on exactly the pull the child is watching. ---
{
  const { browser, page, errors } = await launch();
  const r = await page.evaluate(() => {
    selectProfile('adventurer');
    openDumplingVendor();
    return {
      odds: document.getElementById('dumplingOdds').textContent,
      pity: document.getElementById('dumplingPity').textContent
    };
  });

  check('odds: labelled as base odds, not every pull', /^Base odds:/.test(r.odds));
  check('odds: does not claim "every pull"', !/every pull/i.test(r.odds));
  check('odds: the pity guarantee is still shown beside it', /legendary/i.test(r.pity));
  check('odds: no console errors', errors.length === 0);
  await browser.close();
}

// --- Dough-pick lifecycle: selection mode is per-visit. A stall that reopens already
//     in "choose a dumpling" mode gives a child no visible cause for it. ---
{
  const { browser, page, errors } = await launch();
  const r = await page.evaluate(() => {
    selectProfile('adventurer');
    player.dumplingDough = DUMPLING_DOUGH_PER_PICK * 2;
    player.gold = 500;
    openDumplingVendor();
    openDoughPicker();
    const active = dumplingPickMode;
    const btn = document.getElementById('dumplingDoughAction');
    const cancelLabel = btn.textContent;
    closeDumplingVendor();
    const afterClose = dumplingPickMode;
    openDumplingVendor();
    const afterReopen = dumplingPickMode;
    const reopenLabel = document.getElementById('dumplingDoughAction').textContent;

    // Cancel path: the screen must stop asking for a tap it will no longer accept.
    openDoughPicker();
    cancelDoughPicker();
    const afterCancel = dumplingPickMode;
    const cancelStatus = document.getElementById('dumplingStatus').textContent;
    const cancelBtnLabel = document.getElementById('dumplingDoughAction').textContent;
    const stillPickable = document.querySelectorAll('#dumplingGrid .pickable').length;
    const enabledCards = Array.from(document.querySelectorAll('#dumplingGrid button'))
      .filter(b => !b.disabled && !(player.dumplings[b.dataset.id] > 0)).length;

    return { active, cancelLabel, afterClose, afterReopen, reopenLabel,
             afterCancel, cancelStatus, cancelBtnLabel, stillPickable, enabledCards };
  });

  check('dough: picking mode activates', r.active === true);
  check('dough: the button becomes Cancel choosing while active',
    /cancel choosing/i.test(r.cancelLabel));
  check('dough: closing the stall clears picking mode', r.afterClose === false);
  check('dough: reopening does not resume picking mode', r.afterReopen === false);
  check('dough: the reopened button offers choosing again',
    /choose a dumpling/i.test(r.reopenLabel));
  check('dough: cancelling clears picking mode', r.afterCancel === false);
  check('dough: cancelling leaves no pickable card', r.stillPickable === 0);
  check('dough: cancelling re-disables every unowned card', r.enabledCards === 0);
  check('dough: cancelling stops telling the child to tap a dumpling',
    !/tap the dumpling/i.test(r.cancelStatus));
  check('dough: cancelling says what happened', /cancelled/i.test(r.cancelStatus));
  check('dough: cancelling restores the choose action',
    /choose a dumpling/i.test(r.cancelBtnLabel));
  check('dough: no console errors', errors.length === 0);
  await browser.close();
}

// --- The two real phone defects. Computed style, not source strings: a grid that
//     collapses to zero height and a card that LOOKS tappable but is disabled are
//     both invisible to a source-text assertion. ---
{
  const { browser, page, errors } = await launch();
  await page.setViewport({ width: 390, height: 844, isMobile: true });
  const r = await page.evaluate(() => {
    selectProfile('adventurer');
    player.dumplingDough = DUMPLING_DOUGH_PER_PICK * 2;
    player.gold = 500;
    openDumplingVendor();
    const grid = document.getElementById('dumplingGrid');
    const gridHeight = grid.getBoundingClientRect().height;
    openDoughPicker();
    const cards = Array.from(grid.querySelectorAll('.dumpling-card'));
    const pickable = cards.filter(c => c.classList.contains('pickable'));
    const locked = cards.filter(c => !c.classList.contains('pickable') &&
                                     !c.classList.contains('owned'));
    const readBtn = document.getElementById('dumplingReadOdds');
    const readRect = readBtn.getBoundingClientRect();
    // The exit from selection mode must be on screen the moment picking begins:
    // openDoughPicker scrolls the dough panel (which carries the exit) into view.
    const cancel = document.getElementById('dumplingDoughAction').getBoundingClientRect();
    // The dough panel now sits ABOVE the shelf, so nothing ever scrolls over the
    // cards. Prove it two ways: the panel clears the grid entirely (no overlap at any
    // scroll), and the last card can be scrolled fully into view inside the grid's own
    // scroller (the shelf is the sole scrolling region now).
    const gridRect = grid.getBoundingClientRect();
    const panel = document.querySelector('.dumpling-dough-panel').getBoundingClientRect();
    grid.scrollTop = grid.scrollHeight;
    const lastCard = cards.length ? cards[cards.length - 1].getBoundingClientRect() : null;
    return {
      cancelInView: cancel.top >= 0 && cancel.bottom <= window.innerHeight,
      panelAboveShelf: panel.bottom <= gridRect.top + 1,
      lastCardClear: !!lastCard && lastCard.bottom <= gridRect.bottom + 1 &&
                                   lastCard.top >= gridRect.top - 1,
      gridHeight,
      cardCount: cards.length,
      pickableCount: pickable.length,
      pickableDisabled: pickable.some(c => c.disabled === true ||
                                           getComputedStyle(c).pointerEvents === 'none'),
      lockedStillDim: locked.every(c => parseFloat(getComputedStyle(c).opacity) < 1),
      readW: readRect.width, readH: readRect.height
    };
  });

  check('phone: the shelf has usable rendered height', r.gridHeight > 40);
  check('phone: the way out of choosing stays on screen', r.cancelInView === true);
  check('phone: the dough panel sits above the shelf, never over it', r.panelAboveShelf === true);
  check('phone: the last card scrolls fully into view', r.lastCardClear === true);
  check('phone: the shelf actually renders its cards', r.cardCount === 18);
  check('phone: pickable cards exist while choosing', r.pickableCount > 0);
  check('phone: pickable cards are not disabled', r.pickableDisabled === false);
  check('phone: ordinary locked cards stay visibly dimmed', r.lockedStillDim === true);
  check('phone: Read Odds meets the 44px touch minimum',
    r.readW >= 44 && r.readH >= 44);
  check('phone: no console errors', errors.length === 0);
  await browser.close();
}

console.log(fails.length ? `\n${fails.length} FAILED:\n  ` + fails.join('\n  ') : '\nAll dumpling compliance tests passed.');
process.exit(fails.length ? 1 : 0);
