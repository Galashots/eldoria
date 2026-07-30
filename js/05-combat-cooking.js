// ---- Combat (slice 10c) ----
// A turn-based battle, built to feel like the quest/bonus modals. You ATTACK by
// answering a math question: right answer = deal damage, wrong = miss. EITHER way
// the enemy bites back for a small fixed amount, but you are NEVER stuck — there is
// always another question next turn. Win at enemy HP 0 (earn XP); lose at your HP 0
// (respawn at the Wilds entrance, full HP, no penalty — never punitive).
// One shared system for both profiles; only the math grade changes (see makeCombatQuestion).
var combatOpen = false;     // is the battle modal up?
var combatAnswer = 0;       // correct answer to the current question
var combatEnemy = null;     // a fresh, fightable COPY of the enemy template for this fight
var combatSource = null;    // the WILDS_ENEMIES entry this fight is against

// Sum of +damage from all equipped gear.
function gearDamageBonus() {
  var bonus = 0;
  for (var slot in player.gear) {
    if (player.gear[slot] && GEAR[player.gear[slot]]) bonus += GEAR[player.gear[slot]].damage;
  }
  return bonus;
}

// How much damage the player deals on a correct answer. Grows with level + gear.
function playerDamage() {
  return 5 + (player.level - 1) * 2 + gearDamageBonus() + player.atkUpgrades * TRAIN_ATK;
}

// Roll the enemy's loot table for a gear drop. Returns the item id or null.
function rollLoot(enemyType) {
  var loot = ENEMIES[enemyType].loot;
  if (!loot) return null;
  for (var i = 0; i < loot.length; i++) {
    if (Math.random() < loot[i].chance) return loot[i].item;
  }
  return null;
}

// Equip a gear drop if it's better than what's in that slot (or slot is empty). Anything
// not equipped goes into your bag (player.inventory) so you can SELL it later — nothing is
// ever silently lost. Equipped gear is never in the bag, so you can't sell what you wear.
function equipGear(itemId) {
  var item = GEAR[itemId];
  if (!item) return;
  var current = player.gear[item.slot];
  if (current && GEAR[current] && GEAR[current].damage >= item.damage) {
    // Not an upgrade — keep it in the bag to sell for gold.
    player.inventory.push(itemId);
    showToast('Found ' + item.name + ' — in your bag to sell (' + gearSellPrice(itemId) + 'g).');
    speak('You found a ' + item.name + '. It is in your bag to sell.');
    return;
  }
  // It's an upgrade: the old item (if any) drops into the bag so it's not lost.
  if (current) player.inventory.push(current);
  player.gear[item.slot] = itemId;
  showToast('Equipped ' + item.name + '! +' + item.damage + ' damage');
  speak('You found a ' + item.name + '! Plus ' + item.damage + ' damage!');
}

// What a spare gear item sells for: 5 gold per damage point (the price IS a multiply —
// hidden curriculum). Equipped gear isn't sellable, so this only ever runs on bag items.
function gearSellPrice(itemId) {
  var item = GEAR[itemId];
  return item ? item.damage * 5 : 0;
}

// Sell one spare gear item from the bag (by its index in player.inventory).
function sellGear(index) {
  if (index < 0 || index >= player.inventory.length) return;
  var itemId = player.inventory[index];
  var price = gearSellPrice(itemId);
  player.inventory.splice(index, 1);
  player.gold += price;
  soundCoin();
  showToast('Sold ' + GEAR[itemId].name + ' for ' + price + 'g!');
  speak('You sold the ' + GEAR[itemId].name + ' for ' + price + ' gold.');
  updateHUD();
  saveGame();
}

// Build the "Sell spare gear" rows in the shop from the bag. Hidden when the bag is empty.
function renderGearSell() {
  var section = document.getElementById('gearSellSection');
  var list = document.getElementById('gearSellList');
  if (!section || !list) return;
  if (player.inventory.length === 0) {
    section.style.display = 'none';
    list.innerHTML = '';
    return;
  }
  section.style.display = 'block';
  var html = '';
  for (var i = 0; i < player.inventory.length; i++) {
    var id = player.inventory[i];
    var g = GEAR[id];
    if (!g) continue;
    var price = gearSellPrice(id);
    html += '<div class="shop-row">' +
      '<div class="shop-info"><b>' + g.name + '</b><small>+' + g.damage + ' dmg · sells ' + price + 'g</small></div>' +
      '<button class="btn-sell" onclick="sellGear(' + i + ')" aria-label="Sell ' + g.name + ' for ' + price + ' gold">Sell ' + price + 'g</button>' +
      '</div>';
  }
  list.innerHTML = html;
}

// XP needed to reach the next level (kept simple: level × 50).
function xpForNextLevel() {
  return player.level * 50;
}

// Build a battle question sized to the profile. Both return { text, answer, options }.
//   adventurer (older reader, ~grade 5): subtraction, sometimes estimation (rounding).
//   mage (early reader, ~grade 2): subtraction with both numbers and answer kept ≤ 20.
function makeCombatQuestion() {
  if (currentProfile === 'adventurer') {
    // ~1 in 3 questions is an estimation (round each number to the nearest ten, add).
    if (Math.random() < 0.34) {
      var ea = 10 + Math.floor(Math.random() * 80);   // 10..89
      var eb = 10 + Math.floor(Math.random() * 80);   // 10..89
      var est = roundToTen(ea) + roundToTen(eb);
      return { text: 'About how much? ' + ea + ' + ' + eb, answer: est, options: tensOptions(est) };
    }
    // Subtraction with a positive answer, e.g. "48 − 17 = ?".
    var x = 20 + Math.floor(Math.random() * 60);      // 20..79
    var y = 1 + Math.floor(Math.random() * (x - 1));  // 1..x-1 (answer stays ≥ 1)
    return { text: x + ' − ' + y + ' = ?', answer: x - y, options: makeOptions(x - y) };
  }
  // 'mage' (and any non-adventurer): subtraction kept small, e.g. "14 − 6 = ?".
  var a = 5 + Math.floor(Math.random() * 16);   // 5..20
  var b = 1 + Math.floor(Math.random() * a);    // 1..a  (answer ≥ 0)
  return { text: a + ' − ' + b + ' = ?', answer: a - b, options: makeOptions(a - b) };
}

function roundToTen(n) { return Math.round(n / 10) * 10; }

// Three estimation options spaced by tens (so the rounded answer is the clear pick).
function tensOptions(answer) {
  var opts = [answer];
  var guard = 0;
  while (opts.length < 3 && guard++ < 50) {
    var cand = answer + (1 + Math.floor(Math.random() * 3)) * 10 * (Math.random() < 0.5 ? -1 : 1);
    if (cand >= 0 && opts.indexOf(cand) === -1) opts.push(cand);
  }
  for (var i = opts.length - 1; i > 0; i--) {
    var j = Math.floor(Math.random() * (i + 1));
    var t = opts[i]; opts[i] = opts[j]; opts[j] = t;
  }
  return opts;
}

// Turn a "14 − 6 = ?" style line into something the voice can read aloud.
function spokenQuestion(text) {
  return text.replace('−', 'minus').replace('×', 'times').replace('+', 'plus')
             .replace(' = ?', '').replace('?', '');
}

// Repaint both HP bars (width + number) from the live combat state.
function updateCombatBars() {
  if (!combatEnemy) return;
  var ePct = Math.max(0, combatEnemy.hp) / combatEnemy.maxHp * 100;
  document.getElementById('enemyName').textContent = combatEnemy.name;
  document.getElementById('enemyHpFill').style.width = ePct + '%';
  document.getElementById('enemyHpNum').textContent = Math.max(0, combatEnemy.hp) + '/' + combatEnemy.maxHp;
  var yPct = Math.max(0, player.hp) / player.maxHp * 100;
  document.getElementById('youHpFill').style.width = yPct + '%';
  document.getElementById('youHpNum').textContent = Math.max(0, player.hp) + '/' + player.maxHp;
}

// Start a fight with a specific Wilds enemy. Makes a COPY so the template stays pristine.
function openCombat(enemyEntry) {
  if (!gameActive || shopOpen || mathOpen || seedPickerOpen || questOpen || combatOpen || cookingOpen || dumplingOpen) return;
  if (!enemyEntry) enemyEntry = isNearEnemy();
  if (!enemyEntry || !enemyEntry.alive) return;
  combatSource = enemyEntry;
  var base = ENEMIES[enemyEntry.type];
  combatEnemy = { name: base.name, hp: base.hp, maxHp: base.hp, attack: base.attack, xpReward: base.xpReward, type: enemyEntry.type };
  combatOpen = true;
  document.getElementById('combatModal').classList.add('open');
  document.getElementById('combatTitle').textContent = 'A wild ' + combatEnemy.name + '!';
  nextCombatTurn('Solve the problem to attack!');
  focusModal('combatModal');
}

// Show the next question (and the result of the last turn) and refresh the bars.
// The world HUD is refreshed too: combat changes HP and food, and leaving those to be
// picked up by some later call meant the HUD could sit stale for a whole fight (ELD-PT-004).
function nextCombatTurn(message) {
  updateCombatBars();
  updateHUD();
  document.getElementById('combatMsg').textContent = message || '';

  var q = makeCombatQuestion();
  combatAnswer = q.answer;
  document.getElementById('combatQuestion').textContent = q.text;
  // Read the turn message + the question aloud for the early-reader slot.
  speak((message ? message + ' ' : '') + 'What is ' + spokenQuestion(q.text) + '?');

  var box = document.getElementById('combatAnswers');
  box.innerHTML = '';
  for (var i = 0; i < q.options.length; i++) {
    var btn = document.createElement('button');
    btn.className = 'btn-answer';
    btn.textContent = q.options[i];
    btn.dataset.value = q.options[i];
    btn.addEventListener('click', onCombatAnswerClick);
    box.appendChild(btn);
  }

  // Show the eat-food button if the player has food and isn't at full HP.
  var eatRow = document.getElementById('combatFoodRow');
  var bf = bestFood();
  if (bf && player.hp < player.maxHp) {
    eatRow.style.display = 'block';
    document.getElementById('combatEatBtn').textContent =
      'Eat ' + RECIPES[bf].name + ' (+' + Math.min(RECIPES[bf].heal, player.maxHp - player.hp) + ' HP)';
  } else {
    eatRow.style.display = 'none';
  }
}

function onCombatAnswerClick(e) {
  answerCombat(parseInt(e.currentTarget.dataset.value, 10));
}

// Combat slash phase: answer math, then mash SLASH for BONUS damage.
//
// The invariant this enforces (ELD-PT-002): **answering correctly always beats answering
// wrongly, no matter how fast anyone taps.**
//
//   correct, zero taps  = 2 x baseDmg   (banked before the window even opens)
//   wrong,  any taps    <= 1 x baseDmg  (hard cap, see slashDamageCap)
//
// So the floor on a right answer is strictly above the ceiling on a wrong one. Tapping
// still rewards a correct answer without limit, but it can never turn a wrong answer into
// the better play. A wrong answer keeps a small consolation payout because losing is
// deliberately never punitive in this game — it just cannot out-earn knowing the answer.
var slashDmgPerHit = 0;
var slashHits = 0;
var slashDamageDone = 0;        // damage dealt so far this window (respects the cap)
var slashDamageCap = Infinity;  // total damage this window may ever deal
var slashTimerId = 0;
var slashActive = false;
var SLASH_TIME_ADV = 3000;
var SLASH_TIME_MAGE = 5000;
function slashTime() { return (currentProfile === 'mage') ? SLASH_TIME_MAGE : SLASH_TIME_ADV; }

function answerCombat(value) {
  if (!combatOpen || !combatEnemy) return;
  var correct = (value === combatAnswer);
  var baseDmg = playerDamage();

  if (correct) {
    soundCorrect();
    slashDmgPerHit = baseDmg * 2;
    slashDamageCap = Infinity;
    // One free hit is banked immediately: right answer => damage, guaranteed.
    startSlashPhase(slashTime(), 'RIGHT! Free hit! Slash for more!', 1);
  } else {
    // Half damage per tap, and the whole window is capped at one baseDmg — strictly less
    // than the 2 x baseDmg a correct answer banks for free.
    slashDmgPerHit = Math.max(1, Math.floor(baseDmg / 2));
    slashDamageCap = baseDmg;
    if (typeof HTMLElement !== 'undefined') {
      startSlashPhase(slashTime(), 'Not quite — slash for a little damage!', 0);
    } else {
      player.hp -= combatEnemy.attack;
      if (player.hp <= 0) { player.hp = 0; loseCombat(); return; }
      nextCombatTurn('Miss! ' + combatEnemy.name + ' hits you for ' + combatEnemy.attack + '.');
    }
  }
}

// freeHits: hits awarded up front for answering correctly. They are applied AFTER the
// window is set up so a lethal free hit can close combat cleanly, and they count toward
// slashHits so the on-screen tally and the end-of-turn total stay honest.
function startSlashPhase(duration, msg, freeHits) {
  slashHits = 0;
  slashDamageDone = 0;
  slashActive = true;
  if (typeof HTMLElement !== 'undefined') {
    document.getElementById('combatAnswers').innerHTML = '';
    document.getElementById('combatQuestion').textContent = '';
    document.getElementById('combatMsg').textContent = msg;
    speak(msg);
    var zone = document.getElementById('slashZone');
    zone.style.display = 'block';
    document.getElementById('slashCount').textContent = 'Hits: 0';
    document.getElementById('combatModal').classList.add('slash-mode');
    var timerBar = document.getElementById('slashTimer');
    timerBar.style.transition = 'none';
    timerBar.style.width = '100%';
    void timerBar.offsetWidth;
    timerBar.style.transition = 'width ' + duration + 'ms linear';
    timerBar.style.width = '0%';
    document.getElementById('combatFoodRow').style.display = 'none';
    slashTimerId = setTimeout(endSlashPhase, duration);
    for (var f = 0; f < (freeHits || 0) && slashActive; f++) executeSlash();
  } else {
    for (var f2 = 0; f2 < (freeHits || 0) && slashActive; f2++) executeSlash();
    if (slashActive) executeSlash();
    if (slashActive) endSlashPhase();
  }
}

function executeSlash() {
  if (!slashActive || !combatOpen || !combatEnemy) return;
  // A wrong answer's window is capped. Once it is spent, further taps are acknowledged on
  // screen but deal nothing — the player is told plainly what would have earned more.
  var dmg = Math.min(slashDmgPerHit, slashDamageCap - slashDamageDone);
  if (dmg <= 0) {
    var cappedEl = document.getElementById('slashCount');
    if (cappedEl) cappedEl.textContent = slashDamageDone + ' dmg — answer right for a big free hit!';
    return;
  }
  slashHits++;
  slashDamageDone += dmg;
  combatEnemy.hp -= dmg;
  soundCorrect();
  // Floating damage number over the player's position
  var pr = Math.floor(player.y / TILE);
  var pc = Math.floor(player.x / TILE);
  addPop(pr, pc, '-' + dmg, dmg > playerDamage() ? '#ffdd44' : '#ff6644');
  triggerShake();
  player.attacking = true;
  player.attackFrame = 0;
  player.attackLastAt = Date.now();
  var bar = document.getElementById('enemyHpFill');
  if (bar) {
    bar.classList.remove('slash-flash');
    void bar.offsetWidth;
    bar.classList.add('slash-flash');
  }
  updateCombatBars();
  var countEl = document.getElementById('slashCount');
  if (countEl) countEl.textContent = 'Hits: ' + slashHits + ' (' + slashDamageDone + ' dmg)';
  if (combatEnemy.hp <= 0) {
    combatEnemy.hp = 0;
    slashActive = false;
    clearTimeout(slashTimerId);
    var zone = document.getElementById('slashZone');
    if (zone) zone.style.display = 'none';
    winCombat();
  }
}

function endSlashPhase() {
  if (!slashActive) return;
  slashActive = false;
  player.attacking = false;
  player.attackFrame = 0;
  var overlay = document.getElementById('combatModal');
  if (overlay) overlay.classList.remove('slash-mode');
  var zone = document.getElementById('slashZone');
  if (zone) zone.style.display = 'none';
  if (!combatOpen || !combatEnemy) return;
  var totalDmg = slashDamageDone;
  player.hp -= combatEnemy.attack;
  // Enemy hit-back damage pop (red)
  var pr = Math.floor(player.y / TILE);
  var pc = Math.floor(player.x / TILE);
  addPop(pr, pc, '-' + combatEnemy.attack, '#ff4444');
  triggerShake();
  soundHit();
  if (player.hp <= 0) {
    player.hp = 0;
    loseCombat();
    return;
  }
  var msg = slashHits + ' hits for ' + totalDmg + ' total! ' + combatEnemy.name + ' hits you for ' + combatEnemy.attack + '.';
  nextCombatTurn(msg);
}

// Win: enemy defeated. Award XP, roll for a gear drop, mark it dead.
function winCombat() {
  updateCombatBars();
  var name = combatEnemy.name;
  var xp = combatEnemy.xpReward;
  var enemyType = combatEnemy.type;
  if (combatSource) {
    combatSource.alive = false;
    combatSource.respawnAt = Date.now() + 30000;
  }
  if (!player.killCounts) player.killCounts = {};
  player.killCounts[enemyType] = (player.killCounts[enemyType] || 0) + 1;
  closeCombat();
  soundWin();
  var isBoss = ENEMIES[enemyType] && ENEMIES[enemyType].boss;
  if (isBoss) {
    showToast('★ You defeated the ' + name + '! ★  +' + xp + ' XP');
    speak('Amazing! You defeated the ' + name + '! You earned ' + xp + ' experience!');
  } else {
    showToast('You beat the ' + name + '! +' + xp + ' XP');
    speak('You beat the ' + name + '! You earned ' + xp + ' experience.');
  }
  gainXp(xp);
  // Roll the loot table for a gear drop.
  var drop = rollLoot(enemyType);
  if (drop) equipGear(drop);
  checkKillQuest(enemyType);
  updateHUD();
  saveGame();
}

// Add XP and level up as many times as the new total allows. Leveling raises maxHp
// and fully heals (a clean reward), with a toast + sound each time.
function gainXp(amount) {
  player.xp += amount;
  while (player.xp >= xpForNextLevel()) {
    player.xp -= xpForNextLevel();
    player.level++;
    player.maxHp += 5;
    player.hp = player.maxHp;   // full heal on level up
    soundLevelUp();
    showToast('Level up! You are level ' + player.level + '!');
    speak('Level up! You are now level ' + player.level + '.');
  }
}

// Lose: respawn at the current area's entrance with full HP and NO penalty. Never punitive.
// All enemies in this area stay/turn alive so the player can walk back and try again.
function loseCombat() {
  updateCombatBars();
  closeCombat();
  player.hp = player.maxHp;
  player.x = 1 * TILE;   // just inside the left entrance of the current area
  // Find the left-edge exit row so we spawn on the road
  var faintRow = 9;
  for (var fr = 0; fr < MAP_H; fr++) { if (map[fr][0] === EXIT) { faintRow = fr; break; } }
  player.y = faintRow * TILE;
  for (var i = 0; i < currentEnemies.length; i++) currentEnemies[i].alive = true;
  wasNearEnemy = false;  // don't instantly re-trigger from the old position
  showToast('You fainted! Back to the entrance, full HP.');
  speak('You fainted! No worries — back to the start with full health.');
  updateHUD();
  saveGame();
}

// Pick the best food to eat (highest heal that won't over-heal too much, or just the best available).
function bestFood() {
  var best = null, bestHeal = 0;
  for (var i = 0; i < FOOD_TYPES.length; i++) {
    var fid = FOOD_TYPES[i];
    if (player.food[fid] <= 0) continue;
    var h = RECIPES[fid].heal;
    if (h > bestHeal) { best = fid; bestHeal = h; }
  }
  return best;
}

// Eat food mid-combat: heals HP but costs your turn (enemy still attacks).
function eatInCombat() {
  if (!combatOpen || !combatEnemy) return;
  var fid = bestFood();
  if (!fid) return;
  var rec = RECIPES[fid];
  player.food[fid]--;
  var healed = Math.min(rec.heal, player.maxHp - player.hp);
  player.hp += healed;
  soundEat();
  var msg = 'Ate ' + rec.name + '! +' + healed + ' HP. ';
  speak('You ate ' + rec.name + ' and healed ' + healed + ' health.');

  // Enemy still attacks on your eat turn.
  player.hp -= combatEnemy.attack;
  soundHit();
  if (player.hp <= 0) {
    player.hp = 0;
    loseCombat();
    return;
  }
  msg += combatEnemy.name + ' hits you ' + combatEnemy.attack + '.';
  // Eating spends a real item and real HP — persist it immediately so a reload mid-fight
  // can never hand the food back (ELD-PT-004).
  saveGame();
  nextCombatTurn(msg);
}

// Flee: close the battle, no harm done. The player can always walk back to retry.
// Anything spent or taken during the fight is committed on the way out.
function fleeCombat() {
  closeCombat();
  updateHUD();
  saveGame();
  showToast('You backed away.');
}

function closeCombat() {
  combatOpen = false;
  slashActive = false;
  player.attacking = false;
  player.attackFrame = 0;
  clearTimeout(slashTimerId);
  var zone = document.getElementById('slashZone');
  if (zone) zone.style.display = 'none';
  var overlay = document.getElementById('combatModal');
  overlay.classList.remove('open');
  overlay.classList.remove('slash-mode');
  restoreFocus();
}

// ---- Cooking (slice 13a) ----
// Walk up to the Farm cooking pot and turn crops into food. Each recipe shows its
// ingredient cost and how much HP it heals — the hidden math is RATIO/efficiency
// (most HP per crop). Cooked food is eaten to heal, which feeds straight back into
// combat. Never a gate: you just cook what you have ingredients for.

// Do we have the crops a recipe needs?
function canCook(recipeId) {
  var cost = RECIPES[recipeId].cost;
  for (var crop in cost) {
    if (player.crops[crop] < cost[crop]) return false;
  }
  return true;
}

// Short "2 turnip, 1 carrot" style ingredient summary for a recipe row.
function recipeCostText(recipeId) {
  var cost = RECIPES[recipeId].cost;
  var parts = [];
  for (var crop in cost) parts.push(cost[crop] + ' ' + CROPS[crop].name);
  return parts.join(' + ');
}

function openCooking() {
  if (!gameActive || shopOpen || mathOpen || seedPickerOpen || questOpen || combatOpen || cookingOpen || dumplingOpen) return;
  cookingOpen = true;
  document.getElementById('cookingModal').classList.add('open');
  renderCooking();
  speakToAll('Cook your crops into food. Which dish heals the most?');
  focusModal('cookingModal');
}

// (Re)build the recipe rows and the "your food" rows from current state.
function renderCooking() {
  // Recipe rows: each shows ingredients + heal, with a Cook button (disabled if short).
  var rbox = document.getElementById('recipeRows');
  rbox.innerHTML = '';
  for (var i = 0; i < FOOD_TYPES.length; i++) {
    var id = FOOD_TYPES[i];
    var rec = RECIPES[id];
    var row = document.createElement('div');
    row.className = 'shop-row';
    var dot = document.createElement('span');
    dot.className = 'crop-dot';
    dot.style.background = rec.color;
    var info = document.createElement('div');
    info.className = 'shop-info';
    info.innerHTML = '<b>' + rec.name + '</b> — heals ' + rec.heal +
                     ' HP<small>needs ' + recipeCostText(id) + '</small>';
    var btn = document.createElement('button');
    btn.className = 'btn-buy';
    btn.textContent = 'Cook';
    btn.disabled = !canCook(id);
    btn.dataset.recipe = id;
    btn.addEventListener('click', onCookClick);
    row.appendChild(dot); row.appendChild(info); row.appendChild(btn);
    rbox.appendChild(row);
  }

  // Your-food rows: each food you own, with an Eat button (disabled when already full HP).
  var fbox = document.getElementById('foodRows');
  fbox.innerHTML = '';
  var full = (player.hp >= player.maxHp);
  var have = false;
  for (var j = 0; j < FOOD_TYPES.length; j++) {
    var fid = FOOD_TYPES[j];
    if (player.food[fid] <= 0) continue;
    have = true;
    var frec = RECIPES[fid];
    var frow = document.createElement('div');
    frow.className = 'shop-row';
    var fdot = document.createElement('span');
    fdot.className = 'crop-dot';
    fdot.style.background = frec.color;
    var finfo = document.createElement('div');
    finfo.className = 'shop-info';
    finfo.innerHTML = '<b>' + frec.name + '</b> ×' + player.food[fid] +
                      '<small>+' + frec.heal + ' HP</small>';
    var fbtn = document.createElement('button');
    fbtn.className = 'btn-sell';
    fbtn.textContent = 'Eat';
    fbtn.disabled = full;
    fbtn.dataset.food = fid;
    fbtn.addEventListener('click', onEatClick);
    frow.appendChild(fdot); frow.appendChild(finfo); frow.appendChild(fbtn);
    fbox.appendChild(frow);
  }
  document.getElementById('foodEmpty').style.display = have ? 'none' : 'block';
  document.getElementById('cookHpLine').textContent =
    'Your HP: ' + player.hp + '/' + player.maxHp + (full ? ' (full!)' : '');
}

function onCookClick(e) { cookRecipe(e.currentTarget.dataset.recipe); }
function onEatClick(e)  { eatFood(e.currentTarget.dataset.food); }

// Cook one portion: spend the crops, gain the food, then offer a doubling question.
var doubleBatchRecipe = null;   // which recipe is pending its bonus question
var doubleBatchAnswer = 0;      // the correct answer

function cookRecipe(recipeId) {
  if (!canCook(recipeId)) return;
  var rec = RECIPES[recipeId];
  for (var crop in rec.cost) player.crops[crop] -= rec.cost[crop];
  player.food[recipeId]++;
  soundCook();

  // Offer a doubling question: answer right → free bonus portion.
  var q = makeDoubleBatchQuestion(recipeId);
  doubleBatchRecipe = recipeId;
  doubleBatchAnswer = q.answer;
  document.getElementById('doubleBatchQuestion').textContent = q.text;
  speak('You cooked ' + rec.name + '! Bonus round: ' + spokenQuestion(q.text) + '?');

  var box = document.getElementById('doubleBatchAnswers');
  box.innerHTML = '';
  var opts = makeOptions(q.answer);
  for (var i = 0; i < opts.length; i++) {
    var btn = document.createElement('button');
    btn.className = 'btn-answer';
    btn.textContent = opts[i];
    btn.dataset.value = opts[i];
    btn.addEventListener('click', onDoubleBatchClick);
    box.appendChild(btn);
  }

  document.getElementById('doubleBatchModal').classList.add('open');
  focusModal('doubleBatchModal');
}

function makeDoubleBatchQuestion(recipeId) {
  var rec = RECIPES[recipeId];
  if (currentProfile === 'adventurer') {
    // "If one batch heals 8, how much do two batches heal?"
    var heal = rec.heal;
    return { text: heal + ' × 2 = ?', answer: heal * 2 };
  } else {
    // Mage: simple addition doubling, kept small.
    var a = 1 + Math.floor(Math.random() * 9); // 1..9
    return { text: a + ' + ' + a + ' = ?', answer: a + a };
  }
}

function onDoubleBatchClick(e) {
  answerDoubleBatch(parseInt(e.currentTarget.dataset.value, 10));
}

function answerDoubleBatch(value) {
  document.getElementById('doubleBatchModal').classList.remove('open');
  restoreFocus();
  var correct = (value === doubleBatchAnswer);
  var rec = RECIPES[doubleBatchRecipe];
  if (correct) {
    player.food[doubleBatchRecipe]++;
    soundCorrect();
    showToast('Double batch! 2× ' + rec.name + '!');
    speak('Correct! You got a double batch!');
  } else {
    showToast('Cooked ' + rec.name + '!');
    speak('Good try! You still made one ' + rec.name + '.');
  }
  doubleBatchRecipe = null;
  updateHUD();
  renderCooking();
  saveGame();
}

// Eat one portion: heal HP (capped at maxHp). No effect (and no waste) at full HP.
function eatFood(foodId) {
  if (player.food[foodId] <= 0) return;
  if (player.hp >= player.maxHp) { showToast('Already full HP!'); return; }
  var rec = RECIPES[foodId];
  player.food[foodId]--;
  var healed = Math.min(rec.heal, player.maxHp - player.hp);
  player.hp += healed;
  soundEat();
  showToast('Ate ' + rec.name + '! +' + healed + ' HP');
  speak('Yum! You healed ' + healed + ' health.');
  updateHUD();
  renderCooking();
  saveGame();
}

function closeCooking() {
  cookingOpen = false;
  document.getElementById('cookingModal').classList.remove('open');
  restoreFocus();
}

// ---- Shop open/close (walk-in building) ----
function openShop() {
  shopOpen = true;
  document.getElementById('shopModal').classList.add('open');
  updateHUD();
  if (currentProfile === 'mage') {
    var lines = 'Welcome to the store! You can buy seeds: ';
    for (var si = 0; si < CROP_TYPES.length; si++) {
      var ci = CROPS[CROP_TYPES[si]];
      lines += ci.name + ' costs ' + ci.cost + ' gold and sells for ' + ci.sell + '. ';
    }
    // Name the measure: "most gold" alone can mean profit, profit per second, or return on
    // cost, and most crops share the same margin, so the old wording had no single right
    // answer (ELD-PT-014). Profit for one harvest is the one the shop's numbers support.
    lines += 'You can also buy a Heart Crystal for more health, or Training for more attack power. ';
    lines += 'Which seed earns the most gold profit from one harvest? Take away the seed cost from the sell price.';
    speak(lines);
  } else {
    speakToAll('Which seed earns the most gold profit per harvest? Sell price take away seed cost.');
  }
  focusModal('shopModal');
}
function closeShop() {
  shopOpen = false;
  document.getElementById('shopModal').classList.remove('open');
  restoreFocus();
}

// ---- Math-bonus auto-harvest (slice 7) ----
// Answer one quick question right -> auto-harvest ALL ready crops in this area as a
// BONUS. A wrong answer just means no bonus (you can still harvest by hand). It is
// NEVER a gate: it only ever ADDS crops, never blocks or takes anything away.
var mathOpen = false;
var mathAnswer = 0;   // the correct answer to the current question

// How many crops are ready to harvest in the area the player is standing in?
function countReady() {
  var n = 0;
  for (var key in cropData) {
    if (cropData[key].status === 'ready') n++;
  }
  return n;
}

// Build a question sized to the profile: adventurer = multiplication, mage = small sums (≤20).
function makeQuestion() {
  var a, b, text, answer;
  if (currentProfile === 'adventurer') {
    a = 2 + Math.floor(Math.random() * 8);   // 2..9
    b = 2 + Math.floor(Math.random() * 8);   // 2..9
    answer = a * b;
    text = a + ' × ' + b + ' = ?';
  } else {
    // 'mage' (and any non-adventurer): addition with the total kept at or below 20.
    a = 1 + Math.floor(Math.random() * 10);  // 1..10
    b = 1 + Math.floor(Math.random() * (Math.min(10, 20 - a)));  // keeps a+b ≤ 20
    answer = a + b;
    text = a + ' + ' + b + ' = ?';
  }
  return { text: text, answer: answer };
}

// Three big-tap options: the correct answer plus two nearby (never negative) distractors.
function makeOptions(answer) {
  var opts = [answer];
  var guard = 0;
  while (opts.length < 3 && guard++ < 50) {
    var delta = (1 + Math.floor(Math.random() * 4)) * (Math.random() < 0.5 ? -1 : 1);
    var cand = answer + delta;
    if (cand >= 0 && opts.indexOf(cand) === -1) opts.push(cand);
  }
  // shuffle
  for (var i = opts.length - 1; i > 0; i--) {
    var j = Math.floor(Math.random() * (i + 1));
    var t = opts[i]; opts[i] = opts[j]; opts[j] = t;
  }
  return opts;
}

function openMathBonus() {
  if (!gameActive || shopOpen || mathOpen || seedPickerOpen || questOpen || combatOpen || cookingOpen || dumplingOpen) return;
  if (countReady() === 0) { showToast('No crops ready yet!'); return; }

  var q = makeQuestion();
  mathAnswer = q.answer;
  document.getElementById('mathQuestion').textContent = q.text;
  // Read the question aloud for the early-reader slot (e.g. "What is 3 plus 8?").
  var spoken = q.text.replace('×', 'times').replace('+', 'plus').replace(' = ?', '');
  speak('What is ' + spoken + '?');

  var box = document.getElementById('mathAnswers');
  box.innerHTML = '';
  var opts = makeOptions(q.answer);
  for (var i = 0; i < opts.length; i++) {
    var btn = document.createElement('button');
    btn.className = 'btn-answer';
    btn.textContent = opts[i];
    btn.dataset.value = opts[i];
    btn.addEventListener('click', onAnswerClick);
    box.appendChild(btn);
  }

  mathOpen = true;
  document.getElementById('mathModal').classList.add('open');
  focusModal('mathModal');
}

function onAnswerClick(e) {
  answerMath(parseInt(e.currentTarget.dataset.value, 10));
}

function answerMath(value) {
  var correct = (value === mathAnswer);
  closeMathBonus();
  if (correct) {
    var n = autoHarvestReady();
    soundCorrect();
    showToast('Correct! Bonus harvest +' + n + ' crops!');
    speak('Correct! You harvested ' + n + ' crops!');
  } else {
    showToast('No bonus this time — harvest by hand!');
    speak('Good try! Harvest by hand.');
  }
}

function closeMathBonus() {
  mathOpen = false;
  document.getElementById('mathModal').classList.remove('open');
  restoreFocus();
}

// Harvest every ready crop in the current area at once; returns how many were collected.
function autoHarvestReady() {
  var n = 0;
  for (var key in cropData) {
    if (cropData[key].status === 'ready') {
      var type = cropData[key].type || 'turnip';
      cropData[key].status = 'empty';
      cropData[key].plantedAt = 0;
      cropData[key].type = null;
      var parts = key.split(',');
      addPop(parseInt(parts[0], 10), parseInt(parts[1], 10), '+1');
      player.crops[type]++;
      n++;
    }
  }
  if (n > 0) soundHarvest();
  updateHUD();
  saveGame();
  return n;
}

