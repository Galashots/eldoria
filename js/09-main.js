// ---- Draw ----
function topDownCamera() {
  var camX = player.x + player.size / 2 - canvas.width / 2;
  var camY = player.y + player.size / 2 - canvas.height / 2;
  var maxCamX = MAP_W * TILE - canvas.width;
  var maxCamY = MAP_H * TILE - canvas.height;
  return {
    x: Math.round(Math.max(0, Math.min(camX, maxCamX))),
    y: Math.round(Math.max(0, Math.min(camY, maxCamY)))
  };
}

function draw() {
  if (typeof isoActive === 'function' && isoActive()) { drawIsoWorld(); return; }
  var camera = topDownCamera();
  var camX = camera.x, camY = camera.y;

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  var now = Date.now();

  // Screen shake offset during combat hits
  if (now < shakeUntil) {
    var sx = (Math.random() - 0.5) * 8;
    var sy = (Math.random() - 0.5) * 8;
    ctx.save();
    ctx.translate(sx, sy);
  }

  for (var r = 0; r < MAP_H; r++) {
    for (var c = 0; c < MAP_W; c++) {
      var sx = c * TILE - camX;
      var sy = r * TILE - camY;
      if (sx + TILE < 0 || sy + TILE < 0 || sx > canvas.width || sy > canvas.height) continue;

      var tileType = map[r][c];
      // Draw grass under tiles that have transparency (trees, houses, doors, exits)
      // Cavern tiles are their own ground: never lay grass under them.
      if (tileType !== GRASS && tileType !== WATER && tileType !== SOIL && tileType !== PATH &&
          tileType !== ROCK && tileType !== CAVE) {
        var grassImg = spr('tile_' + GRASS);
        if (grassImg) ctx.drawImage(grassImg, sx, sy, TILE, TILE);
        else { ctx.fillStyle = TILE_COLOR[GRASS]; ctx.fillRect(sx, sy, TILE, TILE); }
      }
      // Skip HOUSE/DOOR tiles when we have the large shop building sprite
      if ((tileType === HOUSE || tileType === DOOR) && currentArea === 'town' && spr('shop_building')) continue;
      var tileImg = spr('tile_' + tileType);
      if (tileType === GRASS && tileImg) {
        var grassHash = (r * 31 + c * 17 + 7) % 5;
        var gv = (grassHash === 1) ? spr('grass2') : (grassHash === 2) ? spr('grass3') : null;
        ctx.drawImage(gv || tileImg, sx, sy, TILE, TILE);
      } else if (tileImg) {
        ctx.drawImage(tileImg, sx, sy, TILE, TILE);
      } else {
        // Fallback: the colored box (+ a subtle grass checker for texture).
        ctx.fillStyle = TILE_COLOR[tileType];
        ctx.fillRect(sx, sy, TILE, TILE);
        if (tileType === GRASS && (r + c) % 2 === 0) {
          ctx.fillStyle = 'rgba(0,0,0,0.06)';
          ctx.fillRect(sx, sy, TILE, TILE);
        }
      }

      // Tree shadow: a subtle dark ellipse at the base of each tree
      if (tileType === TREE) {
        ctx.fillStyle = 'rgba(0,0,0,0.15)';
        ctx.beginPath();
        ctx.ellipse(sx + TILE / 2, sy + TILE - 3, 12, 4, 0, 0, Math.PI * 2);
        ctx.fill();
      }

      // Cavern detailing, only while the real Mine art is still missing.
      if (tileType === ROCK && !tileImg) drawRockTile(sx, sy, r, c);
      else if (tileType === CAVE && !tileImg) drawCaveFloorTile(sx, sy, r, c);

      // Water shimmer: a gentle moving highlight on water tiles
      if (tileType === WATER) {
        var waveOff = Math.sin((now / 600) + r * 1.3 + c * 0.7) * 0.12;
        ctx.fillStyle = 'rgba(200,230,255,' + (0.08 + waveOff) + ')';
        var wy = 4 + Math.sin((now / 800) + c * 2) * 3;
        ctx.fillRect(sx + 2, sy + wy, TILE - 4, 3);
        var wy2 = 18 + Math.sin((now / 700) + c * 1.5 + 2) * 3;
        ctx.fillRect(sx + 6, sy + wy2, TILE - 10, 2);
      }

      // Draw crop overlays on soil tiles
      if (tileType === SOIL) {
        var key = r + ',' + c;
        var crop = cropData[key];

        if (crop && crop.status === 'growing') {
          var ct = crop.type || 'turnip';
          var ci = CROPS[ct];
          var pct = Math.min((now - crop.plantedAt) / ci.grow, 1);
          var growImg = spr('crop_growing');
          if (growImg) {
            var gh = Math.floor(TILE * (0.35 + 0.65 * pct));
            ctx.drawImage(growImg, sx, sy + TILE - gh, TILE, gh);
          } else {
            // Fallback: colored sprout per crop type.
            var sproutH = 4 + Math.floor(pct * 16);
            ctx.fillStyle = ci.color;
            ctx.fillRect(sx + 12, sy + TILE - sproutH - 2, 8, sproutH);
          }
        } else if (crop && crop.status === 'ready') {
          var ct = crop.type || 'turnip';
          var ci = CROPS[ct];
          var readyImg = spr('crop_ready');
          if (readyImg) {
            ctx.drawImage(readyImg, sx, sy, TILE, TILE);
          } else {
            // Fallback: pulsing crop head in the type's ready color.
            var pulse = 0.7 + 0.3 * Math.sin(now / 300);
            ctx.globalAlpha = pulse;
            ctx.fillStyle = ci.readyColor;
            ctx.fillRect(sx + 4, sy + 4, 24, 24);
            ctx.globalAlpha = 1;
            ctx.fillStyle = ci.color;
            ctx.fillRect(sx + 12, sy + TILE - 22, 8, 20);
          }
          var cropBob = Math.sin(now / 200) * 3;
          drawArrow(sx + TILE / 2, sy - 5 + cropBob, 6, 'down', '#fff2b0');
        }

        // Faint grid lines on soil so you can see plot boundaries
        ctx.strokeStyle = 'rgba(0,0,0,0.15)';
        ctx.lineWidth = 1;
        ctx.strokeRect(sx + 0.5, sy + 0.5, TILE - 1, TILE - 1);
      }

      // EXIT road tile: pulsing border + an arrow pointing off-map ("walk here to travel").
      if (tileType === EXIT) {
        var ep = 0.5 + 0.5 * Math.abs(Math.sin(now / 350));
        ctx.strokeStyle = 'rgba(255, 214, 102,' + ep + ')';
        ctx.lineWidth = 3;
        ctx.strokeRect(sx + 1.5, sy + 1.5, TILE - 3, TILE - 3);
        var edir = (c === 0) ? 'left' : (c === MAP_W - 1) ? 'right' : (r === 0) ? 'up' : 'down';
        var slide = Math.abs(Math.sin(now / 250)) * 4;   // nudge toward the edge
        var eax = sx + TILE / 2, eay = sy + TILE / 2;
        if (edir === 'left')  eax -= slide; else if (edir === 'right') eax += slide;
        else if (edir === 'up') eay -= slide; else eay += slide;
        drawArrow(eax, eay, 8, edir, '#fff2b0');
      }

      // DOOR tile (the shop): pulsing border + a bobbing arrow pointing down at it.
      if (tileType === DOOR) {
        var dp = 0.5 + 0.5 * Math.abs(Math.sin(now / 350));
        ctx.strokeStyle = 'rgba(255, 214, 102,' + dp + ')';
        ctx.lineWidth = 3;
        ctx.strokeRect(sx + 1.5, sy + 1.5, TILE - 3, TILE - 3);
        var doorBob = Math.sin(now / 200) * 3;
        drawArrow(sx + TILE / 2, sy - 5 + doorBob, 6, 'down', '#fff2b0');
      }
    }
  }

  // Soft grass-fringe edges: where path/water/soil borders grass, draw a
  // semi-transparent grass-colored strip bleeding inward, softening hard edges.
  var edgeFringe = 6;
  var grassEdgeColor = 'rgba(76,128,48,0.35)';
  for (var r = 0; r < MAP_H; r++) {
    for (var c = 0; c < MAP_W; c++) {
      var tt = map[r][c];
      if (tt !== PATH && tt !== WATER && tt !== SOIL) continue;
      var ex = c * TILE - camX, ey = r * TILE - camY;
      if (ex + TILE < 0 || ey + TILE < 0 || ex > canvas.width || ey > canvas.height) continue;
      // Check each neighbor; if it's grass, draw a fringe on this tile's matching edge.
      ctx.fillStyle = grassEdgeColor;
      if (r > 0 && map[r - 1][c] === GRASS) ctx.fillRect(ex, ey, TILE, edgeFringe);
      if (r < MAP_H - 1 && map[r + 1][c] === GRASS) ctx.fillRect(ex, ey + TILE - edgeFringe, TILE, edgeFringe);
      if (c > 0 && map[r][c - 1] === GRASS) ctx.fillRect(ex, ey, edgeFringe, TILE);
      if (c < MAP_W - 1 && map[r][c + 1] === GRASS) ctx.fillRect(ex + TILE - edgeFringe, ey, edgeFringe, TILE);
    }
  }

  // Draw decorations (flowers, boulders, stumps) on top of ground tiles.
  var decos = AREA_DECORATIONS[currentArea] || [];
  for (var di = 0; di < decos.length; di++) {
    var d = decos[di];
    var dx = d.col * TILE - camX;
    var dy = d.row * TILE - camY;
    if (dx + TILE < 0 || dy + TILE < 0 || dx > canvas.width || dy > canvas.height) continue;
    if (d.proc) {
      var pimg = d.spr ? spr(d.spr) : null;   // a future PNG wins over the placeholder
      if (pimg) ctx.drawImage(pimg, dx, dy, TILE, TILE);
      else drawProcDeco(d, dx, dy);
    } else {
      var dimg = spr(d.spr);
      if (dimg) ctx.drawImage(dimg, dx, dy, TILE, TILE);
    }
  }

  // Highlight the tile the player is near (if soil) — blinking so it's unmissable.
  var facing = getFacingTile();
  if (facing) {
    var hx = facing.col * TILE - camX;
    var hy = facing.row * TILE - camY;
    var hp = 0.45 + 0.55 * Math.abs(Math.sin(now / 250));
    ctx.strokeStyle = 'rgba(255, 214, 102,' + hp + ')';
    ctx.lineWidth = 3;
    ctx.strokeRect(hx + 1.5, hy + 1.5, TILE - 3, TILE - 3);
  }

  // Draw the shop building sprite + forge placeholder (overlays HOUSE tiles).
  if (currentArea === 'town') {
    // Building shadows (drawn behind the buildings)
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    var shx = TOWN_SHOP.col * TILE - camX;
    var shy = TOWN_SHOP.row * TILE - camY;
    ctx.fillRect(shx + 4, shy + TOWN_SHOP.h * TILE, TOWN_SHOP.w * TILE, 5);
    ctx.fillRect(shx + TOWN_SHOP.w * TILE, shy + 4, 5, TOWN_SHOP.h * TILE);
    var sfx = 20 * TILE - camX, sfy = 4 * TILE - camY;
    ctx.fillRect(sfx + 4, sfy + 3 * TILE, 4 * TILE, 5);
    ctx.fillRect(sfx + 4 * TILE, sfy + 4, 5, 3 * TILE);

    var shopImg = spr('shop_building');
    if (shopImg) {
      var sx = TOWN_SHOP.col * TILE - camX;
      var sy = TOWN_SHOP.row * TILE - camY;
      ctx.drawImage(shopImg, sx, sy, TOWN_SHOP.w * TILE, TOWN_SHOP.h * TILE);
    }
    // Forge building placeholder (dark stone look)
    var forgeImg = spr('forge_building');
    var fx = 20 * TILE - camX, fy = 4 * TILE - camY;
    if (forgeImg) {
      ctx.drawImage(forgeImg, fx, fy, 4 * TILE, 3 * TILE);
    } else {
      ctx.fillStyle = '#5a4a3a';
      ctx.fillRect(fx, fy, 4 * TILE, 3 * TILE);
      ctx.strokeStyle = '#3a2a1a'; ctx.lineWidth = 2;
      ctx.strokeRect(fx, fy, 4 * TILE, 3 * TILE);
      ctx.fillStyle = '#ff6622';
      ctx.fillRect(fx + 20, fy + 60, 24, 12);
      ctx.fillStyle = '#fff2b0'; ctx.font = 'bold 10px system-ui';
      ctx.textAlign = 'center';
      ctx.fillText('FORGE', fx + 2 * TILE, fy + 20);
      ctx.textAlign = 'left';
    }
  }

  // Draw all NPCs in the current area.
  for (var ni = 0; ni < NPCS.length; ni++) {
    var npc = NPCS[ni];
    if (npc.area !== currentArea) continue;
    var nx = npc.col * TILE - camX;
    var ny = npc.row * TILE - camY;
    var npcImg = spr('npc_' + npc.id);
    if (npcImg) {
      ctx.drawImage(npcImg, nx, ny, TILE, TILE);
    } else {
      drawNpcShape(npc, nx, ny);
    }
    // Bobbing "!" cue above the NPC
    var npcBob = Math.sin(now / 250) * 3;
    ctx.fillStyle = '#fff2b0';
    ctx.font = 'bold 18px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('!', nx + TILE / 2, ny - 4 + npcBob);
    ctx.textAlign = 'left';
  }

  // Draw the Farm cooking pot (placeholder: a dark pot over flickering flames).
  if (currentArea === 'farm') {
    var kx = FARM_COOKPOT.col * TILE - camX;
    var ky = FARM_COOKPOT.row * TILE - camY;
    var potImg = spr('cookpot');
    if (potImg) {
      ctx.drawImage(potImg, kx, ky, TILE, TILE);
    } else {
      var flick = 0.6 + 0.4 * Math.abs(Math.sin(now / 120));
      ctx.fillStyle = 'rgba(255,150,40,' + flick + ')';
      ctx.fillRect(kx + 10, ky + 22, 12, 6);
      ctx.fillStyle = '#3a3a3a';
      ctx.fillRect(kx + 7, ky + 12, 18, 12);
      ctx.fillStyle = '#555';
      ctx.fillRect(kx + 6, ky + 11, 20, 3);
      ctx.strokeStyle = '#1a1a1a';
      ctx.lineWidth = 2;
      ctx.strokeRect(kx + 7, ky + 12, 18, 12);
    }
    var potBob = Math.sin(now / 250) * 3;
    ctx.fillStyle = '#ffe0a0';
    ctx.font = 'bold 16px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('🍲', kx + TILE / 2, ky - 4 + potBob);
    ctx.textAlign = 'left';
  }

  // Draw all alive enemies in the current combat area. Each type gets a distinct
  // placeholder shape so the kids can read difficulty at a glance.
  for (var we = 0; we < currentEnemies.length; we++) {
    var wen = currentEnemies[we];
    if (!wen.alive) continue;
    var ex = wen.col * TILE - camX;
    var ey = wen.row * TILE - camY;
    var enemyImg = spr('enemy_' + wen.type);
    if (enemyImg) {
      ctx.drawImage(enemyImg, ex, ey, TILE, TILE);
      var eBob2 = Math.sin(now / 250) * 3;
      ctx.fillStyle = '#ff5555';
      ctx.beginPath(); ctx.arc(ex + TILE / 2, ey - 3 + eBob2, 4, 0, Math.PI * 2); ctx.fill();
    } else {
      drawEnemyShape(wen.type, ex, ey, now);
    }
  }

  // Draw player
  var px = player.x - camX;
  var py = player.y - camY;
  var profilePlayerImg = profilePlayerSprite();
  var playerAttackImg = playerAttackSprite();
  var playerWalkImg = playerWalkSprite();
  var playerImg = playerAttackImg || playerWalkImg || playerSprite();
  var spriteMode = playerAttackImg ? 'attack' : (playerWalkImg ? 'walk' : null);
  var pdx = px + player.size / 2 - TILE / 2;
  var pdy = py + player.size - TILE;

  // Advance attack animation frames
  if (player.attacking) {
    var atkNow = Date.now();
    if (atkNow - player.attackLastAt >= ATTACK_FRAME_MS) {
      player.attackFrame = (player.attackFrame + 1) % ATTACK_FRAMES;
      player.attackLastAt = atkNow;
    }
  }

  // Capes sit behind the base sprite; armor, helmets, and weapons sit on top.
  // Only draw overlays with their matching profile base, never over legacy art.
  if (profilePlayerImg) {
    var capeWalkImg = equipmentWalkSprite('cape');
    var capeImg = capeWalkImg || equipmentSprite('cape');
    if (capeImg) drawSpriteFrame(capeImg, spriteMode === 'walk' ? 'walk' : null, pdx, pdy);
  }
  if (playerImg) {
    drawSpriteFrame(playerImg, spriteMode, pdx, pdy);
    if (profilePlayerImg && spriteMode === 'attack') {
      var bodyAtkImg = equipmentAttackSprite('body');
      var headAtkImg = equipmentAttackSprite('head');
      var weaponAtkImg = equipmentAttackSprite('weapon');
      if (bodyAtkImg) drawSpriteFrame(bodyAtkImg, 'attack', pdx, pdy);
      if (headAtkImg) drawSpriteFrame(headAtkImg, 'attack', pdx, pdy);
      if (weaponAtkImg) drawSpriteFrame(weaponAtkImg, 'attack', pdx, pdy);
    } else if (profilePlayerImg) {
      var bodyWalkImg = equipmentWalkSprite('body');
      var headWalkImg = equipmentWalkSprite('head');
      var weaponWalkImg = equipmentWalkSprite('weapon');
      var bodyImg = bodyWalkImg || equipmentSprite('body');
      var headImg = headWalkImg || equipmentSprite('head');
      var weaponImg = weaponWalkImg || equipmentSprite('weapon');
      if (bodyImg) drawSpriteFrame(bodyImg, playerWalkImg ? 'walk' : null, pdx, pdy);
      if (headImg) drawSpriteFrame(headImg, playerWalkImg ? 'walk' : null, pdx, pdy);
      if (weaponImg) drawSpriteFrame(weaponImg, playerWalkImg ? 'walk' : null, pdx, pdy);
    }
  } else {
    // Fallback: the yellow box with a directional nose so you can tell which way you face.
    ctx.fillStyle = '#ffd666';
    ctx.fillRect(px, py, player.size, player.size);
    ctx.strokeStyle = '#3a2800';
    ctx.lineWidth = 2;
    ctx.strokeRect(px, py, player.size, player.size);
    // Small dark triangle pointing in player.facing direction.
    var cx = px + player.size / 2;
    var cy = py + player.size / 2;
    var ns = 5; // nose size
    ctx.fillStyle = '#3a2800';
    ctx.beginPath();
    if (player.facing === 'down') {
      ctx.moveTo(cx, cy + ns + 4); ctx.lineTo(cx - ns, cy + 2); ctx.lineTo(cx + ns, cy + 2);
    } else if (player.facing === 'up') {
      ctx.moveTo(cx, cy - ns - 4); ctx.lineTo(cx - ns, cy - 2); ctx.lineTo(cx + ns, cy - 2);
    } else if (player.facing === 'left') {
      ctx.moveTo(cx - ns - 4, cy); ctx.lineTo(cx - 2, cy - ns); ctx.lineTo(cx - 2, cy + ns);
    } else {
      ctx.moveTo(cx + ns + 4, cy); ctx.lineTo(cx + 2, cy - ns); ctx.lineTo(cx + 2, cy + ns);
    }
    ctx.closePath();
    ctx.fill();
  }

  // Floating "+1" harvest pops: rise and fade, then drop off the list.
  var keep = [];
  ctx.font = 'bold 18px system-ui, sans-serif';
  ctx.textAlign = 'center';
  for (var i = 0; i < pops.length; i++) {
    var p = pops[i];
    var age = now - p.born;
    if (age > 900) continue;
    var sx = p.wx - camX;
    var sy = p.wy - camY - (age / 900) * 30;
    ctx.globalAlpha = 1 - age / 900;
    ctx.strokeStyle = '#1a0a00';
    ctx.lineWidth = 3;
    ctx.strokeText(p.text, sx, sy);
    ctx.fillStyle = p.color || '#fff2b0';
    ctx.fillText(p.text, sx, sy);
    ctx.globalAlpha = 1;
    keep.push(p);
  }
  ctx.textAlign = 'left';
  pops = keep;

  // End screen shake
  if (now < shakeUntil) ctx.restore();
}

// ---- Main loop ----
function loop() {
  update();
  draw();
  requestAnimationFrame(loop);
}

// ---- Virtual joystick ----
var joystickZone = document.getElementById('joystickZone');
var joystickThumb = document.getElementById('joystickThumb');
var joystickActive = false;
var joystickId = null;
var JOYSTICK_RADIUS = 70;
var JOYSTICK_DEAD = 0.2;

function joystickUpdate(cx, cy) {
  var rect = joystickZone.getBoundingClientRect();
  var ox = cx - (rect.left + rect.width / 2);
  var oy = cy - (rect.top + rect.height / 2);
  var dist = Math.sqrt(ox * ox + oy * oy);
  var maxDist = JOYSTICK_RADIUS - 27;
  if (dist > maxDist) { ox = ox / dist * maxDist; oy = oy / dist * maxDist; }
  joystickThumb.style.left = (JOYSTICK_RADIUS - 27 + ox) + 'px';
  joystickThumb.style.top  = (JOYSTICK_RADIUS - 27 + oy) + 'px';
  var nx = dist > 0 ? ox / maxDist : 0;
  var ny = dist > 0 ? oy / maxDist : 0;
  held.left  = nx < -JOYSTICK_DEAD;
  held.right = nx >  JOYSTICK_DEAD;
  held.up    = ny < -JOYSTICK_DEAD;
  held.down  = ny >  JOYSTICK_DEAD;
}

function joystickReset() {
  joystickActive = false;
  joystickId = null;
  joystickThumb.style.left = '43px';
  joystickThumb.style.top  = '43px';
  held.left = held.right = held.up = held.down = false;
}

joystickZone.addEventListener('pointerdown', function(e) {
  e.preventDefault();
  joystickActive = true;
  joystickId = e.pointerId;
  joystickZone.setPointerCapture(e.pointerId);
  joystickUpdate(e.clientX, e.clientY);
});
joystickZone.addEventListener('pointermove', function(e) {
  if (joystickActive && e.pointerId === joystickId) {
    e.preventDefault();
    joystickUpdate(e.clientX, e.clientY);
  }
});
joystickZone.addEventListener('pointerup', function(e) {
  if (e.pointerId === joystickId) joystickReset();
});
joystickZone.addEventListener('pointercancel', function(e) {
  if (e.pointerId === joystickId) joystickReset();
});

// ---- Direct world taps ----
// Convert a canvas backing-store point into the world tile under it. Iso uses the
// same inverse projection and camera as rendering; top-down uses its follow camera.
function canvasBackingPointToTile(bx, by) {
  var wx, wy;
  if (isoActive()) {
    var projectedX = bx / isoScale + isoCamPX;
    var projectedY = by / isoScale + isoCamPY;
    wx = isoInvX(projectedX, projectedY);
    wy = isoInvY(projectedX, projectedY);
  } else {
    var camera = topDownCamera();
    wx = bx + camera.x;
    wy = by + camera.y;
  }
  var row = Math.floor(wy / TILE);
  var col = Math.floor(wx / TILE);
  if (row < 0 || row >= MAP_H || col < 0 || col >= MAP_W) return null;
  return { row: row, col: col };
}

function canvasClientPointToTile(clientX, clientY) {
  var rect = canvas.getBoundingClientRect();
  if (!rect.width || !rect.height) return null;
  var bx = (clientX - rect.left) * canvas.width / rect.width;
  var by = (clientY - rect.top) * canvas.height / rect.height;
  return canvasBackingPointToTile(bx, by);
}

// Tapping a tall thing (an NPC, a ready crop, a shopfront) should work anywhere on the
// part you can SEE. Sprites and prisms are drawn taller than the tile they stand on, so a
// head or body hangs over the ground behind it and a tap there used to resolve to empty
// ground (ELD-PT-005).
//
// The fix walks back down the screen from the tapped tile to find the base of whatever
// silhouette the finger actually landed on. One step down-screen is a different tile step
// in each projection: top-down it is simply the next row, but iso screen-y is (px+py)/2,
// so moving down-screen advances row AND col together.
//
// The tapped tile is always tried first, so a base tile beats anything overhanging it and
// two neighbours can never steal each other's taps. The search stops at TAP_REACH steps —
// far enough to cover our tallest sprite, close enough not to grab unrelated objects.
var TAP_REACH = 2;
function interactAtVisibleTile(row, col) {
  var dCol = (typeof isoActive === 'function' && isoActive()) ? 1 : 0;
  for (var step = 0; step <= TAP_REACH; step++) {
    var r = row + step, c = col + step * dCol;
    if (r >= MAP_H || c >= MAP_W) break;
    if (interactAtTile(r, c)) return true;
  }
  return false;
}

canvas.addEventListener('pointerdown', function(e) {
  var tile = canvasClientPointToTile(e.clientX, e.clientY);
  if (tile && interactAtVisibleTile(tile.row, tile.col)) e.preventDefault();
});

// ---- Action button ----
document.getElementById('actionBtn').addEventListener('pointerdown', function(e) {
  e.preventDefault();
  this.classList.add('flash');
  doAction();
  var self = this;
  setTimeout(function() { self.classList.remove('flash'); }, 150);
});

// ---- Bonus-Harvest button: opens the quick math question ----
document.getElementById('bonusBtn').addEventListener('pointerdown', function(e) {
  e.preventDefault();
  openMathBonus();
});

// ---- Keyboard controls ----
var KEY_DIR = {
  ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
  w: 'up', s: 'down', a: 'left', d: 'right'
};
window.addEventListener('keydown', function (e) {
  if (KEY_DIR[e.key]) {
    var dir = KEY_DIR[e.key];
    held[dir] = true;
    player.facing = dir;
    e.preventDefault();
  }
  // Space or E = action
  if (e.key === ' ' || e.key === 'e' || e.key === 'E') { doAction(); e.preventDefault(); }
  // Escape closes whichever modal is open
  if (e.key === 'Escape' && seedPickerOpen) closeSeedPicker();
  if (e.key === 'Escape' && questOpen) closeQuest();
  if (e.key === 'Escape' && shopOpen) closeShop();
  if (e.key === 'Escape' && mathOpen) closeMathBonus();
  if (e.key === 'Escape' && combatOpen) fleeCombat();
  if (e.key === 'Escape' && cookingOpen) closeCooking();
  if (e.key === 'Escape' && dumplingOpen) closeDumplingVendor();
  if (e.key === 'Escape' && document.getElementById('saveToolsModal').classList.contains('open')) closeSaveTools();
});
window.addEventListener('keyup', function (e) {
  if (KEY_DIR[e.key]) { held[KEY_DIR[e.key]] = false; e.preventDefault(); }
});

// Unlock/resume audio on the first touch or key (browsers block audio until then).
window.addEventListener('pointerdown', ensureAudio);
window.addEventListener('keydown', ensureAudio);

// Recover audio after iPad tab/app switch — iOS suspends AudioContext on blur.
document.addEventListener('visibilitychange', function () {
  if (document.hidden || gameMuted || !gameActive) return;
  if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
  bgMusic.play().catch(function () {});
});

// ---- Start ----
refreshTitleLabels();   // show any previously-saved hero names on the title screen
updateHUD();
loop();
// Autosave the current profile every few seconds (covers walking/position changes).
setInterval(function () { if (gameActive) saveGame(); }, 3000);
