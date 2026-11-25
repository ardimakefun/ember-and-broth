// Layered Canvas 2D renderer for Ember & Broth: kitchen architecture, stove hardware,
// order board tickets, assembly pills, hover tooltips, recipe guide, and end-shift summary.

import {
  createFloorPattern,
  createMarblePattern,
  drawChef,
  drawDish,
  drawIngredient,
  drawKitchenDecor,
  drawPantryCrate,
  roundRect,
} from './art.js';
import { FIELD, FONT_DISPLAY, FONT_UI, MODES, PALETTE, TIMERS } from './config.js';
import { STATION_TYPES } from './kitchen.js';
import { INGREDIENTS, RECIPES, RECIPE_BY_ID, bestPartialRecipe, matchingCandidateRecipes } from './recipes.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';

const STATION_HINTS = {
  [STATION_TYPES.PANTRY]: 'Click / [E] Grab fresh ingredient',
  [STATION_TYPES.BOARD]: 'Drop raw Steak/Shroom/Scallion, then [F] or Click to chop',
  [STATION_TYPES.WOK]: 'Sear sliced meat, mushrooms, or fry eggs • [F] Wok Toss!',
  [STATION_TYPES.POT]: 'Simmer ramen noodles or soft-boil eggs in dashi broth',
  [STATION_TYPES.PLATE_STACK]: 'Grab empty vessel or auto-plate a ready ingredient',
  [STATION_TYPES.ASSEMBLY]: 'Combine cooked ingredients onto a plate or bowl',
  [STATION_TYPES.COUNTER]: 'Staging counter for prepped ingredients or dishes',
  [STATION_TYPES.SERVE_PASS]: 'Place finished dish here under heat lamps',
  [STATION_TYPES.BELL]: 'Click / [E] Ring Bell to serve ready dishes on Pass!',
  [STATION_TYPES.TRASH]: 'Discard burnt scraps or unwanted items',
};

function formatClock(seconds) {
  const s = Math.max(0, Math.ceil(seconds));
  const mins = Math.floor(s / 60);
  const secs = s % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  const floorPattern = createFloorPattern(ctx);
  const marblePattern = createMarblePattern(ctx);
  const view = { scale: 1, x: 0, y: 0 };
  const buttons = [];

  function resize() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = Math.round(window.innerWidth * dpr);
    const h = Math.round(window.innerHeight * dpr);
    canvas.width = w;
    canvas.height = h;
    view.scale = Math.min(w / FIELD.width, h / FIELD.height);
    view.x = (w - FIELD.width * view.scale) / 2;
    view.y = (h - FIELD.height * view.scale) / 2;
  }

  resize();
  window.addEventListener('resize', resize);

  function addButton(id, x, y, w, h) {
    buttons.push({ id, x, y, w, h });
  }

  function hitButton(fx, fy) {
    for (let i = buttons.length - 1; i >= 0; i -= 1) {
      const b = buttons[i];
      if (fx >= b.x && fx <= b.x + b.w && fy >= b.y && fy <= b.y + b.h) return b.id;
    }
    return null;
  }

  function drawProgressArc(cx, cy, radius, ratio, color) {
    ctx.fillStyle = 'rgba(20,14,12,0.78)';
    ctx.beginPath();
    ctx.arc(cx, cy, radius + 3, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = 'rgba(255,255,255,0.20)';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.stroke();

    ctx.strokeStyle = color;
    ctx.lineWidth = 4.5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(cx, cy, radius, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.max(0, Math.min(1, ratio)));
    ctx.stroke();
  }

  function isSuggestedStation(s, state) {
    const held = state.chef.holding;
    if (!held) return false;
    if (held.kind === 'dish') {
      if (held.completedRecipeId) return s.type === STATION_TYPES.SERVE_PASS || s.type === STATION_TYPES.BELL;
      return s.type === STATION_TYPES.ASSEMBLY && !s.item;
    }
    const def = INGREDIENTS[held.ingredientId];
    if (!def) return false;
    if (def.choppable) return s.type === STATION_TYPES.BOARD && !s.item;
    if (def.searTime && !def.ready) return s.type === STATION_TYPES.WOK && !s.item;
    if (def.boilTime && !def.ready) return s.type === STATION_TYPES.POT && !s.item;
    if (def.ready) {
      if (s.type === STATION_TYPES.ASSEMBLY && s.item?.kind === 'dish' && !s.item.completedRecipeId) {
        return matchingCandidateRecipes(s.item.ingredients, held.ingredientId).length > 0;
      }
      return s.type === STATION_TYPES.PLATE_STACK && held.ingredientId !== 'burnt';
    }
    return false;
  }

  function drawKitchenFloor(state) {
    ctx.fillStyle = PALETTE.woodDark;
    roundRect(ctx, FIELD.kitchenLeft - 4, FIELD.kitchenTop - 4, FIELD.kitchenRight - FIELD.kitchenLeft + 8, FIELD.kitchenBottom - FIELD.kitchenTop + 8, 12);
    ctx.fill();

    ctx.save();
    roundRect(ctx, FIELD.kitchenLeft, FIELD.kitchenTop, FIELD.kitchenRight - FIELD.kitchenLeft, FIELD.kitchenBottom - FIELD.kitchenTop, 10);
    ctx.clip();
    ctx.fillStyle = floorPattern;
    ctx.fillRect(FIELD.kitchenLeft, FIELD.kitchenTop, FIELD.kitchenRight - FIELD.kitchenLeft, FIELD.kitchenBottom - FIELD.kitchenTop);

    const lamp = ctx.createRadialGradient(620, 390, 40, 620, 390, 480);
    lamp.addColorStop(0, state.feverTimer > 0 ? 'rgba(255, 200, 115, 0.32)' : 'rgba(255, 224, 165, 0.24)');
    lamp.addColorStop(1, 'rgba(35, 22, 16, 0.20)');
    ctx.fillStyle = lamp;
    ctx.fillRect(FIELD.kitchenLeft, FIELD.kitchenTop, FIELD.kitchenRight - FIELD.kitchenLeft, FIELD.kitchenBottom - FIELD.kitchenTop);

    // Unified cabinetry base behind station groups
    const counterRuns = [
      [30, 158, 94, 470],
      [166, 158, 886, 86],
      [382, 370, 452, 94],
      [382, 550, 336, 88],
      [1138, 158, 110, 480],
    ];
    for (const [rx, ry, rw, rh] of counterRuns) {
      ctx.fillStyle = 'rgba(54, 34, 23, 0.88)';
      roundRect(ctx, rx, ry, rw, rh, 12);
      ctx.fill();
      ctx.strokeStyle = 'rgba(230, 184, 92, 0.30)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }

    // Cozy anti-fatigue runner mats
    ctx.fillStyle = 'rgba(130, 56, 38, 0.32)';
    roundRect(ctx, 268, 254, 682, 34, 8);
    ctx.fill();
    roundRect(ctx, 1094, 266, 34, 274, 8);
    ctx.fill();

    // Brass heat-lamp glow over the Serve Pass
    const passGlow = ctx.createRadialGradient(1193, 335, 16, 1193, 335, 122);
    passGlow.addColorStop(0, 'rgba(255, 214, 110, 0.42)');
    passGlow.addColorStop(1, 'rgba(255, 180, 65, 0)');
    ctx.fillStyle = passGlow;
    ctx.fillRect(1080, 230, 175, 225);
    ctx.restore();
  }

  function drawStationHardware(s, state, time) {
    if (s.type === STATION_TYPES.PANTRY) {
      ctx.fillStyle = '#5e3b25';
      roundRect(ctx, s.x + 10, s.y + 7, s.w - 20, s.h - 24, 6);
      ctx.fill();
      drawPantryCrate(ctx, s.ingredient, s.cx, s.cy - 6);
      ctx.fillStyle = PALETTE.ink;
      ctx.font = `bold 11px ${FONT_UI}`;
      ctx.textAlign = 'center';
      ctx.fillText(s.label, s.cx, s.y + s.h - 10);
      return;
    }

    if (s.type === STATION_TYPES.BOARD) {
      ctx.fillStyle = '#c49664';
      roundRect(ctx, s.x + 11, s.y + 9, s.w - 22, s.h - 27, 6);
      ctx.fill();
      ctx.strokeStyle = '#8b6036';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      if (!s.item) {
        ctx.save();
        ctx.translate(s.cx + 10, s.cy - 2);
        ctx.rotate(-0.55);
        ctx.fillStyle = '#d8dee6';
        ctx.fillRect(-10, -3, 18, 6);
        ctx.fillStyle = '#3d251b';
        ctx.fillRect(8, -2, 8, 4);
        ctx.restore();
      }
      ctx.fillStyle = PALETTE.inkMuted;
      ctx.font = `bold 10px ${FONT_UI}`;
      ctx.textAlign = 'center';
      ctx.fillText('CHOP BOARD', s.cx, s.y + s.h - 10);
      return;
    }

    if (s.type === STATION_TYPES.WOK) {
      const cooking = Boolean(s.item && s.cookDuration > 0 && s.item.ingredientId !== 'burnt');
      const tossJump = s.tossAnim > 0 ? Math.sin(s.tossAnim * Math.PI) * 8 : 0;

      // 4-prong cast-iron stove grate underneath
      ctx.strokeStyle = '#25292e';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(s.cx - 28, s.cy - 5);
      ctx.lineTo(s.cx + 28, s.cy - 5);
      ctx.moveTo(s.cx, s.cy - 31);
      ctx.lineTo(s.cx, s.cy + 21);
      ctx.stroke();

      // Copper stove control dial on counter front
      ctx.fillStyle = cooking ? '#ff8b3d' : '#c78348';
      ctx.beginPath();
      ctx.arc(s.x + 15, s.y + s.h - 12, 3.8, 0, Math.PI * 2);
      ctx.fill();

      if (cooking) {
        const flicker = 0.72 + 0.28 * Math.sin(time * 22 + s.x);
        ctx.fillStyle = `rgba(255, 118, 45, ${0.48 * flicker})`;
        ctx.beginPath();
        ctx.arc(s.cx, s.cy - 4, 31, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#5bc0ff';
        ctx.lineWidth = 2.2;
        ctx.beginPath();
        ctx.arc(s.cx, s.cy - 4, 26, 0, Math.PI * 2);
        ctx.stroke();
      }

      if (s.tossAnim > 0.08) {
        const flare = Math.sin(s.tossAnim * Math.PI);
        ctx.fillStyle = `rgba(255, 108, 32, ${0.76 * flare})`;
        ctx.beginPath();
        ctx.ellipse(s.cx, s.cy - 14 - tossJump, 28 * flare, 19 * flare, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = `rgba(255, 224, 108, ${0.88 * flare})`;
        ctx.beginPath();
        ctx.ellipse(s.cx, s.cy - 12 - tossJump, 16 * flare, 11 * flare, 0, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.fillStyle = '#1f2328';
      ctx.beginPath();
      ctx.arc(s.cx, s.cy - 5 - tossJump, 24, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = s.wokHei ? '#ffb648' : '#58606b';
      ctx.lineWidth = s.wokHei ? 2.6 : 1.8;
      ctx.stroke();

      ctx.fillStyle = '#7b492e';
      roundRect(ctx, s.cx + 21, s.cy - 9 - tossJump, 18, 7, 3);
      ctx.fill();
      ctx.fillStyle = '#d4dce6';
      ctx.font = `bold 10px ${FONT_UI}`;
      ctx.textAlign = 'center';
      ctx.fillText('IRON WOK', s.cx, s.y + s.h - 10);
      return;
    }

    if (s.type === STATION_TYPES.POT) {
      const cooking = Boolean(s.item && s.cookDuration > 0 && s.item.ingredientId !== 'burnt');
      ctx.fillStyle = cooking ? '#ff8b3d' : '#c78348';
      ctx.beginPath();
      ctx.arc(s.x + 15, s.y + s.h - 12, 3.8, 0, Math.PI * 2);
      ctx.fill();

      // Side pot handles
      ctx.fillStyle = '#6f3b19';
      roundRect(ctx, s.cx - 29, s.cy - 9, 8, 8, 2);
      ctx.fill();
      roundRect(ctx, s.cx + 21, s.cy - 9, 8, 8, 2);
      ctx.fill();

      ctx.fillStyle = '#c5773c';
      ctx.beginPath();
      ctx.arc(s.cx, s.cy - 5, 24, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#6f3b19';
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.fillStyle = cooking ? '#e8902e' : '#b86c28';
      ctx.beginPath();
      ctx.arc(s.cx, s.cy - 5, 19, 0, Math.PI * 2);
      ctx.fill();
      if (cooking) {
        ctx.fillStyle = 'rgba(255, 244, 200, 0.78)';
        const b1 = Math.sin(time * 8 + s.x) * 6;
        ctx.beginPath();
        ctx.arc(s.cx - 6, s.cy - 6 + b1 * 0.4, 3.2, 0, Math.PI * 2);
        ctx.arc(s.cx + 7, s.cy - 3 - b1 * 0.4, 2.7, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = '#e8ecf0';
      ctx.font = `bold 10px ${FONT_UI}`;
      ctx.textAlign = 'center';
      ctx.fillText('BROTH POT', s.cx, s.y + s.h - 10);
      return;
    }

    if (s.type === STATION_TYPES.PLATE_STACK) {
      for (let i = 0; i < 3; i += 1) {
        ctx.fillStyle = '#f8f3eb';
        ctx.beginPath();
        ctx.arc(s.cx, s.cy - 2 - i * 4, 18.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#c4b49c';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
      ctx.fillStyle = PALETTE.ink;
      ctx.font = `bold 10px ${FONT_UI}`;
      ctx.textAlign = 'center';
      ctx.fillText('PLATES', s.cx, s.y + s.h - 10);
      return;
    }

    if (s.type === STATION_TYPES.ASSEMBLY) {
      ctx.strokeStyle = 'rgba(130, 110, 95, 0.38)';
      ctx.setLineDash([4, 3]);
      roundRect(ctx, s.x + 11, s.y + 8, s.w - 22, s.h - 26, 8);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = PALETTE.inkMuted;
      ctx.font = `bold 10px ${FONT_UI}`;
      ctx.textAlign = 'center';
      ctx.fillText('ASSEMBLY', s.cx, s.y + s.h - 10);
      return;
    }

    if (s.type === STATION_TYPES.COUNTER) {
      ctx.fillStyle = 'rgba(255,255,255,0.22)';
      roundRect(ctx, s.x + 10, s.y + 8, s.w - 20, s.h - 26, 6);
      ctx.fill();
      if (s.item && s.item.kind === 'ingredient') {
        ctx.fillStyle = '#f2e8d8';
        roundRect(ctx, s.cx - 21, s.cy - 22, 42, 34, 8);
        ctx.fill();
        ctx.strokeStyle = '#c9b597';
        ctx.lineWidth = 1.2;
        ctx.stroke();
      }
      ctx.fillStyle = PALETTE.inkMuted;
      ctx.font = `bold 10px ${FONT_UI}`;
      ctx.textAlign = 'center';
      ctx.fillText(s.label.toUpperCase(), s.cx, s.y + s.h - 10);
      return;
    }

    if (s.type === STATION_TYPES.SERVE_PASS) {
      ctx.fillStyle = 'rgba(255, 224, 115, 0.42)';
      roundRect(ctx, s.x + 10, s.y + 8, s.w - 20, s.h - 26, 8);
      ctx.fill();
      ctx.strokeStyle = 'rgba(166, 122, 50, 0.45)';
      ctx.lineWidth = 1.2;
      ctx.stroke();
      ctx.fillStyle = '#573911';
      ctx.font = `bold 10px ${FONT_UI}`;
      ctx.textAlign = 'center';
      ctx.fillText('SERVE PASS', s.cx, s.y + s.h - 10);
      return;
    }

    if (s.type === STATION_TYPES.BELL) {
      const ring = s.id === 'serve_bell' ? state.bellAnim : 0;
      const shake = ring > 0 ? Math.sin(ring * 24) * 4 : 0;
      ctx.fillStyle = '#2d1c14';
      roundRect(ctx, s.cx - 18, s.cy - 2, 36, 10, 4);
      ctx.fill();
      ctx.fillStyle = ring > 0 ? '#ffe57a' : PALETTE.brass;
      ctx.beginPath();
      ctx.arc(s.cx + shake, s.cy - 4, 15.5, Math.PI, 0);
      ctx.fill();
      ctx.strokeStyle = '#8b5e18';
      ctx.lineWidth = 1.7;
      ctx.stroke();
      ctx.fillStyle = '#fff5cf';
      ctx.beginPath();
      ctx.arc(s.cx + shake, s.cy - 20, 3.6, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = PALETTE.ink;
      ctx.font = `bold 10px ${FONT_UI}`;
      ctx.textAlign = 'center';
      ctx.fillText('RING BELL', s.cx, s.y + s.h - 10);
      return;
    }

    if (s.type === STATION_TYPES.TRASH) {
      ctx.fillStyle = '#262220';
      roundRect(ctx, s.cx - 18, s.cy - 20, 36, 28, 6);
      ctx.fill();
      ctx.strokeStyle = '#756a64';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = '#e5dbd4';
      ctx.font = `bold 10px ${FONT_UI}`;
      ctx.textAlign = 'center';
      ctx.fillText('TRASH', s.cx, s.y + s.h - 10);
    }
  }

  function drawDishStatusPill(s, state) {
    if (!s.item || s.item.kind !== 'dish') return;
    if (s.item.completedRecipeId) {
      const recipe = RECIPE_BY_ID[s.item.completedRecipeId];
      const isPass = s.type === STATION_TYPES.SERVE_PASS;
      const badgeText = isPass ? 'READY TO SERVE!' : recipe.shortName;
      const badgeW = isPass ? 112 : 94;
      const badgeY = s.y - 21;
      ctx.fillStyle = isPass ? '#1c7c4d' : '#2c7d55';
      roundRect(ctx, s.cx - badgeW / 2, badgeY, badgeW, 19, 7);
      ctx.fill();
      ctx.strokeStyle = '#ffd97d';
      ctx.lineWidth = 1.6;
      ctx.stroke();
      ctx.fillStyle = '#fff9e6';
      ctx.font = `bold 10px ${FONT_UI}`;
      ctx.textAlign = 'center';
      ctx.fillText(badgeText, s.cx, badgeY + 13);
    } else if (s.item.ingredients.length > 0) {
      const targetRecipe = bestPartialRecipe(s.item.ingredients, state.tickets);
      const list = targetRecipe ? targetRecipe.ingredients : s.item.ingredients;
      const heldIng = state.chef.holding?.kind === 'ingredient' ? state.chef.holding.ingredientId : null;
      const pillW = 48 + list.length * 18;
      const pillX = s.cx - pillW / 2;
      const pillY = s.y - 25;
      ctx.fillStyle = 'rgba(28, 20, 17, 0.94)';
      roundRect(ctx, pillX, pillY, pillW, 23, 8);
      ctx.fill();
      ctx.strokeStyle = '#ffb648';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      ctx.fillStyle = '#ffd97d';
      ctx.font = `bold 10px ${FONT_UI}`;
      ctx.textAlign = 'left';
      ctx.fillText(`${s.item.ingredients.length}/${list.length}`, pillX + 8, pillY + 15);

      for (let idx = 0; idx < list.length; idx += 1) {
        const ing = list[idx];
        const has = s.item.ingredients.includes(ing);
        const nextMatchesHeld = !has && heldIng === ing;
        const ix = pillX + 42 + idx * 18;
        const iy = pillY + 11.5;
        ctx.fillStyle = has ? 'rgba(46, 184, 114, 0.44)' : nextMatchesHeld ? 'rgba(255, 217, 125, 0.30)' : 'rgba(255,255,255,0.08)';
        ctx.beginPath();
        ctx.arc(ix, iy, 7.8, 0, Math.PI * 2);
        ctx.fill();
        if (nextMatchesHeld) {
          ctx.strokeStyle = '#ffd97d';
          ctx.lineWidth = 1.2;
          ctx.stroke();
        }
        ctx.globalAlpha = has ? 1 : 0.46;
        drawIngredient(ctx, ing, ix, iy, 12);
        ctx.globalAlpha = 1;
      }
    }
  }

  function drawStation(s, state, time) {
    const isFocused = state.focusedStationId === s.id;
    const isHovered = state.hoveredStationId === s.id;
    const isSuggested = isSuggestedStation(s, state);

    ctx.fillStyle = 'rgba(18, 10, 6, 0.32)';
    roundRect(ctx, s.x + 2, s.y + 6, s.w, s.h, 8);
    ctx.fill();

    const frontColor =
      s.type === STATION_TYPES.WOK || s.type === STATION_TYPES.POT
        ? '#31363d'
        : s.type === STATION_TYPES.SERVE_PASS
          ? '#a67a32'
          : '#84593d';

    ctx.fillStyle = frontColor;
    roundRect(ctx, s.x, s.y + 4, s.w, s.h, 8);
    ctx.fill();

    ctx.fillStyle =
      s.type === STATION_TYPES.ASSEMBLY
        ? marblePattern
        : s.type === STATION_TYPES.WOK || s.type === STATION_TYPES.POT
          ? '#4b525c'
          : s.type === STATION_TYPES.SERVE_PASS
            ? '#f0cf88'
            : s.type === STATION_TYPES.TRASH
              ? '#4a413d'
              : PALETTE.counterTop;
    roundRect(ctx, s.x, s.y, s.w, s.h - 6, 8);
    ctx.fill();

    ctx.strokeStyle = isFocused
      ? '#ffe066'
      : isSuggested
        ? '#69f0ae'
        : isHovered
          ? '#ffb648'
          : 'rgba(42, 26, 18, 0.55)';
    ctx.lineWidth = isFocused ? 3.2 : isSuggested ? 2.4 : isHovered ? 2.4 : 1.4;
    ctx.stroke();

    drawStationHardware(s, state, time);

    if (s.item) {
      const itemY = s.cy - 5 - (s.tossAnim > 0 ? Math.sin(s.tossAnim * Math.PI) * 14 : 0);
      if (s.item.kind === 'dish') {
        const dishScale = s.type === STATION_TYPES.SERVE_PASS || s.type === STATION_TYPES.ASSEMBLY ? 1.24 : 1.08;
        drawDish(ctx, s.item, s.cx, itemY, dishScale, time);
      } else {
        drawIngredient(ctx, s.item.ingredientId, s.cx, itemY, 28, s.item.wokHei);
      }
    }

    if (s.type === STATION_TYPES.BOARD && s.chopFlash > 0) {
      ctx.save();
      ctx.translate(s.cx + 8, s.cy - 8);
      ctx.rotate(-0.65 + Math.sin(s.chopFlash * 28) * 0.45);
      ctx.fillStyle = '#e2e9f0';
      ctx.fillRect(-14, -4, 22, 8);
      ctx.fillStyle = '#3d251b';
      ctx.fillRect(8, -2.5, 9, 5);
      ctx.restore();
    }

    if (s.type === STATION_TYPES.BOARD && s.item && s.chopProgress > 0 && s.chopProgress < 1) {
      roundRect(ctx, s.x + 16, s.y - 12, s.w - 32, 9, 4);
      ctx.fillStyle = '#241914';
      ctx.fill();
      roundRect(ctx, s.x + 17, s.y - 11, (s.w - 34) * s.chopProgress, 7, 3);
      ctx.fillStyle = '#69f0ae';
      ctx.fill();
    }

    if ((s.type === STATION_TYPES.WOK || s.type === STATION_TYPES.POT) && s.item && s.cookDuration > 0 && s.item.ingredientId !== 'burnt') {
      const done = s.cookProgress >= 1;
      const burnRatio = done ? s.burnTimer / (s.type === STATION_TYPES.WOK ? TIMERS.wokBurnAfterReady : TIMERS.potBurnAfterReady) : 0;
      const ringColor = !done ? '#ffb648' : burnRatio > 0.55 ? '#ff4f47' : '#3ee084';
      const ringRatio = done ? Math.max(0.08, 1 - burnRatio) : s.cookProgress;
      drawProgressArc(s.x + s.w - 18, s.y + 18, 11, ringRatio, ringColor);

      if (done) {
        const flash = burnRatio > 0.55 && Math.sin(time * 16) > 0;
        ctx.fillStyle = flash ? '#ff4f47' : '#2eb872';
        roundRect(ctx, s.cx - 24, s.y - 16, 48, 16, 6);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.font = `bold 10px ${FONT_UI}`;
        ctx.textAlign = 'center';
        ctx.fillText(burnRatio > 0.55 ? 'HOT!' : 'DONE', s.cx, s.y - 4);
      }
    }

    drawDishStatusPill(s, state);
  }

  function drawOrderBoard(state, time) {
    ctx.fillStyle = PALETTE.woodDark;
    ctx.fillRect(0, 0, FIELD.width, FIELD.hudHeight);
    ctx.fillStyle = '#6f4b34';
    ctx.fillRect(0, FIELD.hudHeight - 4, FIELD.width, 4);

    ctx.fillStyle = '#a87d44';
    roundRect(ctx, 18, 8, 906, 8, 4);
    ctx.fill();

    // Check which recipe IDs are currently plated and ready on Serve Pass
    const readyPassIds = new Set(
      state.stations
        .filter((st) => st.type === STATION_TYPES.SERVE_PASS && st.item?.completedRecipeId)
        .map((st) => st.item.completedRecipeId),
    );

    const ticketW = 214;
    const ticketH = 112;
    const gap = 12;
    for (let i = 0; i < state.tickets.length; i += 1) {
      const t = state.tickets[i];
      const recipe = RECIPE_BY_ID[t.recipeId];
      const tx = 20 + i * (ticketW + gap);
      const ty = 14 - t.spawnAnim * 16;
      const isReadyOnPass = readyPassIds.has(t.recipeId);

      ctx.fillStyle = 'rgba(0,0,0,0.34)';
      roundRect(ctx, tx + 2, ty + 4, ticketW, ticketH, 8);
      ctx.fill();

      ctx.fillStyle = t.vip ? '#fff4d6' : PALETTE.ticketPaper;
      roundRect(ctx, tx, ty, ticketW, ticketH, 8);
      ctx.fill();
      ctx.strokeStyle = isReadyOnPass ? '#2eb872' : t.vip ? '#e5a324' : PALETTE.ticketBorder;
      ctx.lineWidth = isReadyOnPass ? 3 : t.vip ? 2.5 : 1.5;
      ctx.stroke();

      ctx.fillStyle = t.vip ? '#d98218' : recipe.accent;
      roundRect(ctx, tx + 2, ty + 2, ticketW - 4, 24, 6);
      ctx.fill();

      ctx.fillStyle = '#ffffff';
      ctx.font = `bold 12px ${FONT_UI}`;
      ctx.textAlign = 'left';
      ctx.fillText(`#${t.id} ${recipe.shortName}`, tx + 8, ty + 18);
      ctx.textAlign = 'right';
      ctx.fillText(t.vip ? `VIP $${recipe.basePoints * 2}` : `$${recipe.basePoints}`, tx + ticketW - 8, ty + 18);

      const previewDish = {
        kind: 'dish',
        ingredients: recipe.ingredients,
        completedRecipeId: recipe.id,
      };
      drawDish(ctx, previewDish, tx + 32, ty + 62, 0.94, 0);

      const cols = recipe.ingredients.length;
      for (let k = 0; k < cols; k += 1) {
        const ing = recipe.ingredients[k];
        const ix = tx + 76 + k * 34;
        const iy = ty + 60;
        ctx.fillStyle = '#efe5d6';
        roundRect(ctx, ix - 14, iy - 16, 28, 32, 6);
        ctx.fill();
        ctx.strokeStyle = '#d3c2aa';
        ctx.lineWidth = 1;
        ctx.stroke();
        drawIngredient(ctx, ing, ix, iy - 2, 18);
        ctx.fillStyle = PALETTE.inkMuted;
        ctx.font = `bold 8px ${FONT_UI}`;
        ctx.textAlign = 'center';
        const shortTag = INGREDIENTS[ing].short.split(' ').pop();
        ctx.fillText(shortTag, ix, iy + 13);
      }

      const ratio = Math.max(0, Math.min(1, t.remaining / t.maxTime));
      const barColor = ratio > 0.5 ? '#2eb872' : ratio > 0.25 ? '#f5a623' : '#e04f47';
      const pulse = ratio <= 0.25 && Math.sin(time * 12) > 0 ? 1.0 : 0.92;
      ctx.globalAlpha = pulse;
      roundRect(ctx, tx + 10, ty + ticketH - 17, ticketW - 54, 9, 4);
      ctx.fillStyle = '#e5d9c6';
      ctx.fill();
      roundRect(ctx, tx + 10, ty + ticketH - 17, Math.max(6, (ticketW - 54) * ratio), 9, 4);
      ctx.fillStyle = barColor;
      ctx.fill();
      ctx.globalAlpha = 1;

      ctx.fillStyle = ratio <= 0.25 ? '#b92b24' : PALETTE.ink;
      ctx.font = `bold 11px ${FONT_UI}`;
      ctx.textAlign = 'right';
      ctx.fillText(`${Math.ceil(t.remaining)}s`, tx + ticketW - 10, ty + ticketH - 9);
    }

    for (let i = state.tickets.length; i < TIMERS.maxTickets; i += 1) {
      const tx = 20 + i * (ticketW + gap);
      ctx.strokeStyle = 'rgba(255, 224, 182, 0.16)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([5, 5]);
      roundRect(ctx, tx, 16, ticketW, 108, 8);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    const mode = MODES[state.modeId] ?? MODES.dinner;
    const timerBoxX = 938;
    const urgent = mode.duration > 0 && state.timeLeft <= 20;
    ctx.fillStyle = urgent && Math.sin(time * 10) > 0 ? '#6e201b' : '#3a261d';
    roundRect(ctx, timerBoxX, 14, 148, 108, 10);
    ctx.fill();
    ctx.strokeStyle = urgent ? '#ff6f61' : '#a87d44';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = '#e6cdb1';
    ctx.font = `bold 11px ${FONT_UI}`;
    ctx.textAlign = 'center';
    ctx.fillText(mode.label.toUpperCase(), timerBoxX + 74, 34);

    ctx.fillStyle = urgent ? '#ffd0c7' : '#fff6ea';
    ctx.font = `bold 34px ${FONT_UI}`;
    const clockText = mode.duration > 0 ? formatClock(state.timeLeft) : formatClock(state.elapsed);
    ctx.fillText(clockText, timerBoxX + 74, 74);

    if (mode.maxStrikes > 0) {
      const leftHearts = mode.maxStrikes - state.strikes;
      ctx.font = `bold 13px ${FONT_UI}`;
      ctx.fillStyle = leftHearts <= 1 ? '#ff766b' : '#ffd97d';
      ctx.fillText(`Lives: ${'♥ '.repeat(Math.max(0, leftHearts)).trim() || '0'}`, timerBoxX + 74, 104);
    } else {
      ctx.fillStyle = '#ffd97d';
      ctx.font = `bold 12px ${FONT_UI}`;
      ctx.fillText(`SERVED: ${state.served}`, timerBoxX + 74, 104);
    }

    const scoreBoxX = 1096;
    ctx.fillStyle = state.feverTimer > 0 ? '#4d2b18' : '#3a261d';
    roundRect(ctx, scoreBoxX, 14, 166, 108, 10);
    ctx.fill();
    ctx.strokeStyle = state.feverTimer > 0 ? '#ff9e44' : '#a87d44';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = '#ffd97d';
    ctx.font = `bold 30px ${FONT_UI}`;
    ctx.textAlign = 'left';
    ctx.fillText(`$${state.score}`, scoreBoxX + 12, 50);

    if (state.feverTimer > 0) {
      ctx.fillStyle = '#ff6f3c';
      roundRect(ctx, scoreBoxX + 102, 24, 52, 18, 6);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.font = `bold 10px ${FONT_UI}`;
      ctx.textAlign = 'center';
      ctx.fillText('FEVER!', scoreBoxX + 128, 36);
    }

    ctx.fillStyle = state.combo > 1 ? '#69f0ae' : '#cbb49c';
    ctx.font = `bold 13px ${FONT_UI}`;
    ctx.textAlign = 'left';
    ctx.fillText(`STREAK x${state.combo.toFixed(1)}`, scoreBoxX + 12, 76);

    const btnY = 90;
    const hudBtns = [
      { id: 'toggle_mute', x: scoreBoxX + 10, w: 46, label: state.muted ? 'MUTE' : 'SFX' },
      { id: 'toggle_recipes', x: scoreBoxX + 60, w: 48, label: 'MENU' },
      { id: 'toggle_pause', x: scoreBoxX + 112, w: 44, label: 'PAUSE' },
    ];
    for (const hb of hudBtns) {
      ctx.fillStyle = '#573a2b';
      roundRect(ctx, hb.x, btnY, hb.w, 24, 6);
      ctx.fill();
      ctx.fillStyle = '#fff3e2';
      ctx.font = `bold 10px ${FONT_UI}`;
      ctx.textAlign = 'center';
      ctx.fillText(hb.label, hb.x + hb.w / 2, btnY + 15.5);
      addButton(hb.id, hb.x, btnY, hb.w, 24);
    }
  }

  function drawFooterBar(state) {
    ctx.fillStyle = PALETTE.woodDark;
    ctx.fillRect(0, FIELD.footerY, FIELD.width, FIELD.height - FIELD.footerY);
    ctx.fillStyle = '#6f4b34';
    ctx.fillRect(0, FIELD.footerY, FIELD.width, 3);

    ctx.fillStyle = '#3a261d';
    roundRect(ctx, 18, FIELD.footerY + 10, 424, 48, 8);
    ctx.fill();
    ctx.strokeStyle = '#8b6043';
    ctx.lineWidth = 1.4;
    ctx.stroke();

    let heldLabel = 'Empty Hands';
    if (state.chef.holding) {
      if (state.chef.holding.kind === 'dish') {
        heldLabel = state.chef.holding.completedRecipeId
          ? `Ready: ${RECIPE_BY_ID[state.chef.holding.completedRecipeId].shortName}`
          : `Dish (${state.chef.holding.ingredients.length} items)`;
        drawDish(ctx, state.chef.holding, 44, FIELD.footerY + 34, 0.62, 0);
      } else {
        heldLabel = INGREDIENTS[state.chef.holding.ingredientId]?.name ?? 'Item';
        drawIngredient(ctx, state.chef.holding.ingredientId, 44, FIELD.footerY + 34, 20, state.chef.holding.wokHei);
      }
    }

    ctx.fillStyle = '#ffd97d';
    ctx.font = `bold 13px ${FONT_UI}`;
    ctx.textAlign = 'left';
    ctx.fillText(heldLabel, 68, FIELD.footerY + 29);

    ctx.fillStyle = '#d7c3ae';
    ctx.font = `12px ${FONT_UI}`;
    const focused = state.stations.find((s) => s.id === state.focusedStationId);
    const hint = focused
      ? `[E / Click] ${focused.label}  •  [F] Chop / Toss  •  [R] Recipes`
      : 'WASD / Arrows or Click to move  •  [R] Recipe Book';
    ctx.fillText(hint, 68, FIELD.footerY + 47);

    const rxStart = 454;
    const cardW = 132;
    for (let i = 0; i < RECIPES.length; i += 1) {
      const r = RECIPES[i];
      const rx = rxStart + i * (cardW + 4);
      const ry = FIELD.footerY + 10;
      const isActive = state.tickets.some((t) => t.recipeId === r.id);
      ctx.fillStyle = isActive ? '#4b3226' : '#2e1f18';
      roundRect(ctx, rx, ry, cardW, 48, 7);
      ctx.fill();
      ctx.strokeStyle = isActive ? r.accent : '#5e4234';
      ctx.lineWidth = isActive ? 1.8 : 1;
      ctx.stroke();

      ctx.fillStyle = '#fff5e6';
      ctx.font = `bold 10px ${FONT_UI}`;
      ctx.textAlign = 'left';
      ctx.fillText(r.shortName, rx + 7, ry + 15);

      for (let k = 0; k < r.ingredients.length; k += 1) {
        drawIngredient(ctx, r.ingredients[k], rx + 18 + k * 28, ry + 34, 15);
      }
    }
  }

  function drawHoverTooltip(state) {
    if (!state.hoveredStationId) return;
    const st = state.stations.find((s) => s.id === state.hoveredStationId);
    if (!st) return;
    const tip = STATION_HINTS[st.type];
    if (!tip) return;
    ctx.font = `bold 12px ${FONT_UI}`;
    const label = `${st.label}: ${tip}`;
    const w = ctx.measureText(label).width + 24;
    const tx = Math.max(24, Math.min(FIELD.width - w - 24, st.cx - w / 2));
    const ty = st.y > 260 ? st.y - 36 : st.y + st.h + 10;
    ctx.fillStyle = 'rgba(24, 16, 13, 0.90)';
    roundRect(ctx, tx, ty, w, 24, 6);
    ctx.fill();
    ctx.strokeStyle = '#a87d44';
    ctx.lineWidth = 1.2;
    ctx.stroke();
    ctx.fillStyle = '#fff3e2';
    ctx.textAlign = 'left';
    ctx.fillText(label, tx + 12, ty + 16);
  }

  function drawParticlesAndPopups(state) {
    for (let i = 0; i < state.particles.length; i += 1) {
      const p = state.particles[i];
      ctx.globalAlpha = Math.max(0, Math.min(1, p.life / p.maxLife));
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    for (let i = 0; i < state.popups.length; i += 1) {
      const pop = state.popups[i];
      ctx.globalAlpha = Math.max(0, Math.min(1, pop.life / pop.maxLife));
      ctx.font = `bold 13px ${FONT_UI}`;
      const pw = ctx.measureText(pop.text).width + 18;
      const py = pop.y - i * 4;
      ctx.fillStyle = 'rgba(24, 16, 13, 0.88)';
      roundRect(ctx, pop.x - pw / 2, py - 15, pw, 20, 7);
      ctx.fill();
      ctx.strokeStyle = pop.color;
      ctx.lineWidth = 1.2;
      ctx.stroke();
      ctx.textAlign = 'center';
      ctx.fillStyle = pop.color;
      ctx.fillText(pop.text, pop.x, py - 1);
    }
    ctx.globalAlpha = 1;

    if (state.toast) {
      ctx.save();
      ctx.globalAlpha = Math.min(1, state.toast.timer * 1.4);
      ctx.font = `bold 14px ${FONT_UI}`;
      const tw = Math.max(220, ctx.measureText(state.toast.text).width + 38);
      ctx.fillStyle = 'rgba(26, 17, 13, 0.92)';
      roundRect(ctx, FIELD.width / 2 - tw / 2, 492, tw, 32, 10);
      ctx.fill();
      ctx.strokeStyle = state.toast.color;
      ctx.lineWidth = 1.8;
      ctx.stroke();
      ctx.fillStyle = state.toast.color;
      ctx.textAlign = 'center';
      ctx.fillText(state.toast.text, FIELD.width / 2, 513);
      ctx.restore();
    }
  }

  function drawRecipeGuideOverlay() {
    ctx.fillStyle = 'rgba(18, 12, 9, 0.72)';
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);

    const w = 780;
    const h = 470;
    const x = (FIELD.width - w) / 2;
    const y = (FIELD.height - h) / 2;

    ctx.fillStyle = '#2d1e17';
    roundRect(ctx, x, y, w, h, 18);
    ctx.fill();
    ctx.strokeStyle = PALETTE.brass;
    ctx.lineWidth = 3;
    ctx.stroke();

    ctx.fillStyle = PALETTE.brassBright;
    ctx.font = `bold 32px ${FONT_DISPLAY}`;
    ctx.textAlign = 'center';
    ctx.fillText('Bistro Recipe Book', FIELD.width / 2, y + 48);

    ctx.fillStyle = '#dcc5ae';
    ctx.font = `14px ${FONT_UI}`;
    ctx.fillText('Chop Steak/Shroom/Scallion on Board  •  Sear Steak/Shroom/Egg in Wok  •  Boil Noodles/Soft Egg in Pot', FIELD.width / 2, y + 74);

    for (let i = 0; i < RECIPES.length; i += 1) {
      const r = RECIPES[i];
      const col = i % 2;
      const row = Math.floor(i / 2);
      const rx = x + 32 + col * 366;
      const ry = y + 96 + row * 100;

      ctx.fillStyle = '#221611';
      roundRect(ctx, rx, ry, 348, 86, 10);
      ctx.fill();
      ctx.strokeStyle = r.accent;
      ctx.lineWidth = 1.8;
      ctx.stroke();

      drawDish(ctx, { kind: 'dish', ingredients: r.ingredients, completedRecipeId: r.id }, rx + 42, ry + 43, 1.05, 0);

      ctx.fillStyle = '#fff5e6';
      ctx.font = `bold 15px ${FONT_UI}`;
      ctx.textAlign = 'left';
      ctx.fillText(`${r.name} ($${r.basePoints})`, rx + 82, ry + 26);

      for (let k = 0; k < r.ingredients.length; k += 1) {
        const ing = r.ingredients[k];
        const ix = rx + 96 + k * 62;
        drawIngredient(ctx, ing, ix, ry + 52, 20);
        ctx.fillStyle = '#cbb49c';
        ctx.font = `10px ${FONT_UI}`;
        ctx.textAlign = 'center';
        ctx.fillText(INGREDIENTS[ing].short, ix, ry + 75);
      }
    }

    const bx = FIELD.width / 2 - 110;
    const by = y + 408;
    ctx.fillStyle = '#e0672f';
    roundRect(ctx, bx, by, 220, 44, 10);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = `bold 16px ${FONT_UI}`;
    ctx.textAlign = 'center';
    ctx.fillText('BACK TO KITCHEN [R]', FIELD.width / 2, by + 28);
    addButton('toggle_recipes', bx, by, 220, 44);
  }

  function drawTitleOverlay(state, bestScore) {
    ctx.fillStyle = 'rgba(18, 12, 9, 0.45)';
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);

    const w = 720;
    const h = 490;
    const x = (FIELD.width - w) / 2;
    const y = (FIELD.height - h) / 2;

    ctx.fillStyle = 'rgba(45, 30, 23, 0.96)';
    roundRect(ctx, x, y, w, h, 18);
    ctx.fill();
    ctx.strokeStyle = PALETTE.brass;
    ctx.lineWidth = 3;
    ctx.stroke();

    ctx.fillStyle = PALETTE.brassBright;
    ctx.font = `bold 46px ${FONT_DISPLAY}`;
    ctx.textAlign = 'center';
    ctx.fillText('Ember & Broth', FIELD.width / 2, y + 72);

    ctx.fillStyle = '#e7d4be';
    ctx.font = `17px ${FONT_UI}`;
    ctx.fillText('Chop, sear with Wok-Hei, assemble multi-step orders, and ring the service bell!', FIELD.width / 2, y + 104);

    drawDish(ctx, { kind: 'dish', ingredients: RECIPES[4].ingredients, completedRecipeId: RECIPES[4].id }, FIELD.width / 2 - 220, y + 60, 1.18, state.elapsed);
    drawDish(ctx, { kind: 'dish', ingredients: RECIPES[5].ingredients, completedRecipeId: RECIPES[5].id }, FIELD.width / 2 + 220, y + 60, 1.18, state.elapsed);

    const modeKeys = ['dinner', 'blitz', 'endless'];
    const cardW = 204;
    const cardGap = 18;
    const startX = FIELD.width / 2 - (cardW * 3 + cardGap * 2) / 2;
    for (let i = 0; i < modeKeys.length; i += 1) {
      const m = MODES[modeKeys[i]];
      const cx = startX + i * (cardW + cardGap);
      const cy = y + 136;
      const selected = state.modeId === m.id;
      ctx.fillStyle = selected ? '#573726' : '#3b271e';
      roundRect(ctx, cx, cy, cardW, 108, 12);
      ctx.fill();
      ctx.strokeStyle = selected ? '#ffd97d' : '#7b553d';
      ctx.lineWidth = selected ? 3 : 1.5;
      ctx.stroke();

      ctx.fillStyle = selected ? '#ffd97d' : '#fff5e6';
      ctx.font = `bold 18px ${FONT_UI}`;
      ctx.textAlign = 'center';
      ctx.fillText(m.label, cx + cardW / 2, cy + 36);

      ctx.fillStyle = '#dcc5ae';
      ctx.font = `13px ${FONT_UI}`;
      ctx.fillText(m.subtitle, cx + cardW / 2, cy + 62);

      ctx.fillStyle = selected ? '#69f0ae' : '#9c836e';
      ctx.font = `bold 12px ${FONT_UI}`;
      ctx.fillText(selected ? `SELECTED [${i + 1}]` : `Press ${i + 1} / Click`, cx + cardW / 2, cy + 88);

      addButton(`mode_${m.id}`, cx, cy, cardW, 108);
    }

    ctx.fillStyle = '#221611';
    roundRect(ctx, x + 38, y + 266, w - 76, 98, 12);
    ctx.fill();
    ctx.fillStyle = '#f3dfc9';
    ctx.font = `bold 15px ${FONT_UI}`;
    ctx.fillText('Keyboard + Mouse Controls', FIELD.width / 2, y + 294);
    ctx.fillStyle = '#d4bca4';
    ctx.font = `14px ${FONT_UI}`;
    ctx.fillText('Move: WASD / Arrow Keys (or Click any station)   •   Hold Shift: Sprint', FIELD.width / 2, y + 320);
    ctx.fillText('Interact / Plate / Ring Bell: E, Space, or Click   •   Chop / Wok Toss: F or Right-Click', FIELD.width / 2, y + 344);

    const btnW = 280;
    const btnH = 56;
    const btnX = FIELD.width / 2 - btnW / 2;
    const btnY = y + 388;
    ctx.fillStyle = '#e0672f';
    roundRect(ctx, btnX, btnY, btnW, btnH, 12);
    ctx.fill();
    ctx.strokeStyle = '#ffd97d';
    ctx.lineWidth = 2.5;
    ctx.stroke();

    ctx.fillStyle = '#ffffff';
    ctx.font = `bold 22px ${FONT_UI}`;
    ctx.fillText('START SERVICE', FIELD.width / 2, btnY + 35);
    addButton('start_game', btnX, btnY, btnW, btnH);

    if (bestScore > 0) {
      ctx.fillStyle = '#ffd97d';
      ctx.font = `bold 14px ${FONT_UI}`;
      ctx.fillText(`Best Kitchen Earnings: $${bestScore}`, FIELD.width / 2, y + 468);
    }
  }

  function drawPauseOverlay() {
    ctx.fillStyle = 'rgba(18, 12, 9, 0.7)';
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);

    const w = 440;
    const h = 290;
    const x = (FIELD.width - w) / 2;
    const y = (FIELD.height - h) / 2;

    ctx.fillStyle = '#2d1e17';
    roundRect(ctx, x, y, w, h, 16);
    ctx.fill();
    ctx.strokeStyle = PALETTE.brass;
    ctx.lineWidth = 3;
    ctx.stroke();

    ctx.fillStyle = PALETTE.brassBright;
    ctx.font = `bold 34px ${FONT_DISPLAY}`;
    ctx.textAlign = 'center';
    ctx.fillText('Service Paused', FIELD.width / 2, y + 60);

    const items = [
      { id: 'resume_game', label: 'Resume Service [P]', color: '#2eb872', oy: 96 },
      { id: 'restart_game', label: 'Restart Shift', color: '#d97b29', oy: 156 },
      { id: 'back_title', label: 'Change Mode', color: '#5c4234', oy: 216 },
    ];
    for (const btn of items) {
      const bx = FIELD.width / 2 - 140;
      const by = y + btn.oy;
      ctx.fillStyle = btn.color;
      roundRect(ctx, bx, by, 280, 44, 10);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.font = `bold 17px ${FONT_UI}`;
      ctx.fillText(btn.label, FIELD.width / 2, by + 28);
      addButton(btn.id, bx, by, 280, 44);
    }
  }

  function drawOverOverlay(state, bestScore) {
    ctx.fillStyle = 'rgba(18, 12, 9, 0.65)';
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);

    const w = 560;
    const h = 400;
    const x = (FIELD.width - w) / 2;
    const y = (FIELD.height - h) / 2;

    ctx.fillStyle = 'rgba(45, 30, 23, 0.96)';
    roundRect(ctx, x, y, w, h, 18);
    ctx.fill();
    ctx.strokeStyle = PALETTE.brass;
    ctx.lineWidth = 3;
    ctx.stroke();

    ctx.fillStyle = PALETTE.brassBright;
    ctx.font = `bold 36px ${FONT_DISPLAY}`;
    ctx.textAlign = 'center';
    ctx.fillText('Shift Complete!', FIELD.width / 2, y + 56);

    const stars = state.score >= 850 ? 3 : state.score >= 420 ? 2 : state.score >= 150 ? 1 : 0;
    const rank = stars === 3 ? 'MASTER CHEF (S)' : stars === 2 ? 'SOUS CHEF (A)' : stars === 1 ? 'LINE COOK (B)' : 'APPRENTICE (C)';
    ctx.font = `bold 34px ${FONT_UI}`;
    for (let s = 0; s < 3; s += 1) {
      ctx.fillStyle = s < stars ? '#ffd97d' : '#523b2f';
      ctx.fillText('★', FIELD.width / 2 + (s - 1) * 46, y + 102);
    }

    ctx.fillStyle = '#69f0ae';
    ctx.font = `bold 13px ${FONT_UI}`;
    ctx.fillText(rank, FIELD.width / 2, y + 124);

    ctx.fillStyle = '#221611';
    roundRect(ctx, x + 44, y + 136, w - 88, 150, 12);
    ctx.fill();

    const rows = [
      ['Total Earnings', `$${state.score}`],
      ['Dishes Served', `${state.served}`],
      ['Best Combo Streak', `x${state.bestCombo.toFixed(1)}`],
      ['Wok-Hei Bonuses', `${state.wokHeiServed}`],
      ['Best Record', `$${bestScore}`],
    ];
    for (let i = 0; i < rows.length; i += 1) {
      const ry = y + 164 + i * 26;
      ctx.fillStyle = '#ccb69f';
      ctx.font = `15px ${FONT_UI}`;
      ctx.textAlign = 'left';
      ctx.fillText(rows[i][0], x + 68, ry);
      ctx.fillStyle = i === 0 ? '#69f0ae' : '#fff5e6';
      ctx.font = `bold 16px ${FONT_UI}`;
      ctx.textAlign = 'right';
      ctx.fillText(rows[i][1], x + w - 68, ry);
    }

    const bx1 = FIELD.width / 2 - 200;
    const bx2 = FIELD.width / 2 + 12;
    const by = y + 314;
    ctx.fillStyle = '#e0672f';
    roundRect(ctx, bx1, by, 188, 50, 10);
    ctx.fill();
    ctx.fillStyle = '#5c4234';
    roundRect(ctx, bx2, by, 188, 50, 10);
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.font = `bold 17px ${FONT_UI}`;
    ctx.textAlign = 'center';
    ctx.fillText('PLAY AGAIN [Space]', bx1 + 94, by + 31);
    ctx.fillText('MODES', bx2 + 94, by + 31);
    addButton('restart_game', bx1, by, 188, 50);
    addButton('back_title', bx2, by, 188, 50);
  }

  function draw(state, screen, bestScore) {
    buttons.length = 0;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = PALETTE.bgOuter;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.setTransform(view.scale, 0, 0, view.scale, view.x, view.y);

    drawKitchenFloor(state);
    drawKitchenDecor(ctx, state.elapsed, state.feverTimer > 0);
    for (let i = 0; i < state.stations.length; i += 1) {
      drawStation(state.stations[i], state, state.elapsed);
    }
    drawChef(ctx, state.chef, state.elapsed);
    drawParticlesAndPopups(state);
    drawOrderBoard(state, state.elapsed);
    drawFooterBar(state);

    if (screen === SCREEN_PLAY && !state.showRecipes) {
      drawHoverTooltip(state);
    }

    if (state.showRecipes && screen === SCREEN_PLAY) drawRecipeGuideOverlay();
    else if (screen === SCREEN_TITLE) drawTitleOverlay(state, bestScore);
    else if (screen === SCREEN_PAUSED) drawPauseOverlay();
    else if (screen === SCREEN_OVER) drawOverOverlay(state, bestScore);
  }

  return { draw, hitButton };
}
