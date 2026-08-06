// ---- Iso renderer, pass 1: ground (Phase 0 placeholders; spec section 7) ----
// Flat floor diamonds row-major; crops drawn low on their soil tile. Missing iso art
// falls back to a flat colored diamond — same philosophy as the sprite fallback shapes.
// Both modes share the ONE tile palette: TILE_COLOR.
var isoCamPX = 0, isoCamPY = 0;

// Farm ground records are precomputed when the active map changes. Activation resolves
// each tile's four shared vertices once; the draw loop only looks up a decoded image and
// paints its transparent native 64x48 overlay over the continuous flat diamond underneath.
// Town and every non-Farm area retain the existing path.
// Vendor transition indices are direct grass-corner masks, not cardinal-edge
// masks. The bit order follows the screen-facing corners of one diamond.
var ISO_TERRAIN_BITS = { bottom: 1, left: 2, right: 4, top: 8 };
var ISO_TERRAIN_PRIORITY = { grass: 0, path: 1, soil: 2, water: 3 };
var ISO_TERRAIN_PRIORITY_ORDER = ['water', 'soil', 'path', 'grass'];
var isoTerrainRecords = null;
var isoTerrainMapRef = null;

function isoTerrainPadMask(mask) { return String(mask).padStart(2, '0'); }

function isoTerrainFloorTile(tile) {
  if (tile === TREE || tile === HOUSE) return GRASS;
  if (tile === ROCK) return CAVE;
  if (tile === DOOR || tile === EXIT) return PATH;
  return tile;
}

function isoTerrainFamily(tile) {
  tile = isoTerrainFloorTile(tile);
  if (tile === WATER) return 'water';
  if (tile === SOIL) return 'soil';
  if (tile === PATH) return 'path';
  if (tile === GRASS) return 'grass';
  return null;
}

function isoTerrainMapFamily(row, col) {
  if (row < 0 || row >= MAP_H || col < 0 || col >= MAP_W) return null;
  return isoTerrainFamily(map[row][col]);
}

// A vertex at (row, col) is shared by [row-1,col-1], [row-1,col],
// [row,col-1], and [row,col]. Out-of-bounds cells contribute no material;
// this keeps a map edge from inventing a grass border around a solid region.
// If a caller asks for a completely out-of-bounds vertex, grass is the neutral
// fallback. Every real Farm-tile vertex includes its owning in-bounds cell.
function isoTerrainVertexFamily(row, col) {
  var families = [
    isoTerrainMapFamily(row - 1, col - 1),
    isoTerrainMapFamily(row - 1, col),
    isoTerrainMapFamily(row, col - 1),
    isoTerrainMapFamily(row, col)
  ];
  var best = 'grass';
  for (var i = 0; i < families.length; i++) {
    var family = families[i];
    if (!family) continue;
    if (ISO_TERRAIN_PRIORITY[family] > ISO_TERRAIN_PRIORITY[best]) best = family;
  }
  return best;
}

// The four entries are in vendor-mask bit order. The screen-corner/world-
// vertex mapping is: bottom=SE, left=SW, right=NE, top=NW.
function isoTerrainCornerFamilies(row, col) {
  return [
    { bit: ISO_TERRAIN_BITS.bottom, family: isoTerrainVertexFamily(row + 1, col + 1) },
    { bit: ISO_TERRAIN_BITS.left, family: isoTerrainVertexFamily(row + 1, col) },
    { bit: ISO_TERRAIN_BITS.right, family: isoTerrainVertexFamily(row, col + 1) },
    { bit: ISO_TERRAIN_BITS.top, family: isoTerrainVertexFamily(row, col) }
  ];
}

function isoTerrainGrassCornerMask(corners) {
  var mask = 0;
  for (var i = 0; i < corners.length; i++) if (corners[i].family === 'grass') mask |= corners[i].bit;
  return mask;
}

function isoTerrainHighestNonGrassFamily(corners) {
  var best = null;
  for (var i = 0; i < corners.length; i++) {
    var family = corners[i].family;
    if (!family || family === 'grass') continue;
    if (!best || ISO_TERRAIN_PRIORITY[family] > ISO_TERRAIN_PRIORITY[best] ||
        (ISO_TERRAIN_PRIORITY[family] === ISO_TERRAIN_PRIORITY[best] &&
         ISO_TERRAIN_PRIORITY_ORDER.indexOf(family) < ISO_TERRAIN_PRIORITY_ORDER.indexOf(best))) best = family;
  }
  return best;
}

function isoTerrainSpriteKey(row, col, centerFamily) {
  var corners = isoTerrainCornerFamilies(row, col);
  var grassMask = isoTerrainGrassCornerMask(corners);
  if (centerFamily === 'grass') {
    // Soil-derived grass owns open Farm ground. Other grass bases are reserved
    // for their own transition family below, so palettes never mix freely.
    if (grassMask === 15) return 'iso_terrain_grass_base_soil';
    var transitionFamily = isoTerrainHighestNonGrassFamily(corners);
    if (!transitionFamily) return 'iso_terrain_grass_base_soil';
    // The vendor index is used directly: set bits are the corners that remain
    // grass. There is deliberately no polarity inversion or mirroring.
    return 'iso_terrain_' + transitionFamily + '_' + isoTerrainPadMask(grassMask);
  }
  // A non-grass center owns every shared vertex it touches under the material
  // priority rule, so its authored full-secondary tile is the stable hard edge.
  return 'iso_terrain_' + centerFamily + '_00';
}

function isoTerrainAreaActivated(name) {
  isoTerrainRecords = null;
  isoTerrainMapRef = null;
  if (name !== 'farm') return;
  isoTerrainRecords = [];
  isoTerrainMapRef = map;
  for (var row = 0; row < MAP_H; row++) {
    for (var col = 0; col < MAP_W; col++) {
      var tile = map[row][col];
      var floorTile = isoTerrainFloorTile(tile);
      var family = isoTerrainFamily(tile);
      isoTerrainRecords.push({
        row: row,
        col: col,
        cx: isoPX((col + 0.5) * TILE, (row + 0.5) * TILE),
        cy: isoPY((col + 0.5) * TILE, (row + 0.5) * TILE),
        spriteKey: family ? isoTerrainSpriteKey(row, col, family) : null,
        fallbackTile: floorTile,
        fallbackColor: TILE_COLOR[floorTile] || '#333333'
      });
    }
  }
}

function drawIsoTerrainRecord(record) {
  // The flat diamond is always drawn first so adjacent Farm cells share one continuous
  // ground plane. Flattened terrain derivatives contain only an inset top-face overlay:
  // their authored skirt and perimeter are transparent, so they cannot form a raised
  // block lattice between cells.
  drawIsoTileDiamond(record.cx, record.cy, record.fallbackColor);

  // The preload barrier settles only after every requested terrain file has either
  // decoded or failed. This prevents a first-use decode hitch while preserving the
  // exact legacy fallback for an individual missing sprite.
  var image = isoTerrainPreloadSettled && record.spriteKey ? spr(record.spriteKey) : null;
  if (image) {
    // The overlay is already the exact ISO_TW x ISO_TH top-face canvas at native
    // resolution. Its center is anchored at (cx, cy); transparent rows preserve the
    // 64x48 runtime canvas without shifting the ground diamond.
    ctx.drawImage(image, record.cx - ISO_TW / 2, record.cy - ISO_TH / 2);
  } else if (record.fallbackTile === SOIL) {
    // Preserve the exact existing missing-art fallback over the flat underlay.
    drawIsoSoilTile(record.cx, record.cy);
  }
}

// Half-width/half-height variant: prisms narrower than a tile (villagers) share this path.
function drawIsoDiamondAt(cx, cy, hw, hh, fillColor) {
  ctx.beginPath();
  ctx.moveTo(cx, cy - hh);
  ctx.lineTo(cx + hw, cy);
  ctx.lineTo(cx, cy + hh);
  ctx.lineTo(cx - hw, cy);
  ctx.closePath();
  ctx.fillStyle = fillColor;
  ctx.fill();
}

function drawIsoTileDiamond(cx, cy, fillColor) {
  drawIsoDiamondAt(cx, cy, ISO_TW / 2, ISO_TH / 2, fillColor);
}

function drawIsoSoilTile(cx, cy) {
  drawIsoTileDiamond(cx, cy, '#70472c');
  ctx.strokeStyle = '#9a6640';
  ctx.lineWidth = 1.25;
  for (var i = -2; i <= 2; i++) {
    var ox = i * 7;
    ctx.beginPath();
    ctx.moveTo(cx - 17 + ox, cy - 4 + ox / 2);
    ctx.lineTo(cx + 2 + ox, cy + 6 + ox / 2);
    ctx.stroke();
  }
}

function cropVisualStage(crop, now) {
  if (crop.status === 'ready') return 2;
  var type = crop.type || 'turnip';
  var growMs = crop.growMs || CROPS[type].grow;
  return Math.max(0, Math.min(1, (now - crop.plantedAt) / growMs)) < 0.45 ? 0 : 1;
}

function drawIsoStar(cx, cy, radius, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  for (var i = 0; i < 8; i++) {
    var a = -Math.PI / 2 + i * Math.PI / 4;
    var rr = i % 2 === 0 ? radius : radius * 0.42;
    var x = cx + Math.cos(a) * rr;
    var y = cy + Math.sin(a) * rr;
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fill();
}

function drawIsoProduce(type, x, y, color) {
  ctx.fillStyle = color;
  if (type === 'carrot') {
    ctx.beginPath();
    ctx.moveTo(x - 3, y - 3); ctx.lineTo(x + 3, y - 3); ctx.lineTo(x, y + 5);
    ctx.closePath(); ctx.fill();
  } else if (type === 'corn') {
    ctx.fillRect(x - 2.5, y - 7, 5, 10);
    ctx.fillStyle = '#fff073';
    ctx.fillRect(x - 1, y - 5, 2, 6);
  } else if (type === 'pumpkin') {
    ctx.beginPath(); ctx.ellipse(x, y, 5, 3.5, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#9a5b16'; ctx.lineWidth = 1; ctx.stroke();
  } else if (type === 'starfruit') {
    drawIsoStar(x, y - 2, 5, color);
    ctx.fillStyle = '#ffe57a';
    ctx.fillRect(x - 1, y - 3, 2, 2);
  } else {
    ctx.beginPath(); ctx.ellipse(x, y, 4, 3.5, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#e8f2d0';
    ctx.fillRect(x - 1.5, y - 1, 3, 3);
  }
}

// A compact, deterministic crop proof: distinct growth stages and produce silhouettes.
// Final iso art can replace this without changing crop state or economy logic.
function drawIsoCrop(cx, cy, crop, now) {
  var type = crop.type || 'turnip';
  var info = CROPS[type];
  var stage = cropVisualStage(crop, now);
  var cropImg = spr('iso_crop_' + type);

  if (cropImg) {
    ctx.save();
    if (stage === 2) {
      var assetGlow = 0.10 + (Math.sin(now / 220) + 1) * 0.04;
      ctx.globalAlpha = assetGlow;
      ctx.fillStyle = info.readyColor;
      ctx.beginPath(); ctx.ellipse(cx, cy - 4, 24, 11, 0, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1;
    }
    ctx.drawImage(cropImg, stage * 64, 0, 64, 64, cx - 32, cy - 63, 64, 64);
    ctx.restore();
    return;
  }

  var positions = stage === 0 ? [[-7, 2], [7, 2]] : [[-11, 3], [0, 7], [11, 3]];

  ctx.save();
  if (stage === 2) {
    var glow = 0.10 + (Math.sin(now / 220) + 1) * 0.04;
    ctx.globalAlpha = glow;
    ctx.fillStyle = info.readyColor;
    ctx.beginPath(); ctx.ellipse(cx, cy - 4, 24, 11, 0, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;
  }

  for (var i = 0; i < positions.length; i++) {
    var px = cx + positions[i][0];
    var py = cy + positions[i][1];
    var stemH = stage === 0 ? 5 : (stage === 1 ? 10 : 13);
    ctx.strokeStyle = '#285b2e';
    ctx.lineWidth = stage === 0 ? 1.5 : 2;
    ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px, py - stemH); ctx.stroke();
    ctx.fillStyle = '#4f9a45';
    ctx.beginPath();
    ctx.ellipse(px - 3, py - stemH + 3, 4, 2, -0.35, 0, Math.PI * 2);
    ctx.ellipse(px + 3, py - stemH + 5, 4, 2, 0.35, 0, Math.PI * 2);
    ctx.fill();
    if (stage === 2) drawIsoProduce(type, px, py - 1, info.readyColor);
    else if (stage === 1) {
      ctx.fillStyle = info.color;
      ctx.beginPath(); ctx.arc(px, py - stemH, 2.5, 0, Math.PI * 2); ctx.fill();
    }
  }
  ctx.restore();
}

function isoUpdateCamera() {
  var pcx = isoPX(player.x + player.size / 2, player.y + player.size / 2);
  var pcy = isoPY(player.x + player.size / 2, player.y + player.size / 2);
  isoCamPX = pcx - isoCamW / 2;
  isoCamPY = pcy - isoCamH / 2;
  var totW = (MAP_W + MAP_H) * TILE, totH = (MAP_W + MAP_H) * TILE / 2;
  if (isoCamPX > totW - isoCamW) isoCamPX = totW - isoCamW;
  if (isoCamPY > totH - isoCamH) isoCamPY = totH - isoCamH;
  if (isoCamPX < 0) isoCamPX = 0;
  if (isoCamPY < -ISO_TH * 3) isoCamPY = -ISO_TH * 3;   // headroom for tall props
}

function drawIsoWorld() {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.imageSmoothingEnabled = false;                     // crisp pixel art at any zoom
  ctx.fillStyle = '#0d0a06';                             // moody void, not pure black
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  isoUpdateCamera();
  var now = Date.now();
  ctx.setTransform(isoScale, 0, 0, isoScale, -isoCamPX * isoScale, -isoCamPY * isoScale);
  var farmTerrainActive = currentArea === 'farm' && !window.__isoTerrainForceFallback;
  if (farmTerrainActive && (!isoTerrainRecords || isoTerrainMapRef !== map))
    isoTerrainAreaActivated(currentArea);
  for (var r = 0; r < MAP_H; r++) {
    for (var c = 0; c < MAP_W; c++) {
      var wx = (c + 0.5) * TILE, wy = (r + 0.5) * TILE;
      var cx = isoPX(wx, wy), cy = isoPY(wx, wy);
      var t = map[r][c];
      if (farmTerrainActive) {
        drawIsoTerrainRecord(isoTerrainRecords[r * MAP_W + c]);
      } else {
        // Tall tile types become Pass-2 prisms; their floor shows the ground beneath.
        var floorColor = TILE_COLOR[t] || '#333333';
        if (t === TREE || t === HOUSE) floorColor = TILE_COLOR[GRASS];
        else if (t === ROCK) floorColor = TILE_COLOR[CAVE];   // rock stands on cavern floor, not grass
        else if (t === DOOR || t === EXIT) floorColor = TILE_COLOR[PATH];
        if (t === SOIL) drawIsoSoilTile(cx, cy);
        else drawIsoTileDiamond(cx, cy, floorColor);
      }
      var crop = cropData[r + ',' + c];
      if (crop && crop.status !== 'empty') drawIsoCrop(cx, cy, crop, now);
    }
  }

  // ---- Pass 2: depth-sorted objects (spec section 7) ----
  var objs = isoCollectObjects();
  // Test hook only. Building tiles and villagers get identifying labels so depth assertions
  // can name an exact target; every other label is the object's kind, unchanged.
  if (window.__isoDebug) window.__isoDrawOrder = objs.map(function (o) {
    if (o.tile === HOUSE || o.tile === DOOR) return 'building@' + o.row + ',' + o.col;
    if (o.kind === 'npc') return 'npc@' + o.npc.id;
    return o.kind;
  });
  for (var oi = 0; oi < objs.length; oi++) {
    var o = objs[oi];
    var ocx = isoPX(o.px, o.py), ocy = isoPY(o.px, o.py);
    if (o.tile === HOUSE || o.tile === DOOR) drawIsoBuildingTile(ocx, ocy, o.tile);
    else if (o.tile) drawIsoPrism(ocx, ocy, ISO_PROP_HEIGHT[o.tile],
                             TILE_COLOR[o.tile] || '#555555');
    else if (o.kind === 'npc') drawIsoNpc(ocx, ocy, o.npc, now);
    else if (o.kind === 'cookpot') drawIsoPrism(ocx, ocy, 16, '#6b4423');
    else if (o.kind === 'enemy') {
      var eimg = spr('enemy_' + o.enemy.type);
      if (eimg) {
        ctx.drawImage(eimg, ocx - 20, ocy - 38, 40, 40);
        // Alive-enemy cue: a bobbing red dot above the sprite.
        ctx.fillStyle = '#ff5555';
        ctx.beginPath();
        ctx.arc(ocx, ocy - 42 + Math.sin(now / 250) * 3, 4, 0, Math.PI * 2);
        ctx.fill();
      } else {
        drawIsoPrism(ocx, ocy, 24, ENEMIES[o.enemy.type].color);
      }
    }
    else if (o.kind === 'player') {
      var walkImg = playerWalkSprite();
      var img = playerSprite();
      if (walkImg) {
        // Same square-frame slicing rule as drawSpriteFrame, scaled to iso size.
        var pfw = walkImg.naturalHeight;
        ctx.drawImage(walkImg, player.walkFrame * pfw, 0, pfw, pfw,
                      ocx - 24, ocy - 46, 48, 48);
      }
      else if (img) ctx.drawImage(img, ocx - 24, ocy - 46, 48, 48);
      else drawIsoPrism(ocx, ocy, 30, '#4a90d9');
    }
  }
  drawIsoCues(now);
  drawIsoPops(now);
  drawOnboardingWorldHighlight(now);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
}

function drawIsoPops(now) {
  var keep = [];
  ctx.font = 'bold 15px system-ui, sans-serif';
  ctx.textAlign = 'center';
  for (var i = 0; i < pops.length; i++) {
    var p = pops[i];
    var age = now - p.born;
    if (age > 900) continue;
    var sx = isoPX(p.wx, p.wy);
    var sy = isoPY(p.wx, p.wy) - 20 - (age / 900) * 22;
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
}

// ---- Iso renderer helpers: placeholder prisms (Phase 0) ----
// Tuned toward the sleek/moody direction: dark faces, lit top, rim edge.
function isoShade(hex, f) {   // multiply a #rrggbb color's brightness by f
  var n = parseInt(hex.slice(1), 16);
  var r = Math.min(255, Math.round(((n >> 16) & 255) * f));
  var g = Math.min(255, Math.round(((n >> 8) & 255) * f));
  var b = Math.min(255, Math.round((n & 255) * f));
  return 'rgb(' + r + ',' + g + ',' + b + ')';
}

// opts.w scales the footprint (1 = a full tile); opts.rim = false drops the top outline so
// neighbouring prisms of one building fuse into a single mass instead of a grid of blocks.
function drawIsoPrism(cx, cy, h, baseColor, opts) {
  var hw = (ISO_TW / 2) * ((opts && opts.w) || 1);
  var hh = (ISO_TH / 2) * ((opts && opts.w) || 1);
  // Left + right faces down from the top diamond's south/west/east points.
  ctx.fillStyle = isoShade(baseColor, 0.45);
  ctx.beginPath();
  ctx.moveTo(cx - hw, cy - h); ctx.lineTo(cx, cy - h + hh);
  ctx.lineTo(cx, cy + hh); ctx.lineTo(cx - hw, cy); ctx.closePath(); ctx.fill();
  ctx.fillStyle = isoShade(baseColor, 0.6);
  ctx.beginPath();
  ctx.moveTo(cx + hw, cy - h); ctx.lineTo(cx, cy - h + hh);
  ctx.lineTo(cx, cy + hh); ctx.lineTo(cx + hw, cy); ctx.closePath(); ctx.fill();
  // Lit top diamond, optionally rimmed.
  if (opts && opts.rim === false) {
    drawIsoDiamondAt(cx, cy - h, hw, hh, isoShade(baseColor, 1.1));
  } else {
    ctx.strokeStyle = isoShade(baseColor, 1.4);
    ctx.lineWidth = 1.5;
    drawIsoDiamondAt(cx, cy - h, hw, hh, isoShade(baseColor, 1.1));
    ctx.stroke();
  }
}

var ISO_PROP_HEIGHT = {};
ISO_PROP_HEIGHT[TREE]  = 40;   // chunky enough to read, short enough not to hide paths
ISO_PROP_HEIGHT[HOUSE] = 56;
ISO_PROP_HEIGHT[DOOR]  = 56;   // same as HOUSE: a door is a hole in a wall, not a short block
ISO_PROP_HEIGHT[EXIT]  = 12;
ISO_PROP_HEIGHT[ROCK]  = 44;   // cavern wall: taller than a tree so tunnels feel enclosed

// ---- Buildings (Phase 2 Town slice) ----
// The doorway sits on the south-west wall face, which the tile's eastern neighbour never
// covers, so an entrance stays visible along a continuous shop front. One helper owns the
// geometry so the panel and its pulsing cue can never drift apart.
function isoDoorPanel(cx, cy) {
  // The face's ground edge runs from its west corner to the tile's south corner, so a
  // fraction t along it advances by half a tile width and half a tile height.
  var bx = cx - ISO_TW / 2, by = cy;
  var t1 = 0.28, t2 = 0.72;
  return {
    x1: bx + (ISO_TW / 2) * t1, y1: by + (ISO_TH / 2) * t1,
    x2: bx + (ISO_TW / 2) * t2, y2: by + (ISO_TH / 2) * t2,
    h: ISO_PROP_HEIGHT[HOUSE] * 0.62
  };
}

function isoTracePanel(p) {
  ctx.beginPath();
  ctx.moveTo(p.x1, p.y1); ctx.lineTo(p.x2, p.y2);
  ctx.lineTo(p.x2, p.y2 - p.h); ctx.lineTo(p.x1, p.y1 - p.h);
  ctx.closePath();
}

// A multi-tile building is still drawn tile by tile, so every tile keeps its own depth key
// and sorts correctly against the hero (spec section 7). Uniform height + no per-tile rim is
// what turns those tiles into one readable mass rather than a plateau of separate blocks.
function drawIsoBuildingTile(cx, cy, tile) {
  drawIsoPrism(cx, cy, ISO_PROP_HEIGHT[HOUSE], TILE_COLOR[HOUSE], { rim: false });
  if (tile !== DOOR) return;
  var p = isoDoorPanel(cx, cy);
  isoTracePanel(p);
  ctx.fillStyle = isoShade(TILE_COLOR[DOOR], 0.55);
  ctx.fill();
  ctx.strokeStyle = isoShade(TILE_COLOR[DOOR], 1.3);
  ctx.lineWidth = 1.5;
  ctx.stroke();
}

// Villagers read as people, not crates. The supplied Town idle art is currently
// stationary, so only its south-facing/down-right frame is used; the existing
// procedural shape remains the honest fallback until NPC facing/state data lands.
function drawIsoNpc(cx, cy, npc, now) {
  var npcImg = spr('iso_npc_' + npc.id + '_' + ISO_NPC_IDLE_DIRECTION_KEY);
  if (npcImg) {
    // Lossless 64x64 art is translated so its feet meet the Town tile's south
    // corner at (cx, cy + 16), matching the existing prism footprint.
    ctx.drawImage(npcImg, cx - 32, cy - 48, 64, 64);
    if (window.__isoDebug) {
      if (!window.__isoNpcDraws) window.__isoNpcDraws = [];
      window.__isoNpcDraws.push(npc.id);
    }
  } else {
    drawIsoPrism(cx, cy, 26, npc.color, { w: 0.42 });
    drawIsoPrism(cx, cy - 26, 10, '#f0c8a0', { w: 0.3 });
  }
  var bob = Math.sin(now / 250) * 3;
  ctx.fillStyle = '#fff2b0';
  ctx.font = 'bold 18px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('!', cx, cy - 46 + bob);
  ctx.textAlign = 'left';
}

// Entry and travel cues, drawn after the object pass so a doorway or road exit is never
// buried behind the wall it belongs to. Pulse plus a bobbing arrow that points at the
// tile you should step on.
function drawIsoCues(now) {
  for (var r = 0; r < MAP_H; r++) {
    for (var c = 0; c < MAP_W; c++) {
      var t = map[r][c];
      if (t !== DOOR && t !== EXIT) continue;
      var cx = isoPX((c + 0.5) * TILE, (r + 0.5) * TILE);
      var cy = isoPY((c + 0.5) * TILE, (r + 0.5) * TILE);
      var pulse = 0.5 + 0.5 * Math.abs(Math.sin(now / 350));
      var bob = Math.sin(now / 200) * 3;
      ctx.strokeStyle = 'rgba(255, 214, 102,' + pulse + ')';
      ctx.lineWidth = 2;
      if (t === DOOR) {
        // Outline the doorway itself. A door tile's ground diamond is buried under its own
        // wall, so pulsing the floor there would just paint a diamond across the building.
        var p = isoDoorPanel(cx, cy);
        isoTracePanel(p);
        ctx.stroke();
        drawArrow((p.x1 + p.x2) / 2, p.y1 - p.h - 8 + bob, 7, 'down', '#fff2b0');
      } else {
        ctx.beginPath();
        ctx.moveTo(cx, cy - ISO_TH / 2); ctx.lineTo(cx + ISO_TW / 2, cy);
        ctx.lineTo(cx, cy + ISO_TH / 2); ctx.lineTo(cx - ISO_TW / 2, cy);
        ctx.closePath(); ctx.stroke();
        drawArrow(cx, cy - 24 + bob, 6, 'down', '#fff2b0');
      }
    }
  }
}

function isoCollectObjects() {
  var objs = [];
  for (var r = 0; r < MAP_H; r++) for (var c = 0; c < MAP_W; c++) {
    var t = map[r][c];
    if (ISO_PROP_HEIGHT[t]) {
      objs.push({ px: (c + 0.5) * TILE, py: (r + 0.5) * TILE,
                  kind: 'tree@' + r + ',' + c, tile: t, row: r, col: c });
    }
  }
  for (var n = 0; n < NPCS.length; n++) if (NPCS[n].area === currentArea)
    objs.push({ px: (NPCS[n].col + 0.5) * TILE, py: (NPCS[n].row + 0.5) * TILE,
                kind: 'npc', npc: NPCS[n] });
  if (currentArea === 'farm')
    objs.push({ px: (FARM_COOKPOT.col + 0.5) * TILE, py: (FARM_COOKPOT.row + 0.5) * TILE,
                kind: 'cookpot' });
  for (var e = 0; e < currentEnemies.length; e++) if (currentEnemies[e].alive)
    objs.push({ px: (currentEnemies[e].col + 0.5) * TILE, py: (currentEnemies[e].row + 0.5) * TILE,
                kind: 'enemy', enemy: currentEnemies[e] });
  objs.push({ px: player.x + player.size / 2, py: player.y + player.size, kind: 'player' });
  objs.sort(function (a, b) { return isoDepthKey(a.px, a.py) - isoDepthKey(b.px, b.py); });
  return objs;
}

// The initial live pointer is established by js/03 before this renderer script
// loads, so build Farm's records once before the main loop can draw it.
if (typeof currentArea !== 'undefined') isoTerrainAreaActivated(currentArea);

