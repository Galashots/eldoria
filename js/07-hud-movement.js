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

function onAudioSliderInput(channel, value) {
  setAudioLevel(channel, Number(value) / 100);
  var label = document.getElementById(channel + 'LevelValue');
  if (label) label.textContent = Math.round(audioLevels[channel] * 100) + '%';
  // Preview the channel you just moved, so the level means something to a child who
  // cannot yet read the percentage.
  if (channel === 'effects') soundCoin();
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

    // Iso mode: the joystick is SCREEN-relative (up = up on screen). Convert the screen
    // vector to a UNIT world vector through the inverse projection; facing then derives
    // from world motion, matching the facing->sprite mapping in the iso pipeline doc.
    var isoMoved = false;
    if (typeof isoActive === 'function' && isoActive() && (dx !== 0 || dy !== 0)) {
      var wvx = isoInputX(dx, dy), wvy = isoInputY(dx, dy);
      var wvl = Math.sqrt(wvx * wvx + wvy * wvy);
      dx = wvx / wvl;
      dy = wvy / wvl;
      isoMoved = true;
    }

    // Eight-way facing in iso, where every facing has real art and overlays are
    // not drawn. Top-down stays cardinal so attack strips and equipped gear
    // (authored for the original four facings only) never disappear.
    if (dx !== 0 || dy !== 0) {
      player.facing = isoMoved ? facingFromVector(dx, dy) : cardinalFromVector(dx, dy);
    } else if (!isoMoved && FACING_TO_CARDINAL[player.facing] &&
               !(typeof isoActive === 'function' && isoActive())) {
      player.facing = FACING_TO_CARDINAL[player.facing];
    }

    // (Iso vectors are already unit-length; re-normalizing would halve some directions.)
    if (!isoMoved && dx !== 0 && dy !== 0) {
      dx *= 0.7071;
      dy *= 0.7071;
    }
    // Keep the long-established top-down pace exactly as it is. Iso projects half of
    // world-y onto the screen, so it uses its own explicit tuning knob instead.
    var moveSpeed = player.speed * (isoMoved ? ISO_SPEED_MULT : 1);
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

// ---- Procedural decorations (placeholder shapes drawn until art replaces them) ----
// Procedural NPC placeholder shapes — each villager is a distinct colored body + skin head.
// Auto-replaced by npc_<id>.png when the art lands (same fallback pattern as enemies).
function drawNpcShape(npc, nx, ny) {
  // Shadow
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  ctx.beginPath();
  ctx.ellipse(nx + 16, ny + 30, 10, 3, 0, 0, Math.PI * 2);
  ctx.fill();
  // Body (tunic)
  ctx.fillStyle = npc.color;
  ctx.fillRect(nx + 7, ny + 10, 18, 20);
  ctx.strokeStyle = 'rgba(0,0,0,0.3)'; ctx.lineWidth = 2;
  ctx.strokeRect(nx + 7, ny + 10, 18, 20);
  // Head
  ctx.fillStyle = '#f0c8a0';
  ctx.fillRect(nx + 10, ny + 2, 12, 10);
  // Hair/hat per NPC
  if (npc.id === 'dumpling_vendor') {
    // White squishy-bun hat makes the placeholder vendor readable before final stall art.
    ctx.fillStyle = '#f5e4c7';
    ctx.beginPath();
    ctx.ellipse(nx + 16, ny + 3, 10, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#5a3725';
    ctx.fillRect(nx + 13, ny + 3, 2, 2);
    ctx.fillRect(nx + 18, ny + 3, 2, 2);
  } else if (npc.id === 'bram') {
    ctx.fillStyle = '#8b6914';
    ctx.fillRect(nx + 8, ny + 1, 16, 4);
  } else if (npc.id === 'gunnar') {
    ctx.fillStyle = '#555';
    ctx.fillRect(nx + 9, ny + 0, 14, 5);
    // Anvil icon on apron
    ctx.fillStyle = '#444';
    ctx.fillRect(nx + 12, ny + 16, 8, 4);
  } else {
    ctx.fillStyle = '#7744aa';
    ctx.fillRect(nx + 9, ny + 1, 14, 4);
  }
  // Name tag
  ctx.fillStyle = '#fff'; ctx.font = 'bold 7px system-ui';
  ctx.textAlign = 'center';
  ctx.fillText(npc.name, nx + 16, ny + 30);
  ctx.textAlign = 'left';
}

// Fences and signposts are drawn with canvas shapes so the world reads richer without
// needing PNGs yet. Each is purely decorative (no collision), like boulders/stumps.
function drawProcDeco(d, dx, dy) {
  // soft ground shadow for grounding
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  ctx.beginPath();
  ctx.ellipse(dx + 16, dy + 28, 11, 3.5, 0, 0, Math.PI * 2);
  ctx.fill();

  if (d.proc === 'fence') {
    // two horizontal rails spanning the full tile so adjacent fence tiles connect
    ctx.fillStyle = '#8a5a2a';
    ctx.fillRect(dx, dy + 13, TILE, 3);
    ctx.fillRect(dx, dy + 20, TILE, 3);
    // two posts
    ctx.fillStyle = '#6a4420';
    ctx.fillRect(dx + 4, dy + 9, 4, 20);
    ctx.fillRect(dx + 24, dy + 9, 4, 20);
    // dark outline accents
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(dx, dy + 15, TILE, 1);
    ctx.fillRect(dx, dy + 22, TILE, 1);
  } else if (d.proc === 'signpost') {
    // post
    ctx.fillStyle = '#6a4420';
    ctx.fillRect(dx + 14, dy + 12, 4, 18);
    // board
    ctx.fillStyle = '#a9712f';
    ctx.fillRect(dx + 3, dy + 6, 26, 12);
    ctx.strokeStyle = '#5a3a1a';
    ctx.lineWidth = 2;
    ctx.strokeRect(dx + 3, dy + 6, 26, 12);
    // pointing arrow on the board toward the exit
    if (d.dir) drawArrow(dx + 16, dy + 12, 4, d.dir, '#3a2410');
    // optional small label above (helps the strong reader; the voiced area
    // name on arrival covers the early reader)
    if (d.label) {
      ctx.fillStyle = '#fff2b0';
      ctx.font = 'bold 8px system-ui';
      ctx.textAlign = 'center';
      ctx.fillText(d.label, dx + 16, dy + 3);
      ctx.textAlign = 'left';
    }
  } else if (d.proc === 'well') {
    // Stone well — circular stone rim with dark center
    ctx.fillStyle = '#888';
    ctx.beginPath();
    ctx.ellipse(dx + 16, dy + 18, 12, 8, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#223';
    ctx.beginPath();
    ctx.ellipse(dx + 16, dy + 18, 8, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    // Wooden crossbar + rope
    ctx.fillStyle = '#6a4420';
    ctx.fillRect(dx + 6, dy + 2, 3, 16);
    ctx.fillRect(dx + 23, dy + 2, 3, 16);
    ctx.fillRect(dx + 6, dy + 2, 20, 3);
    ctx.fillStyle = '#aa8844';
    ctx.fillRect(dx + 15, dy + 5, 2, 10);
  }
}

// ---- Enemy placeholder shapes (one per type, so the kids can tell them apart) ----
function drawEnemyShape(type, ex, ey, now) {
  if (type === 'slime') {
    ctx.fillStyle = '#5fa860';
    ctx.fillRect(ex + 6, ey + 12, 20, 16);
    ctx.fillStyle = '#3c7a40';
    ctx.fillRect(ex + 6, ey + 22, 20, 6);
    ctx.strokeStyle = '#244a26'; ctx.lineWidth = 2;
    ctx.strokeRect(ex + 6, ey + 12, 20, 16);
    ctx.fillStyle = '#fff';
    ctx.fillRect(ex + 11, ey + 17, 3, 3);
    ctx.fillRect(ex + 18, ey + 17, 3, 3);
  } else if (type === 'bat') {
    ctx.fillStyle = '#8866bb';
    ctx.fillRect(ex + 10, ey + 14, 12, 10);
    ctx.fillStyle = '#6644aa';
    ctx.beginPath(); ctx.moveTo(ex + 10, ey + 14); ctx.lineTo(ex + 2, ey + 20); ctx.lineTo(ex + 10, ey + 22); ctx.fill();
    ctx.beginPath(); ctx.moveTo(ex + 22, ey + 14); ctx.lineTo(ex + 30, ey + 20); ctx.lineTo(ex + 22, ey + 22); ctx.fill();
    ctx.fillStyle = '#ff3333';
    ctx.fillRect(ex + 13, ey + 17, 2, 2);
    ctx.fillRect(ex + 18, ey + 17, 2, 2);
  } else if (type === 'goblin') {
    ctx.fillStyle = '#bb7744';
    ctx.fillRect(ex + 8, ey + 10, 16, 18);
    ctx.fillStyle = '#997733';
    ctx.fillRect(ex + 8, ey + 22, 16, 6);
    ctx.strokeStyle = '#664422'; ctx.lineWidth = 2;
    ctx.strokeRect(ex + 8, ey + 10, 16, 18);
    ctx.fillStyle = '#ccaa66';
    ctx.beginPath(); ctx.arc(ex + 16, ey + 7, 6, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ff4444';
    ctx.fillRect(ex + 13, ey + 5, 2, 2);
    ctx.fillRect(ex + 18, ey + 5, 2, 2);
  } else if (type === 'wolf') {
    // Gray body with pointed ears (lean and quick-looking).
    ctx.fillStyle = '#888888';
    ctx.fillRect(ex + 6, ey + 14, 20, 12);
    ctx.beginPath(); ctx.moveTo(ex + 8, ey + 14); ctx.lineTo(ex + 11, ey + 7); ctx.lineTo(ex + 14, ey + 14); ctx.fill();
    ctx.beginPath(); ctx.moveTo(ex + 18, ey + 14); ctx.lineTo(ex + 21, ey + 7); ctx.lineTo(ex + 24, ey + 14); ctx.fill();
    ctx.fillStyle = '#5a5a5a';
    ctx.fillRect(ex + 6, ey + 22, 20, 4);
    ctx.fillStyle = '#ffdd33';
    ctx.fillRect(ex + 11, ey + 18, 2, 2);
    ctx.fillRect(ex + 19, ey + 18, 2, 2);
  } else if (type === 'bear') {
    // Big brown bulk with round ears (heavy bruiser).
    ctx.fillStyle = '#7a5230';
    ctx.fillRect(ex + 5, ey + 9, 22, 20);
    ctx.fillStyle = '#5e3d22';
    ctx.beginPath(); ctx.arc(ex + 9, ey + 9, 4, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(ex + 23, ey + 9, 4, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#422c18'; ctx.lineWidth = 2;
    ctx.strokeRect(ex + 5, ey + 9, 22, 20);
    ctx.fillStyle = '#ff4444';
    ctx.fillRect(ex + 12, ey + 16, 2, 2);
    ctx.fillRect(ex + 18, ey + 16, 2, 2);
  } else if (type === 'troll') {
    // Tall green brute (the toughest — biggest body, club).
    ctx.fillStyle = '#6b8e4e';
    ctx.fillRect(ex + 6, ey + 6, 18, 22);
    ctx.fillStyle = '#557039';
    ctx.fillRect(ex + 6, ey + 22, 18, 6);
    ctx.strokeStyle = '#3c5026'; ctx.lineWidth = 2;
    ctx.strokeRect(ex + 6, ey + 6, 18, 22);
    // Crude club on the side.
    ctx.fillStyle = '#7a5230';
    ctx.fillRect(ex + 24, ey + 10, 4, 14);
    ctx.fillStyle = '#ff3333';
    ctx.fillRect(ex + 11, ey + 12, 2, 2);
    ctx.fillRect(ex + 17, ey + 12, 2, 2);
  } else if (type === 'shadow_warden') {
    // The boss: a big dark figure filling the tile, with glowing cyan crystal eyes and a
    // crystal blade, so it reads instantly as "this one is special / the final fight".
    ctx.fillStyle = '#2a1f44';
    ctx.fillRect(ex + 4, ey + 4, 22, 26);
    ctx.fillStyle = '#3a2a5a';
    ctx.fillRect(ex + 4, ey + 20, 22, 10);
    ctx.strokeStyle = '#11091f'; ctx.lineWidth = 2;
    ctx.strokeRect(ex + 4, ey + 4, 22, 26);
    // Glowing crystal eyes (cyan, gently pulsing).
    var glow = 0.6 + 0.4 * Math.sin(now / 200);
    ctx.globalAlpha = glow;
    ctx.fillStyle = '#66ffee';
    ctx.fillRect(ex + 10, ey + 12, 3, 3);
    ctx.fillRect(ex + 17, ey + 12, 3, 3);
    ctx.globalAlpha = 1;
    // Crystal blade jutting from its side.
    ctx.fillStyle = '#9be7ff';
    ctx.beginPath();
    ctx.moveTo(ex + 27, ey + 6); ctx.lineTo(ex + 31, ey + 16); ctx.lineTo(ex + 27, ey + 26);
    ctx.closePath(); ctx.fill();
  } else if (type === 'rock_golem') {
    // Blocky gray boulder-body with a cracked seam (heavy, slow-looking).
    ctx.fillStyle = '#7d7468';
    ctx.fillRect(ex + 5, ey + 8, 22, 21);
    ctx.fillStyle = '#5f574d';
    ctx.fillRect(ex + 5, ey + 22, 22, 7);
    ctx.strokeStyle = '#3e382f'; ctx.lineWidth = 2;
    ctx.strokeRect(ex + 5, ey + 8, 22, 21);
    // A crack down the middle.
    ctx.beginPath(); ctx.moveTo(ex + 16, ey + 8); ctx.lineTo(ex + 13, ey + 18); ctx.lineTo(ex + 17, ey + 29); ctx.stroke();
    ctx.fillStyle = '#ffcc33';
    ctx.fillRect(ex + 11, ey + 14, 3, 3);
    ctx.fillRect(ex + 18, ey + 14, 3, 3);
  } else if (type === 'magma_slug') {
    // Glowing molten blob (like the slime, but red-hot and pulsing).
    var heat = 0.6 + 0.4 * Math.sin(now / 180);
    ctx.fillStyle = '#c0501f';
    ctx.fillRect(ex + 5, ey + 12, 22, 16);
    ctx.globalAlpha = heat;
    ctx.fillStyle = '#ffcc33';
    ctx.fillRect(ex + 8, ey + 20, 16, 6);
    ctx.globalAlpha = 1;
    ctx.strokeStyle = '#7a2a0f'; ctx.lineWidth = 2;
    ctx.strokeRect(ex + 5, ey + 12, 22, 16);
    ctx.fillStyle = '#fff';
    ctx.fillRect(ex + 11, ey + 16, 3, 3);
    ctx.fillRect(ex + 18, ey + 16, 3, 3);
  } else if (type === 'crystal_wyrm') {
    // The Mine boss: a big teal serpent-head filling the tile, glowing crystal eyes and fangs.
    ctx.fillStyle = '#27536b';
    ctx.fillRect(ex + 4, ey + 4, 22, 26);
    ctx.fillStyle = '#2f6e8f';
    ctx.fillRect(ex + 4, ey + 18, 22, 12);
    ctx.strokeStyle = '#0f2b38'; ctx.lineWidth = 2;
    ctx.strokeRect(ex + 4, ey + 4, 22, 26);
    // Glowing crystal eyes (pulsing).
    var wglow = 0.6 + 0.4 * Math.sin(now / 200);
    ctx.globalAlpha = wglow;
    ctx.fillStyle = '#9be7ff';
    ctx.fillRect(ex + 9, ey + 11, 4, 4);
    ctx.fillRect(ex + 17, ey + 11, 4, 4);
    ctx.globalAlpha = 1;
    // Two crystal fangs.
    ctx.fillStyle = '#dff6ff';
    ctx.beginPath(); ctx.moveTo(ex + 11, ey + 24); ctx.lineTo(ex + 13, ey + 30); ctx.lineTo(ex + 15, ey + 24); ctx.fill();
    ctx.beginPath(); ctx.moveTo(ex + 16, ey + 24); ctx.lineTo(ex + 18, ey + 30); ctx.lineTo(ex + 20, ey + 24); ctx.fill();
  }
  var eBob = Math.sin(now / 250) * 3;
  ctx.fillStyle = '#ff5555';
  ctx.beginPath();
  ctx.arc(ex + TILE / 2, ey - 3 + eBob, 4, 0, Math.PI * 2);
  ctx.fill();
}

