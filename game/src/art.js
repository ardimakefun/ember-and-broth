// Procedural Canvas 2D artwork for Ember & Broth: tile & marble textures, backsplash props,
// glowing lanterns, multi-item pantry crates, stove hardware, dishes, and Chef Pip.

import { INGREDIENTS } from './recipes.js';

/**
 * Draw a rounded rectangle path.
 */
export function roundRect(ctx, x, y, w, h, r) {
  const rad = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rad, y);
  ctx.arcTo(x + w, y, x + w, y + h, rad);
  ctx.arcTo(x + w, y + h, x, y + h, rad);
  ctx.arcTo(x, y + h, x, y, rad);
  ctx.arcTo(x, y, x + w, y, rad);
  ctx.closePath();
}

/**
 * Build reusable warm terracotta & cream tile floor pattern once at startup.
 */
export function createFloorPattern(ctx) {
  const tile = document.createElement('canvas');
  tile.width = 64;
  tile.height = 64;
  const g = tile.getContext('2d');

  g.fillStyle = '#eadac4';
  g.fillRect(0, 0, 64, 64);

  g.fillStyle = '#dec7aa';
  g.fillRect(0, 0, 32, 32);
  g.fillRect(32, 32, 32, 32);

  g.fillStyle = 'rgba(255, 248, 236, 0.25)';
  g.fillRect(2, 2, 28, 3);
  g.fillRect(34, 34, 28, 3);
  g.strokeStyle = 'rgba(92, 60, 38, 0.14)';
  g.strokeRect(0.5, 0.5, 63, 63);
  g.beginPath();
  g.moveTo(32, 0);
  g.lineTo(32, 64);
  g.moveTo(0, 32);
  g.lineTo(64, 32);
  g.stroke();

  return ctx.createPattern(tile, 'repeat');
}

/**
 * Build subtle veined marble pattern for assembly stations.
 */
export function createMarblePattern(ctx) {
  const tile = document.createElement('canvas');
  tile.width = 96;
  tile.height = 96;
  const g = tile.getContext('2d');

  g.fillStyle = '#f6f1ea';
  g.fillRect(0, 0, 96, 96);
  g.strokeStyle = 'rgba(168, 152, 134, 0.22)';
  g.lineWidth = 1.4;
  g.beginPath();
  g.moveTo(0, 24);
  g.bezierCurveTo(32, 18, 54, 42, 96, 30);
  g.moveTo(12, 96);
  g.bezierCurveTo(36, 66, 62, 74, 96, 58);
  g.stroke();
  return ctx.createPattern(tile, 'repeat');
}

/**
 * Draw atmospheric bistro backsplash, hanging copper utensils, glowing lanterns,
 * herb planters, and dining pass lamps around the perimeter of the kitchen.
 */
export function drawKitchenDecor(ctx, time, feverActive = false) {
  // Top timber backsplash rail & subway tiles along back wall
  ctx.fillStyle = '#40291e';
  ctx.fillRect(20, 142, 1240, 18);
  ctx.fillStyle = '#5e3c2a';
  ctx.fillRect(20, 142, 1240, 5);
  ctx.fillStyle = '#241610';
  ctx.fillRect(20, 158, 1240, 3);

  // Small hanging copper skillets & ladles on top rail gaps
  const hooks = [142, 488, 720, 944, 1086];
  for (let i = 0; i < hooks.length; i += 1) {
    const hx = hooks[i];
    ctx.fillStyle = '#d4864b';
    ctx.beginPath();
    ctx.arc(hx, 150, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffd97d';
    ctx.fillRect(hx - 1, 143, 2, 5);
  }

  // Warm paper lanterns casting golden light pools along the top prep line
  const lanterns = [215, 428, 660, 892, 1110];
  for (let i = 0; i < lanterns.length; i += 1) {
    const lx = lanterns[i];
    const ly = 149;
    const flicker = (feverActive ? 1.18 : 0.9) + 0.12 * Math.sin(time * 3.4 + i * 1.7);
    const glow = ctx.createRadialGradient(lx, ly + 12, 4, lx, ly + 12, 82);
    glow.addColorStop(0, `rgba(255, 198, 96, ${0.38 * flicker})`);
    glow.addColorStop(1, 'rgba(255, 165, 65, 0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(lx, ly + 12, 82, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = feverActive ? '#ff6a33' : '#e86838';
    ctx.beginPath();
    ctx.ellipse(lx, ly + 1, 13, 8, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#ffe082';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }

  // Lush herb planter boxes (bottom-left decorative floor accent)
  const planters = [
    { x: 168, y: 576 },
    { x: 254, y: 576 },
  ];
  for (const p of planters) {
    ctx.fillStyle = 'rgba(18, 10, 6, 0.30)';
    roundRect(ctx, p.x + 2, p.y + 5, 68, 48, 8);
    ctx.fill();
    ctx.fillStyle = '#6c452d';
    roundRect(ctx, p.x, p.y, 68, 46, 8);
    ctx.fill();
    ctx.strokeStyle = '#a8754f';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.fillStyle = '#36231a';
    roundRect(ctx, p.x + 6, p.y + 6, 56, 32, 5);
    ctx.fill();
    const sway = Math.sin(time * 2.2 + p.x) * 1.6;
    for (const [lx, ly, rad, col] of [
      [18, 19, 10.5, '#3b9241'],
      [34, 15, 11.5, '#4eb552'],
      [50, 20, 9.5, '#36853b'],
      [27, 26, 8.5, '#69d466'],
      [42, 27, 8.5, '#58c25a'],
    ]) {
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.arc(p.x + lx + sway, p.y + ly, rad, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Stacked dry-goods wooden crate & flour sack on lower-right floor corner
  ctx.fillStyle = 'rgba(18, 10, 6, 0.28)';
  roundRect(ctx, 976, 582, 58, 46, 8);
  ctx.fill();
  ctx.fillStyle = '#8b5e3c';
  roundRect(ctx, 974, 578, 58, 44, 8);
  ctx.fill();
  ctx.strokeStyle = '#5c3a22';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.fillStyle = '#f2e7d5';
  roundRect(ctx, 984, 586, 38, 28, 7);
  ctx.fill();
  ctx.fillStyle = '#8b5e3c';
  ctx.font = 'bold 8px "Trebuchet MS", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('FLOUR', 1003, 603);

  // Chili oil & soy cruets beside the garnish shelf
  const cruets = [
    { x: 1072, y: 174, color: '#2b1914', cap: '#d9483b' },
    { x: 1098, y: 178, color: '#8f4719', cap: '#ffd97d' },
  ];
  for (const c of cruets) {
    ctx.fillStyle = 'rgba(20, 12, 8, 0.28)';
    ctx.beginPath();
    ctx.ellipse(c.x, c.y + 14, 10, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = c.color;
    roundRect(ctx, c.x - 8, c.y - 6, 16, 20, 5);
    ctx.fill();
    ctx.fillStyle = c.cap;
    roundRect(ctx, c.x - 4, c.y - 11, 8, 6, 2);
    ctx.fill();
  }

  // Brass pass-through dining rail accent on the right wall
  ctx.fillStyle = '#a87842';
  ctx.fillRect(1250, 250, 8, 290);
}

/**
 * Draw abundant multi-piece pantry bin contents so each crate looks rich and unmistakable.
 */
export function drawPantryCrate(ctx, ingredientId, cx, cy) {
  ctx.save();
  ctx.translate(cx, cy);
  if (ingredientId === 'steak_raw') {
    // Chilled slate butcher tray with ice shimmer & two marbled cuts
    ctx.fillStyle = '#bcd4e0';
    roundRect(ctx, -23, -15, 46, 30, 5);
    ctx.fill();
    drawIngredient(ctx, 'steak_raw', -7, -2, 18);
    drawIngredient(ctx, 'steak_raw', 7, 2, 18);
  } else if (ingredientId === 'mushroom_raw') {
    drawIngredient(ctx, 'mushroom_raw', -9, -3, 17);
    drawIngredient(ctx, 'mushroom_raw', 9, -2, 17);
    drawIngredient(ctx, 'mushroom_raw', 0, 5, 19);
  } else if (ingredientId === 'scallion_raw') {
    drawIngredient(ctx, 'scallion_raw', -4, -4, 21);
    drawIngredient(ctx, 'scallion_raw', 4, 3, 21);
  } else if (ingredientId === 'egg_raw') {
    for (const [ex, ey] of [[-10, -4], [0, -4], [10, -4], [-5, 5], [5, 5]]) {
      drawIngredient(ctx, 'egg_raw', ex, ey, 14);
    }
  } else if (ingredientId === 'noodles_raw') {
    drawIngredient(ctx, 'noodles_raw', -7, -2, 19);
    drawIngredient(ctx, 'noodles_raw', 7, 2, 19);
  } else if (ingredientId === 'rice_steamed') {
    // Wooden hangiri rice tub with wooden rice paddle
    ctx.fillStyle = '#a67449';
    ctx.beginPath();
    ctx.arc(0, 0, 19, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#6e4726';
    ctx.lineWidth = 2;
    ctx.stroke();
    drawIngredient(ctx, 'rice_steamed', 0, 0, 26);
    ctx.fillStyle = '#d9a466';
    roundRect(ctx, 8, -14, 6, 16, 3);
    ctx.fill();
  } else {
    drawIngredient(ctx, ingredientId, 0, 0, 24);
  }
  ctx.restore();
}

/**
 * Draw an ingredient icon centered at `(cx, cy)` scaled to `size`.
 */
export function drawIngredient(ctx, ingredientId, cx, cy, size = 24, wokHei = false) {
  const s = size / 24;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(s, s);

  if (wokHei) {
    ctx.fillStyle = 'rgba(255, 155, 45, 0.30)';
    ctx.beginPath();
    ctx.arc(0, 0, 17, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 217, 125, 0.72)';
    ctx.lineWidth = 1.3;
    ctx.stroke();
  }

  switch (ingredientId) {
    case 'steak_raw': {
      ctx.fillStyle = '#c23b3e';
      ctx.beginPath();
      ctx.ellipse(0, 1, 13.5, 9.5, -0.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#6e191c';
      ctx.lineWidth = 1.6;
      ctx.stroke();
      ctx.fillStyle = 'rgba(255, 210, 200, 0.24)';
      ctx.beginPath();
      ctx.ellipse(-3, -2, 6, 3, -0.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#fbe3de';
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.moveTo(-7, -2);
      ctx.quadraticCurveTo(-1, 1, 5, -3);
      ctx.moveTo(-4, 4);
      ctx.quadraticCurveTo(2, 2, 7, 5);
      ctx.stroke();
      break;
    }
    case 'steak_chopped': {
      const cubes = [[-6, -3], [4, -4], [-2, 4], [6, 3]];
      for (const [bx, by] of cubes) {
        ctx.fillStyle = '#b93838';
        roundRect(ctx, bx - 4.8, by - 4.2, 9.6, 8.4, 2.2);
        ctx.fill();
        ctx.strokeStyle = '#701d1d';
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.fillStyle = '#f8cbc4';
        ctx.fillRect(bx - 2.2, by - 2.2, 4.4, 1.6);
      }
      break;
    }
    case 'steak_seared': {
      for (let i = -1; i <= 1; i += 1) {
        ctx.save();
        ctx.translate(i * 4.5, i * 1.4);
        ctx.rotate(-0.22);
        ctx.fillStyle = '#682418';
        roundRect(ctx, -8.2, -4.6, 16.4, 9, 3.6);
        ctx.fill();
        ctx.fillStyle = '#cd5e44';
        roundRect(ctx, -6.5, -3, 13, 4.8, 2);
        ctx.fill();
        ctx.fillStyle = 'rgba(255, 224, 188, 0.35)';
        ctx.fillRect(-4, -2.5, 6, 1.4);
        ctx.strokeStyle = '#2d0f09';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(-3, -4);
        ctx.lineTo(-1, 3.8);
        ctx.moveTo(2.5, -4);
        ctx.lineTo(4.5, 3.8);
        ctx.stroke();
        ctx.restore();
      }
      break;
    }
    case 'mushroom_raw': {
      ctx.fillStyle = '#ead9c3';
      roundRect(ctx, -3.5, 1, 7, 9.5, 2.5);
      ctx.fill();
      ctx.fillStyle = '#754e38';
      ctx.beginPath();
      ctx.arc(0, 1, 12, Math.PI, 0);
      ctx.quadraticCurveTo(12, 4.2, 0, 3.2);
      ctx.quadraticCurveTo(-12, 4.2, -12, 1);
      ctx.fill();
      ctx.fillStyle = '#a37558';
      ctx.beginPath();
      ctx.ellipse(-3, -4, 4.2, 2.2, -0.3, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case 'mushroom_chopped':
    case 'mushroom_seared': {
      const seared = ingredientId === 'mushroom_seared';
      const cap = seared ? '#573420' : '#8a6045';
      const gill = seared ? '#e0a96f' : '#ebd9c2';
      for (const [mx, my, rot] of [[-5, -2, -0.4], [5, -1, 0.3], [0, 5, 0.1]]) {
        ctx.save();
        ctx.translate(mx, my);
        ctx.rotate(rot);
        ctx.fillStyle = cap;
        ctx.beginPath();
        ctx.arc(0, 0, 6.8, Math.PI, 0);
        ctx.fill();
        ctx.fillStyle = gill;
        ctx.fillRect(-2.2, 0, 4.4, 4.6);
        ctx.restore();
      }
      break;
    }
    case 'scallion_raw': {
      ctx.rotate(-0.38);
      ctx.fillStyle = '#3ea643';
      roundRect(ctx, -13, -4.2, 18, 3.8, 1.5);
      ctx.fill();
      ctx.fillStyle = '#62ca5c';
      roundRect(ctx, -12, 0.5, 18, 3.8, 1.5);
      ctx.fill();
      ctx.fillStyle = '#f6fae4';
      roundRect(ctx, 4, -4.4, 8, 8.6, 3);
      ctx.fill();
      break;
    }
    case 'scallion_chopped': {
      const rings = [[-6, -3], [3, -5], [-2, 3], [6, 3], [0, -1]];
      for (const [rx, ry] of rings) {
        ctx.strokeStyle = '#36993d';
        ctx.lineWidth = 2.7;
        ctx.beginPath();
        ctx.arc(rx, ry, 3.7, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = '#dcf7b8';
        ctx.beginPath();
        ctx.arc(rx, ry, 1.7, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    }
    case 'egg_raw': {
      ctx.fillStyle = '#f3dfc4';
      ctx.beginPath();
      ctx.ellipse(0, 0, 8.8, 11.2, 0.15, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#c2996d';
      ctx.lineWidth = 1.4;
      ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.65)';
      ctx.beginPath();
      ctx.ellipse(-2.8, -3.5, 2.4, 3.8, 0.2, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case 'egg_fried': {
      ctx.fillStyle = '#fffef8';
      ctx.beginPath();
      ctx.moveTo(-11, -2);
      ctx.quadraticCurveTo(-12, -10.5, -2, -10.5);
      ctx.quadraticCurveTo(9, -11, 11.5, -3);
      ctx.quadraticCurveTo(13, 8.5, 2, 10.5);
      ctx.quadraticCurveTo(-11, 10.5, -11, -2);
      ctx.fill();
      ctx.strokeStyle = '#dfc392';
      ctx.lineWidth = 1.3;
      ctx.stroke();
      ctx.fillStyle = '#ffa812';
      ctx.beginPath();
      ctx.arc(1, 0, 5.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffeb9e';
      ctx.beginPath();
      ctx.arc(-0.9, -1.7, 1.9, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case 'egg_soft': {
      for (const [ex, ey] of [[-5.6, 0], [5.6, 1]]) {
        ctx.fillStyle = '#fffdf7';
        ctx.beginPath();
        ctx.ellipse(ex, ey, 5.8, 8, 0.1, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#d4b287';
        ctx.lineWidth = 1.2;
        ctx.stroke();
        ctx.fillStyle = '#f2871c';
        ctx.beginPath();
        ctx.arc(ex, ey + 1, 3.4, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#ffd573';
        ctx.beginPath();
        ctx.arc(ex - 0.8, ey, 1.2, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    }
    case 'noodles_raw': {
      ctx.fillStyle = '#f4d268';
      roundRect(ctx, -11, -8, 22, 16, 4.5);
      ctx.fill();
      ctx.strokeStyle = '#c8982e';
      ctx.lineWidth = 1.6;
      for (let y = -4; y <= 4; y += 4) {
        ctx.beginPath();
        ctx.moveTo(-9, y);
        ctx.bezierCurveTo(-4, y - 3, 4, y + 3, 9, y);
        ctx.stroke();
      }
      break;
    }
    case 'noodles_broth': {
      ctx.fillStyle = '#df8a30';
      ctx.beginPath();
      ctx.arc(0, 0, 12.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#fae189';
      ctx.lineWidth = 2.3;
      for (let y = -5; y <= 5; y += 5) {
        ctx.beginPath();
        ctx.moveTo(-8, y);
        ctx.quadraticCurveTo(-2, y - 3, 4, y + 1);
        ctx.quadraticCurveTo(7, y + 3, 9, y - 1);
        ctx.stroke();
      }
      break;
    }
    case 'rice_steamed': {
      ctx.fillStyle = '#fdfbf6';
      ctx.beginPath();
      ctx.arc(0, 1, 11.8, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#d6ccb8';
      ctx.lineWidth = 1.4;
      ctx.stroke();
      ctx.fillStyle = '#2d221c';
      for (const [sx, sy] of [[-4, -2], [3, -4], [0, 3], [5, 1], [-3, 4]]) {
        ctx.fillRect(sx, sy, 1.5, 2.2);
      }
      break;
    }
    case 'burnt': {
      ctx.fillStyle = '#2a2320';
      ctx.beginPath();
      ctx.arc(0, 0, 11, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#5c4d46';
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.moveTo(-5, -4);
      ctx.lineTo(5, 4);
      ctx.moveTo(5, -4);
      ctx.lineTo(-5, 4);
      ctx.stroke();
      break;
    }
    default: {
      const def = INGREDIENTS[ingredientId];
      ctx.fillStyle = def?.color ?? '#d7be9e';
      ctx.beginPath();
      ctx.arc(0, 0, 10, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}

/**
 * Draw a plate or bowl holding any subset of ingredients (empty, mid-assembly, or completed).
 */
export function drawDish(ctx, dish, cx, cy, scale = 1, time = 0) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(scale, scale);

  const hasBroth = dish.ingredients.includes('noodles_broth');
  const isCompleted = Boolean(dish.completedRecipeId);

  if (isCompleted) {
    const pulse = 0.65 + 0.35 * Math.sin(time * 5);
    ctx.fillStyle = `rgba(255, 217, 125, ${0.30 * pulse})`;
    ctx.beginPath();
    ctx.arc(0, 0, 29, 0, Math.PI * 2);
    ctx.fill();
  }

  // Drop shadow
  ctx.fillStyle = 'rgba(20, 12, 8, 0.32)';
  ctx.beginPath();
  ctx.ellipse(0, 5, 22.5, 18.5, 0, 0, Math.PI * 2);
  ctx.fill();

  // Vessel outer rim
  ctx.fillStyle = hasBroth ? '#271e21' : '#faf6ef';
  ctx.beginPath();
  ctx.arc(0, 0, 21.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = isCompleted ? '#ffd97d' : hasBroth ? '#c74c35' : '#ccbba3';
  ctx.lineWidth = isCompleted ? 2.8 : 1.9;
  ctx.stroke();

  // Decorative inner rim band
  ctx.strokeStyle = hasBroth ? '#9e3824' : '#ded2be';
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.arc(0, 0, 18.4, 0, Math.PI * 2);
  ctx.stroke();

  // Inner well
  ctx.fillStyle = hasBroth ? '#3d2b24' : '#efe7d8';
  ctx.beginPath();
  ctx.arc(0, 0, 17, 0, Math.PI * 2);
  ctx.fill();

  if (hasBroth) {
    const grad = ctx.createRadialGradient(-3, -3, 2, 0, 0, 17);
    grad.addColorStop(0, '#f5b04d');
    grad.addColorStop(1, '#b5561a');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(0, 0, 16.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#fde591';
    ctx.lineWidth = 2.2;
    for (let y = -5; y <= 6; y += 5.5) {
      ctx.beginPath();
      ctx.moveTo(-11, y);
      ctx.bezierCurveTo(-4, y - 3, 4, y + 3, 11, y);
      ctx.stroke();
    }
    if (isCompleted) {
      ctx.fillStyle = '#d93829';
      for (const [cxDot, cyDot] of [[-9, -6], [9, -5], [-8, 7]]) {
        ctx.beginPath();
        ctx.arc(cxDot, cyDot, 1.6, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  } else if (dish.ingredients.includes('rice_steamed')) {
    ctx.fillStyle = '#fdfbf6';
    ctx.beginPath();
    ctx.arc(-2, 2, 13.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#dfd4c1';
    ctx.lineWidth = 1.2;
    ctx.stroke();
    ctx.fillStyle = '#2d221c';
    for (const [sx, sy] of [[-6, 0], [-1, 5], [3, -2], [-4, 6], [1, 1]]) {
      ctx.fillRect(sx, sy, 1.5, 2.2);
    }
  }

  if (dish.ingredients.includes('steak_seared')) {
    drawIngredient(ctx, 'steak_seared', -6, -4, 15.5);
  }
  if (dish.ingredients.includes('mushroom_seared')) {
    drawIngredient(ctx, 'mushroom_seared', 6, -5, 14.5);
  }
  if (dish.ingredients.includes('egg_fried')) {
    drawIngredient(ctx, 'egg_fried', 5, 4, 15.5);
  }
  if (dish.ingredients.includes('egg_soft')) {
    drawIngredient(ctx, 'egg_soft', 6, 4, 15.5);
  }
  if (dish.ingredients.includes('scallion_chopped')) {
    drawIngredient(ctx, 'scallion_chopped', -2, 3, 13.5);
  }

  if (isCompleted) {
    ctx.strokeStyle = 'rgba(255, 250, 240, 0.56)';
    ctx.lineWidth = 1.7;
    const floatY = -18 - ((time * 12) % 8);
    ctx.beginPath();
    ctx.moveTo(-6, floatY + 6);
    ctx.quadraticCurveTo(-8, floatY + 2, -4, floatY - 2);
    ctx.moveTo(4, floatY + 8);
    ctx.quadraticCurveTo(6, floatY + 4, 3, floatY);
    ctx.stroke();
  }

  ctx.restore();
}

/**
 * Draw Chef Pip with pleated toque, neckerchief, apron, stride animation, and held item.
 */
export function drawChef(ctx, chef, time) {
  ctx.save();
  const bob = chef.moving ? Math.abs(Math.sin(chef.walkCycle)) * 3.6 : Math.sin(time * 3) * 0.8;
  ctx.translate(chef.x, chef.y - bob);

  ctx.fillStyle = 'rgba(18, 10, 6, 0.36)';
  ctx.beginPath();
  ctx.ellipse(0, 15 + bob, 21, 10.5, 0, 0, Math.PI * 2);
  ctx.fill();

  const fx = Math.cos(chef.angle);
  const fy = Math.sin(chef.angle);

  ctx.fillStyle = '#fff9f0';
  ctx.beginPath();
  ctx.ellipse(0, 3, 18, 14.5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#3b2419';
  ctx.lineWidth = 2.1;
  ctx.stroke();

  ctx.fillStyle = '#bf4730';
  roundRect(ctx, -11.5, 2, 23, 13.5, 5);
  ctx.fill();
  ctx.fillStyle = '#f2a238';
  roundRect(ctx, -7, -1, 14, 4.5, 2);
  ctx.fill();

  const handOffset = chef.chopPose > 0 ? Math.sin(chef.chopPose * 32) * 6 : 0;
  ctx.fillStyle = '#f8d2b0';
  ctx.beginPath();
  ctx.arc(fx * 15 - fy * 9, fy * 12 + fx * 6 + handOffset, 5.4, 0, Math.PI * 2);
  ctx.arc(fx * 15 + fy * 9, fy * 12 - fx * 6 - handOffset, 5.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#5c3826';
  ctx.lineWidth = 1.2;
  ctx.stroke();

  if (chef.chopPose > 0) {
    ctx.save();
    ctx.translate(fx * 20, fy * 15 + handOffset);
    ctx.rotate(chef.angle);
    ctx.fillStyle = '#dfe6ee';
    ctx.fillRect(0, -3.5, 16, 6.5);
    ctx.fillStyle = '#3b2419';
    ctx.fillRect(-5, -2.2, 6, 4.4);
    ctx.restore();
  }

  ctx.fillStyle = '#f8d2b0';
  ctx.beginPath();
  ctx.arc(0, -8.5, 13, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#3b2419';
  ctx.lineWidth = 1.9;
  ctx.stroke();

  ctx.fillStyle = 'rgba(232, 108, 92, 0.36)';
  ctx.beginPath();
  ctx.arc(fx * 3 - 6, -5.5 + fy * 2, 2.5, 0, Math.PI * 2);
  ctx.arc(fx * 3 + 6, -5.5 + fy * 2, 2.5, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#291811';
  ctx.beginPath();
  ctx.arc(fx * 4 - 3.6, -8.8 + fy * 2.5, 1.9, 0, Math.PI * 2);
  ctx.arc(fx * 4 + 3.6, -8.8 + fy * 2.5, 1.9, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#ffffff';
  roundRect(ctx, -11.5, -25, 23, 10.5, 4);
  ctx.fill();
  ctx.strokeStyle = '#3b2419';
  ctx.lineWidth = 1.7;
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(-5.5, -27, 6.8, 0, Math.PI * 2);
  ctx.arc(5.5, -27, 6.8, 0, Math.PI * 2);
  ctx.arc(0, -30, 7.8, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  if (chef.holding) {
    const holdX = fx * 21;
    const holdY = -12 + fy * 10;
    if (chef.holding.kind === 'dish') {
      drawDish(ctx, chef.holding, holdX, holdY, 0.94, time);
    } else {
      ctx.fillStyle = 'rgba(20, 12, 8, 0.30)';
      ctx.beginPath();
      ctx.arc(holdX, holdY + 3, 13.5, 0, Math.PI * 2);
      ctx.fill();
      drawIngredient(ctx, chef.holding.ingredientId, holdX, holdY, 25, chef.holding.wokHei);
    }
  }

  ctx.restore();
}
