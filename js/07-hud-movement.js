// ---- HUD ----
function updateHUD() {
  document.getElementById('gold').textContent = player.gold;
  document.getElementById('seeds').textContent = totalSeeds();
  document.getElementById('crops').textContent = totalCrops();
  document.getElementById('food').textContent = totalFood();
  document.getElementById('hp').textContent = player.hp;
  document.getElementById('maxHp').textContent = player.maxHp;
  document.getElementById('level').textContent = player.level;
  // Disable each buy button if the player can't afford that seed type.
  for (var i = 0; i < CROP_TYPES.length; i++) {
    var btn = document.getElementById('btnBuy_' + CROP_TYPES[i]);
    if (btn) btn.disabled = player.gold < CROPS[CROP_TYPES[i]].cost;
  }
  // Labels/chips follow the chosen bulk quantity and current gold.
  if (typeof updateSeedBuyUI === 'function') updateSeedBuyUI();
  var btnSell = document.getElementById('btnSell');
  var tc = totalCrops();
  btnSell.disabled = tc === 0;
  btnSell.textContent = tc > 0 ? 'Sell All Crops (' + sellTotal() + 'g)' : 'Sell All Crops';
  var btnHeart = document.getElementById('btnBuyHeart');
  if (btnHeart) {
    var hp = heartCrystalPrice();
    btnHeart.textContent = 'Buy ' + hp + 'g';
    btnHeart.disabled = player.gold < hp;
  }
  var btnTrain = document.getElementById('btnBuyTraining');
  if (btnTrain) {
    var tp = trainingPrice();
    btnTrain.textContent = 'Buy ' + tp + 'g';
    btnTrain.disabled = player.gold < tp;
  }
  var qt = document.getElementById('questTracker');
  if (qt) {
    if (player.killQuest) {
      var kq = player.killQuest;
      qt.textContent = '⚔ ' + kq.name + ': ' + (kq.progress || 0) + '/' + kq.count;
      qt.style.display = 'block';
    } else {
      qt.style.display = 'none';
    }
  }
  renderGearSell();
  updateOnboardingChip();
}

// ---- Toast ----
var toastTimer = null;
function showToast(msg) {
  var el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(function() { el.classList.remove('show'); }, 1200);
}

// ---- Juice: sound, floating pops, and voiced text (slice 9) ----
// All offline & built-in: WebAudio for blips, canvas text for pops, SpeechSynthesis
// for reading prompts aloud to the early-reader slot. No assets, no network.

// Sound: one shared AudioContext, unlocked on the first tap (browser autoplay rule).
var audioCtx = null;
function ensureAudio() {
  try {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
  } catch (e) { audioCtx = null; }
}
// Play a short tone. Used to build little chimes; safe to call even if audio failed.
function playTone(freq, dur, type, delay) {
  if (!audioCtx || gameMuted) return;
  var t = audioCtx.currentTime + (delay || 0);
  var osc = audioCtx.createOscillator();
  var gain = audioCtx.createGain();
  osc.type = type || 'sine';
  osc.frequency.value = freq;
  osc.connect(gain); gain.connect(audioCtx.destination);
  gain.gain.setValueAtTime(0.18 * audioLevels.effects, t);
  gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
  osc.start(t); osc.stop(t + dur);
}
function soundHarvest() { playTone(660, 0.12, 'triangle'); }
function soundCoin()    { playTone(880, 0.08, 'square'); playTone(1320, 0.12, 'square', 0.07); }
function soundCorrect() { playTone(523, 0.1, 'sine'); playTone(659, 0.1, 'sine', 0.1); playTone(784, 0.16, 'sine', 0.2); }
// Combat blips (slice 10c): a thud when something gets hit, a fanfare on a win, a
// rising arpeggio on level-up. All built-in WebAudio, no assets.
function soundHit()      { playTone(150, 0.16, 'sawtooth'); }
function soundWin()      { playTone(659, 0.1, 'triangle'); playTone(988, 0.18, 'triangle', 0.1); }
function soundLevelUp()  { playTone(523, 0.12, 'sine'); playTone(659, 0.12, 'sine', 0.12); playTone(784, 0.12, 'sine', 0.24); playTone(1047, 0.22, 'sine', 0.36); }
// Cooking blips (slice 13a): a soft "sizzle" when cooking, a warm chime when eating.
function soundCook()     { playTone(420, 0.14, 'triangle'); playTone(560, 0.12, 'triangle', 0.08); }
function soundEat()      { playTone(700, 0.1, 'sine'); playTone(950, 0.14, 'sine', 0.08); }

// Floating "+1" pops that rise and fade above a tile.
var pops = [];
function addPop(row, col, text, color) {
  pops.push({ wx: col * TILE + 8, wy: row * TILE, text: text, born: Date.now(), color: color || null });
}

// Screen shake state
var shakeUntil = 0;
var SHAKE_DURATION = 120;
function triggerShake() { shakeUntil = Date.now() + SHAKE_DURATION; }

// The last instruction that was read aloud, so a child who missed it can ask for it
// again (ELD-PT-011). Routine chatter never lands here — only things worth repeating.
var lastSpokenInstruction = '';

// Say Again must never replay one child's instruction to the other. The buffer is
// cleared whenever the active profile changes (review catch: it leaked across a
// profile switch, so a sibling could tap the button and hear the other's prompt).
function clearLastInstruction() {
  lastSpokenInstruction = '';
  updateSayAgainButton();
}

function rememberInstruction(text) {
  if (!text) return;
  lastSpokenInstruction = text;
  updateSayAgainButton();
}

// Repeat the last instruction on demand. Works even with the speech level at zero:
// the child still gets the text on screen, which is the point of the button.
function sayItAgain(event) {
  if (event) event.stopPropagation();
  if (!lastSpokenInstruction) return;
  showToast(lastSpokenInstruction);
  speakAloud(lastSpokenInstruction, true);
}

function updateSayAgainButton() {
  var btn = document.getElementById('sayAgainBtn');
  if (btn) btn.hidden = !lastSpokenInstruction;
}

// Single place where speech actually reaches the browser, so the speech level and
// mute rule are applied once rather than at every call site.
function speakAloud(text, cancelFirst) {
  if (!('speechSynthesis' in window)) return;
  if (audioLevels.speech <= 0) return;
  try {
    if (cancelFirst) window.speechSynthesis.cancel();
    var u = new SpeechSynthesisUtterance(text);
    u.rate = 0.95;
    u.volume = audioLevels.speech;
    window.speechSynthesis.speak(u);
  } catch (e) {}
}

// Voiced text — early-reader slot only. No-op for the older reader / unsupported browsers.
function speak(text) {
  if (currentProfile !== 'mage') return;
  rememberInstruction(text);
  speakAloud(text, true);
}

// Queue a follow-up line without cancelling speech that just finished. Used when
// feedback must be heard first (for example, the answer -> Mira guide sequence).
function speakQueued(text) {
  if (currentProfile !== 'mage') return;
  rememberInstruction(text);
  speakAloud(text, false);
}

// Read aloud on both profiles (used for the shop hint nudge and Mira's Guide).
function speakToAll(text) {
  rememberInstruction(text);
  speakAloud(text, true);
}

// ---- Sound settings panel ----
var soundSettingsOpen = false;

function openSoundSettings() {
  soundSettingsOpen = true;
  syncSoundSettingsUI();
  modalShellOpen('soundModal');
}

function closeSoundSettings() {
  soundSettingsOpen = false;
  modalShellClose('soundModal');
}

// Push the current levels into the sliders. Called on open and on profile load so a
// child never sees another child's settings.
function syncSoundSettingsUI() {
  for (var i = 0; i < AUDIO_CHANNELS.length; i++) {
    var ch = AUDIO_CHANNELS[i];
    var pct = Math.round(audioLevels[ch] * 100);
    var slider = document.getElementById(ch + 'Level');
    var label = document.getElementById(ch + 'LevelValue');
    if (slider) slider.value = String(pct);
    if (label) label.textContent = pct + '%';
  }
}

// Dragging fires input continuously. Apply the level live, but never preview here:
// a slow drag across the bar would fire dozens of coin sounds and speech attempts.
function onAudioSliderInput(channel, value) {
  setAudioLevel(channel, Number(value) / 100);
  var label = document.getElementById(channel + 'LevelValue');
  if (label) label.textContent = Math.round(audioLevels[channel] * 100) + '%';
}

// Preview ONCE, when the child lets go (change fires at the end of a drag). This is
// the affordance that makes a level mean something to someone who cannot yet read
// the percentage.
function onAudioSliderCommit(channel) {
  if (channel === 'effects' && audioLevels.effects > 0) soundCoin();
  if (channel === 'speech' && audioLevels.speech > 0) speakAloud('Like this.', true);
}

if (typeof registerModal === 'function') registerModal('soundModal', closeSoundSettings);

// Routine confirmations — a purchase, a pickup, an equip. These are SHOWN, never
// spoken, no matter how fast the child taps (ELD-PT-011). Keeping them out of the
// speech queue is what stops rapid tapping turning into a wall of talking.
function announceRoutine(text) {
  showToast(text);
}

// ---- Update action button label based on what you're near ----
function updateActionLabel() {
  var btn = document.getElementById('actionBtn');
  var tile = getFacingTile();
  var canAct = false;   // is there something useful to do right here?
  if (isNearDoor() && !shopOpen) {
    btn.textContent = 'Shop';
    canAct = true;
  } else if (isNearEnemy()) {
    btn.textContent = 'Fight';
    canAct = true;
  } else if (isNearNPC()) {
    var nn = isNearNPC();
    if (nn.role === 'shop') btn.textContent = 'Shop';
    else if (nn.role === 'dumplings') btn.textContent = 'Dumplings';
    else btn.textContent = 'Talk';
    canAct = true;
  } else if (isNearCookpot()) {
    btn.textContent = 'Cook';           // standing by the Farm pot → cooking modal
    canAct = totalCrops() > 0 || totalFood() > 0;   // pulse if there's something to do
  } else if (!tile) {
    btn.textContent = 'Action';
  } else {
    var crop = cropData[tile.row + ',' + tile.col];
    if (crop.status === 'empty') {
      btn.textContent = 'Plant';
      canAct = totalSeeds() > 0;          // pulse only if you actually have seeds
    } else if (crop.status === 'growing') {
      btn.textContent = 'Growing...';     // nothing to do yet → stay calm
    } else if (crop.status === 'ready') {
      btn.textContent = 'Harvest!';
      canAct = true;
    }
  }
  // Pulse the Action button when standing on something you can do.
  btn.classList.toggle('ready', canAct);

  // Bonus-Harvest button: pulse when crops are ready, dim when there's nothing to grab.
  var ready = countReady() > 0;
  var bonus = document.getElementById('bonusBtn');
  bonus.classList.toggle('dim', !ready);
  bonus.classList.toggle('ready', ready);
}

// ---- Movement ----
function update() {
  if (!gameActive) return;   // nothing happens until a profile is chosen
  // Respawn dead enemies after their timer expires — across ALL of this profile's
  // areas, so an off-screen area's timers advance the same as the one on screen.
  var now = Date.now();
  for (var areaKey in AREA_ENEMIES) {
    var list = AREA_ENEMIES[areaKey];
    for (var ri = 0; ri < list.length; ri++) {
      var re = list[ri];
      if (!re.alive && re.respawnAt && now >= re.respawnAt) {
        re.alive = true;
        re.respawnAt = 0;
      }
    }
  }
  // Freeze the player while a modal (shop, math bonus, quest, battle, or the
  // Character screen) is open.
  if (!shopOpen && !mathOpen && !seedPickerOpen && !questOpen && !combatOpen && !cookingOpen && !dumplingOpen && !characterOpen) {
    var oldX = player.x, oldY = player.y;
    var dx = 0, dy = 0;
    if (held.left)  dx -= 1;
    if (held.right) dx += 1;
    if (held.up)    dy -= 1;
    if (held.down)  dy += 1;

    // Iso movement: the joystick is SCREEN-relative (up = up on screen). Convert the
    // screen vector to a UNIT world vector through the inverse projection, then derive
    // facing from world motion (eight-way; every facing has real art).
    if (dx !== 0 || dy !== 0) {
      var wvx = isoInputX(dx, dy), wvy = isoInputY(dx, dy);
      var wvl = Math.sqrt(wvx * wvx + wvy * wvy);
      dx = wvx / wvl;
      dy = wvy / wvl;
      player.facing = facingFromVector(dx, dy);
    }

    // Iso vectors are already unit-length. Projected movement uses its own tuning knob.
    var moveSpeed = player.speed * ISO_SPEED_MULT;
    dx *= moveSpeed;
    dy *= moveSpeed;

    if (dx !== 0 && !boxIsBlocked(player.x + dx, player.y)) player.x += dx;
    if (dy !== 0 && !boxIsBlocked(player.x, player.y + dy)) player.y += dy;

    // Only animate a walk when the player actually moved; pushing into a wall stays idle.
    player.walking = (player.x !== oldX || player.y !== oldY);
    if (player.walking) {
      var walkNow = Date.now();
      if (walkNow - player.walkLastAt >= WALK_FRAME_MS) {
        player.walkFrame = (player.walkFrame + 1) % WALK_FRAMES;
        player.walkLastAt = walkNow;
      }
    } else {
      player.walkFrame = 0;
    }
  } else {
    player.walking = false;
    player.walkFrame = 0;
  }

  // Open the shop as soon as the player is on OR next to the door (forgiving entry).
  wasNearDoor = isNearDoor();

  // Walking into a live Wilds enemy starts a battle (auto-open, like the shop door).
  // wasNearEnemy stops it from re-firing every frame, so fleeing then standing still
  // won't instantly reopen it — you walk away and back to re-trigger.
  var nearEnemy = isNearEnemy();
  if (nearEnemy && !wasNearEnemy && !combatOpen && !shopOpen && !mathOpen &&
      !questOpen && !seedPickerOpen && !dumplingOpen && !characterOpen) openCombat(nearEnemy);
  wasNearEnemy = !!nearEnemy;

  // Travel: stepping onto an EXIT road tile carries you to the other area.
  checkTravel();

  updateCrops();
  updateActionLabel();
  updateOnboardingChip();   // per-frame: guarantees the chip hides while combat is open
}

// ---- Area travel (walk onto an edge EXIT tile) ----
function checkTravel() {
  if (shopOpen || mathOpen || seedPickerOpen || questOpen || combatOpen || cookingOpen || dumplingOpen || characterOpen) return;
  var col = Math.floor((player.x + player.size / 2) / TILE);
  var row = Math.floor((player.y + player.size / 2) / TILE);
  if (row < 0 || row >= MAP_H || col < 0 || col >= MAP_W) return;
  if (map[row][col] !== EXIT) return;

  // Areas sit in a line (farm — town — wilds). The LEFT-edge exit (col 0) goes to
  // the previous area; the RIGHT-edge exit goes to the next one.
  var goingLeft = (col === 0);
  var idx = AREA_ORDER.indexOf(currentArea);
  var dest = goingLeft ? AREA_ORDER[idx - 1] : AREA_ORDER[idx + 1];
  if (!dest) return;   // no area that way (shouldn't happen — edge maps have one valid exit)

  // Land just inside the destination's matching entrance: came from the left →
  // arrive on its right side; came from the right → arrive on its left side.
  activateArea(dest);
  if (dest === 'wilds') recordOnboardingMilestone('enteredWilds');
  // The selected profile's enemy state persists across travel. Normal 30-second
  // respawnAt timers are honored on re-entry; leaving and returning must not
  // instantly revive bosses (and never touches the other profile's world).
  player.x = goingLeft ? (MAP_W - 2) * TILE : 1 * TILE;
  // Spawn on the exit row of the destination area (find the first EXIT on the entry edge).
  var entryCol = goingLeft ? MAP_W - 1 : 0;
  var spawnRow = 9;
  for (var sr = 0; sr < MAP_H; sr++) { if (map[sr][entryCol] === EXIT) { spawnRow = sr; break; } }
  player.y = spawnRow * TILE;
  wasNearDoor = false;   // don't auto-open the shop just from arriving
  wasNearEnemy = false;  // don't auto-open the battle just from arriving
  var msg = AREA_LABEL[dest];
  showToast(msg);
  speak(msg);
  saveGame();
}

// Draw a small filled triangle "arrow" pointing in a direction (a clear visual cue).
function drawArrow(cx, cy, size, dir, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  if (dir === 'down')      { ctx.moveTo(cx - size, cy - size); ctx.lineTo(cx + size, cy - size); ctx.lineTo(cx, cy + size); }
  else if (dir === 'up')   { ctx.moveTo(cx - size, cy + size); ctx.lineTo(cx + size, cy + size); ctx.lineTo(cx, cy - size); }
  else if (dir === 'left') { ctx.moveTo(cx + size, cy - size); ctx.lineTo(cx + size, cy + size); ctx.lineTo(cx - size, cy); }
  else                     { ctx.moveTo(cx - size, cy - size); ctx.lineTo(cx - size, cy + size); ctx.lineTo(cx + size, cy); }
  ctx.closePath();
  ctx.fill();
}
