// Core simulation for Ember & Broth: movement, collisions, chopping, wok searing, simmering,
// dish assembly, serving, timers, combos, particles, and discrete feedback events.

import { CHEF, MODES, TIMERS } from './config.js';
import {
  STATION_TYPES,
  createKitchenStations,
  findApproachPoint,
  findFocusedStation,
  findStationAtPoint,
  resolveChefCollisions,
} from './kitchen.js';
import { createOrderManager } from './orders.js';
import {
  CHOP_RESULTS,
  INGREDIENTS,
  RECIPE_BY_ID,
  completedRecipeFor,
  matchingCandidateRecipes,
} from './recipes.js';

export const EVENT_PICKUP = 1;
export const EVENT_PLACE = 2;
export const EVENT_CHOP = 4;
export const EVENT_CHOP_DONE = 8;
export const EVENT_COOK_START = 16;
export const EVENT_WOK_TOSS = 32;
export const EVENT_PLATE = 64;
export const EVENT_DISH_READY = 128;
export const EVENT_SERVED = 256;
export const EVENT_WARN = 512;
export const EVENT_SHIFT_END = 1024;

function makeIngredientItem(ingredientId, wokHei = false) {
  return { kind: 'ingredient', ingredientId, wokHei };
}

function makeDishItem(ingredients = [], wokHeiCount = 0) {
  const completed = completedRecipeFor(ingredients);
  return {
    kind: 'dish',
    ingredients: [...ingredients],
    wokHeiCount,
    completedRecipeId: completed ? completed.id : null,
  };
}

export function createWorld(random) {
  const orderMgr = createOrderManager(random);

  const state = {
    modeId: 'dinner',
    elapsed: 0,
    timeLeft: MODES.dinner.duration,
    score: 0,
    served: 0,
    missed: 0,
    strikes: 0,
    combo: 1,
    bestCombo: 1,
    comboTimer: 0,
    feverTimer: 0,
    wokHeiServed: 0,
    spawnTimer: 2,
    tickets: [],
    stations: createKitchenStations(),
    chef: {
      x: 560,
      y: 312,
      angle: 0,
      walkCycle: 0,
      moving: false,
      holding: null,
      targetPoint: null,
      waypoints: [],
      pendingStationId: null,
      pendingWork: false,
      chopCooldown: 0,
      chopPose: 0,
    },
    focusedStationId: null,
    hoveredStationId: null,
    particles: [],
    popups: [],
    bellAnim: 0,
    toast: null,
    lastNotice: '',
    showRecipes: false,
  };

  function modeConfig() {
    return MODES[state.modeId] ?? MODES.dinner;
  }

  function showToast(text, color = '#ffd97d') {
    state.toast = { text, color, timer: 1.6 };
    state.lastNotice = text;
  }

  function spawnParticles(x, y, color, count, speed = 70, rise = -45) {
    for (let i = 0; i < count; i += 1) {
      if (state.particles.length >= 160) state.particles.shift();
      const ang = random() * Math.PI * 2;
      const mag = (0.35 + random() * 0.65) * speed;
      state.particles.push({
        x,
        y,
        vx: Math.cos(ang) * mag,
        vy: Math.sin(ang) * mag + rise,
        life: 0.45 + random() * 0.4,
        maxLife: 0.85,
        size: 2.8 + random() * 3.5,
        color,
      });
    }
  }

  function addPopup(x, y, text, color = '#ffd97d') {
    if (state.popups.length >= 16) state.popups.shift();
    state.popups.push({ x, y, text, color, life: 1.35, maxLife: 1.35 });
  }

  function reset(modeId = state.modeId) {
    state.modeId = MODES[modeId] ? modeId : 'dinner';
    const mode = modeConfig();
    orderMgr.resetCounter();

    state.elapsed = 0;
    state.timeLeft = mode.duration;
    state.score = 0;
    state.served = 0;
    state.missed = 0;
    state.strikes = 0;
    state.combo = 1;
    state.bestCombo = 1;
    state.comboTimer = 0;
    state.feverTimer = 0;
    state.tickets = [];
    state.wokHeiServed = 0;
    state.stations = createKitchenStations();
    state.particles = [];
    state.popups = [];
    state.bellAnim = 0;
    state.toast = null;
    state.lastNotice = '';
    state.showRecipes = false;

    state.chef.x = 560;
    state.chef.y = 310;
    state.chef.angle = Math.PI / 2;
    state.chef.walkCycle = 0;
    state.chef.moving = false;
    state.chef.holding = null;
    state.chef.targetPoint = null;
    state.chef.waypoints = [];
    state.chef.pendingStationId = null;
    state.chef.pendingWork = false;
    state.chef.chopCooldown = 0;
    state.chef.chopPose = 0;

    // Seed initial prep items on the bottom herb/spice counters so ingredients visibly rest on counters from frame 1.
    const counterLeft = state.stations.find((s) => s.id === 'counter_prep_left');
    const herbCounter = state.stations.find((s) => s.id === 'counter_bottom_1');
    if (counterLeft) counterLeft.item = makeIngredientItem('scallion_raw');
    if (herbCounter) herbCounter.item = makeIngredientItem('mushroom_raw');

    for (let i = 0; i < mode.initialTickets; i += 1) {
      orderMgr.spawnTicket(state, mode, 0);
    }
    state.spawnTimer = mode.spawnInterval * 0.75;
    const focused = findFocusedStation(state.chef, state.stations);
    state.focusedStationId = focused ? focused.id : null;
  }

  function clearStationProgress(station) {
    station.cookProgress = 0;
    station.cookDuration = 0;
    station.burnTimer = 0;
    station.chopProgress = 0;
    station.wokHei = false;
  }

  function tryAddIngredientToDish(dish, item) {
    if (!dish || dish.kind !== 'dish' || !item || item.kind !== 'ingredient') return { ok: false, reason: 'Invalid item' };
    const def = INGREDIENTS[item.ingredientId];
    if (!def || !def.ready) return { ok: false, reason: 'Cook or chop first!' };
    if (dish.ingredients.includes(item.ingredientId)) return { ok: false, reason: 'Already in dish' };

    const candidates = matchingCandidateRecipes(dish.ingredients, item.ingredientId);
    if (candidates.length === 0) return { ok: false, reason: 'Does not match recipe' };

    dish.ingredients.push(item.ingredientId);
    if (item.wokHei) dish.wokHeiCount += 1;
    const done = completedRecipeFor(dish.ingredients);
    dish.completedRecipeId = done ? done.id : null;
    return { ok: true, completed: done };
  }

  function serveAllReady(heldDishToo) {
    let servedCount = 0;
    let totalPayout = 0;

    if (heldDishToo && state.chef.holding?.kind === 'dish' && state.chef.holding.completedRecipeId) {
      const res = orderMgr.serveDish(state, state.chef.holding);
      if (res) {
        const bell = state.stations.find((s) => s.type === STATION_TYPES.BELL);
        state.chef.holding = null;
        servedCount += 1;
        totalPayout += res.payout;
        if (bell) {
          spawnParticles(bell.cx, bell.cy - 10, '#ffd97d', 20, 120, -60);
          addPopup(bell.cx - 40, bell.cy - 22, `+$${res.payout} ${res.combo > 1 ? `x${res.combo}` : ''}`, '#ffd97d');
        }
      }
    }

    for (const s of state.stations) {
      if (s.type !== STATION_TYPES.SERVE_PASS || !s.item || s.item.kind !== 'dish' || !s.item.completedRecipeId) continue;
      const res = orderMgr.serveDish(state, s.item);
      if (res) {
        s.item = null;
        servedCount += 1;
        totalPayout += res.payout;
        spawnParticles(s.cx, s.cy, '#ffd97d', 22, 120, -60);
        addPopup(s.cx - 34, s.cy - 18, `+$${res.payout}!`, '#69f0ae');
      }
    }

    if (servedCount > 0) {
      state.bellAnim = 1;
      if (servedCount >= 2) {
        const multiBonus = servedCount * 25;
        state.score += multiBonus;
        totalPayout += multiBonus;
        addPopup(1060, 445, `DOUBLE SERVICE +$${multiBonus}!`, '#ffd97d');
      }
      if (state.combo >= 2.5 && state.feverTimer <= 0) {
        state.feverTimer = 14;
        addPopup(640, 290, 'RUSH FEVER! +25% TIPS', '#ff9e44');
      }
      showToast(`Served ${servedCount} dish${servedCount > 1 ? 'es' : ''}! +$${totalPayout}`, '#69f0ae');
      if (state.tickets.length === 0) {
        state.spawnTimer = Math.min(state.spawnTimer, TIMERS.orderSpawnGrace);
      }
      return EVENT_SERVED;
    }

    state.bellAnim = 0.6;
    showToast('Place a finished dish on the Pass to serve!', '#ffb648');
    return EVENT_WARN;
  }

  function doWorkOnStation(station) {
    if (!station || !station.item || station.item.kind !== 'ingredient') return 0;
    const ingId = station.item.ingredientId;
    const def = INGREDIENTS[ingId];

    if (station.type === STATION_TYPES.BOARD && def?.choppable) {
      if (state.chef.chopCooldown > 0) return 0;
      state.chef.chopCooldown = 0.18;
      state.chef.chopPose = 0.2;
      station.chopProgress = Math.min(1, station.chopProgress + 1 / TIMERS.chopTapsNeeded);
      station.chopFlash = 0.25;
      spawnParticles(station.cx, station.cy - 6, def.accent, 6, 65, -45);
      if (station.chopProgress >= 1) {
        const resultId = CHOP_RESULTS[ingId];
        station.item = makeIngredientItem(resultId);
        station.chopProgress = 0;
        spawnParticles(station.cx, station.cy - 8, '#fff2b2', 12, 85, -55);
        addPopup(station.cx, station.cy - 26, INGREDIENTS[resultId].short, '#9ef0a2');
        return EVENT_CHOP_DONE;
      }
      return EVENT_CHOP;
    }

    if (station.type === STATION_TYPES.WOK && station.cookDuration > 0 && ingId !== 'burnt') {
      if (state.chef.chopCooldown > 0) return 0;
      state.chef.chopCooldown = 0.26;
      station.tossAnim = 1;
      station.cookProgress = Math.min(1, station.cookProgress + 0.16);
      if (station.cookProgress >= 0.45 && !station.wokHei) {
        station.wokHei = true;
        station.item.wokHei = true;
        addPopup(station.cx, station.cy - 32, 'WOK HEI +$15!', '#ff9e44');
      }
      spawnParticles(station.cx, station.cy - 10, '#ff8e3c', 12, 95, -75);
      return EVENT_WOK_TOSS;
    }

    if (station.type === STATION_TYPES.POT && station.cookDuration > 0 && ingId !== 'burnt') {
      if (state.chef.chopCooldown > 0) return 0;
      state.chef.chopCooldown = 0.26;
      station.tossAnim = 0.7;
      station.cookProgress = Math.min(1, station.cookProgress + 0.14);
      spawnParticles(station.cx, station.cy - 12, '#ffe8b8', 7, 50, -65);
      return EVENT_CHOP;
    }

    return 0;
  }

  function interactWithStation(station, isWork = false) {
    if (!station) return 0;
    const chef = state.chef;
    chef.angle = Math.atan2(station.cy - chef.y, station.cx - chef.x);

    if (isWork) {
      const workEvt = doWorkOnStation(station);
      if (workEvt) return workEvt;
    }

    const held = chef.holding;
    const item = station.item;

    // 1. Pantry crate: grab ingredient (or scoop steamed rice straight onto held dish).
    if (station.type === STATION_TYPES.PANTRY) {
      if (!held) {
        chef.holding = makeIngredientItem(station.ingredient);
        spawnParticles(station.cx, station.cy, INGREDIENTS[station.ingredient].accent, 6, 50, -35);
        return EVENT_PICKUP;
      }
      if (held.kind === 'dish' && INGREDIENTS[station.ingredient]?.ready) {
        const res = tryAddIngredientToDish(held, makeIngredientItem(station.ingredient));
        if (res.ok) {
          spawnParticles(chef.x, chef.y - 16, '#fff3c4', 10, 70, -50);
          if (res.completed) addPopup(chef.x, chef.y - 36, `${res.completed.shortName} Ready!`, '#69f0ae');
          return res.completed ? EVENT_DISH_READY : EVENT_PLATE;
        }
        showToast(res.reason, '#ff8a7a');
        return EVENT_WARN;
      }
      if (held.kind === 'ingredient' && held.ingredientId === station.ingredient) {
        chef.holding = null;
        return EVENT_PLACE;
      }
      showToast('Set down held item first!', '#ffb648');
      return EVENT_WARN;
    }

    // 2. Plate & Bowl Stack: pick up a clean vessel, or auto-plate a ready ingredient in hand.
    if (station.type === STATION_TYPES.PLATE_STACK) {
      if (!held) {
        chef.holding = makeDishItem();
        return EVENT_PICKUP;
      }
      if (held.kind === 'dish' && held.ingredients.length === 0) {
        chef.holding = null;
        return EVENT_PLACE;
      }
      if (held.kind === 'ingredient' && INGREDIENTS[held.ingredientId]?.ready) {
        const freshDish = makeDishItem();
        const res = tryAddIngredientToDish(freshDish, held);
        if (res.ok) {
          chef.holding = freshDish;
          spawnParticles(station.cx, station.cy, '#ffffff', 9, 65, -45);
          return EVENT_PLATE;
        }
      }
      showToast('Put down current item first', '#ffb648');
      return EVENT_WARN;
    }

    // 3. Cutting Board: place choppable ingredient, chop if raw & empty hands, or pick up/plate finished chop.
    if (station.type === STATION_TYPES.BOARD) {
      if (!item) {
        if (held && held.kind === 'ingredient' && INGREDIENTS[held.ingredientId]?.choppable) {
          station.item = held;
          chef.holding = null;
          clearStationProgress(station);
          return EVENT_PLACE;
        }
        if (held && held.kind === 'ingredient') showToast('Already prepped — sear or plate it!', '#ffb648');
        else showToast('Bring Steak, Mushroom, or Scallion to chop', '#d7be9e');
        return EVENT_WARN;
      }

      if (item.kind === 'ingredient' && INGREDIENTS[item.ingredientId]?.choppable) {
        if (!held) {
          return doWorkOnStation(station);
        }
        showToast('Empty hands or press F to chop!', '#ffb648');
        return EVENT_WARN;
      }

      // Finished chopped item sitting on board.
      if (!held) {
        chef.holding = item;
        station.item = null;
        clearStationProgress(station);
        return EVENT_PICKUP;
      }
      if (held.kind === 'dish') {
        const res = tryAddIngredientToDish(held, item);
        if (res.ok) {
          station.item = null;
          clearStationProgress(station);
          spawnParticles(station.cx, station.cy, '#fff3c4', 10, 75, -50);
          if (res.completed) addPopup(chef.x, chef.y - 36, `${res.completed.shortName} Ready!`, '#69f0ae');
          return res.completed ? EVENT_DISH_READY : EVENT_PLATE;
        }
        showToast(res.reason, '#ff8a7a');
        return EVENT_WARN;
      }
      return EVENT_WARN;
    }

    // 4. Gas Wok & Broth Simmer Pot
    if (station.type === STATION_TYPES.WOK || station.type === STATION_TYPES.POT) {
      const isWok = station.type === STATION_TYPES.WOK;
      if (!item) {
        if (!held || held.kind !== 'ingredient') {
          showToast(isWok ? 'Add sliced steak, mushroom, or egg' : 'Add noodles or egg to simmer', '#d7be9e');
          return EVENT_WARN;
        }
        const def = INGREDIENTS[held.ingredientId];
        const duration = isWok ? def?.searTime : def?.boilTime;
        if (!duration) {
          showToast(
            def?.choppable ? 'Chop on cutting board first!' : isWok ? 'Use Broth Pot for noodles!' : 'Use Iron Wok to sear!',
            '#ff8a7a',
          );
          return EVENT_WARN;
        }
        station.item = held;
        chef.holding = null;
        station.cookProgress = 0;
        station.cookDuration = duration;
        station.burnTimer = 0;
        station.wokHei = false;
        spawnParticles(station.cx, station.cy - 6, isWok ? '#ff8e3c' : '#ffe8b8', 8, 60, -50);
        return EVENT_COOK_START;
      }

      // Still cooking -> tossing/stirring!
      if (station.cookProgress < 1 && item.ingredientId !== 'burnt') {
        return doWorkOnStation(station);
      }

      // Done cooking or burnt!
      if (!held) {
        chef.holding = item;
        station.item = null;
        clearStationProgress(station);
        return EVENT_PICKUP;
      }
      if (held.kind === 'dish' && item.ingredientId !== 'burnt') {
        const res = tryAddIngredientToDish(held, item);
        if (res.ok) {
          station.item = null;
          clearStationProgress(station);
          spawnParticles(station.cx, station.cy, '#fff3c4', 12, 80, -55);
          if (res.completed) addPopup(chef.x, chef.y - 36, `${res.completed.shortName} Ready!`, '#69f0ae');
          return res.completed ? EVENT_DISH_READY : EVENT_PLATE;
        }
        showToast(res.reason, '#ff8a7a');
        return EVENT_WARN;
      }
      return EVENT_WARN;
    }

    // 5. Assembly & Prep Counters: place, pick up, or assemble ingredients into a dish!
    if (station.type === STATION_TYPES.ASSEMBLY || station.type === STATION_TYPES.COUNTER) {
      if (!item && held) {
        station.item = held;
        chef.holding = null;
        return EVENT_PLACE;
      }
      if (item && !held) {
        chef.holding = item;
        station.item = null;
        return EVENT_PICKUP;
      }
      if (item && held) {
        if (item.kind === 'dish' && held.kind === 'ingredient') {
          const res = tryAddIngredientToDish(item, held);
          if (res.ok) {
            chef.holding = null;
            spawnParticles(station.cx, station.cy - 8, '#fff2b2', 12, 80, -55);
            if (res.completed) {
              addPopup(station.cx, station.cy - 34, `${res.completed.shortName} READY!`, '#69f0ae');
              showToast(`${res.completed.name} ready — take to Serve Pass!`, '#69f0ae');
              return EVENT_DISH_READY;
            }
            return EVENT_PLATE;
          }
          showToast(res.reason, '#ff8a7a');
          return EVENT_WARN;
        }
        if (held.kind === 'dish' && item.kind === 'ingredient') {
          const res = tryAddIngredientToDish(held, item);
          if (res.ok) {
            station.item = null;
            spawnParticles(station.cx, station.cy - 8, '#fff2b2', 12, 80, -55);
            if (res.completed) {
              addPopup(chef.x, chef.y - 36, `${res.completed.shortName} READY!`, '#69f0ae');
              return EVENT_DISH_READY;
            }
            return EVENT_PLATE;
          }
          showToast(res.reason, '#ff8a7a');
          return EVENT_WARN;
        }
        showToast('Station occupied', '#ffb648');
        return EVENT_WARN;
      }
      return 0;
    }

    // 6. Serve Pass: park finished dish ready to serve, or click/interact again to ring & serve!
    if (station.type === STATION_TYPES.SERVE_PASS) {
      if (!item && held) {
        if (held.kind === 'dish' && held.completedRecipeId) {
          station.item = held;
          chef.holding = null;
          spawnParticles(station.cx, station.cy, '#ffd97d', 12, 75, -50);
          const recipeName = RECIPE_BY_ID[station.item.completedRecipeId]?.shortName ?? 'Dish';
          showToast(`${recipeName} on Pass — ring Bell or click to serve!`, '#ffd97d');
          return EVENT_DISH_READY;
        }
        showToast('Finish plating all ingredients before serving!', '#ff8a7a');
        return EVENT_WARN;
      }
      if (item && item.kind === 'dish' && item.completedRecipeId) {
        return serveAllReady(true);
      }
      return 0;
    }

    // 7. Brass Service Bell
    if (station.type === STATION_TYPES.BELL) {
      return serveAllReady(true);
    }

    // 8. Compost / Trash Bin
    if (station.type === STATION_TYPES.TRASH) {
      if (held) {
        chef.holding = null;
        spawnParticles(station.cx, station.cy - 6, '#9ca3af', 10, 60, -45);
        showToast('Discarded item', '#d7be9e');
        return EVENT_PLACE;
      }
      return 0;
    }

    return 0;
  }

  function stepStations(dt) {
    let events = 0;
    for (let i = 0; i < state.stations.length; i += 1) {
      const s = state.stations[i];
      if (s.chopFlash > 0) s.chopFlash = Math.max(0, s.chopFlash - dt);
      if (s.tossAnim > 0) s.tossAnim = Math.max(0, s.tossAnim - dt * 2.6);

      if ((s.type === STATION_TYPES.WOK || s.type === STATION_TYPES.POT) && s.item && s.cookDuration > 0) {
        const ingId = s.item.ingredientId;
        if (ingId === 'burnt') continue;
        const isWok = s.type === STATION_TYPES.WOK;
        if (s.cookProgress < 1) {
          s.cookProgress = Math.min(1, s.cookProgress + dt / s.cookDuration);
          if (random() < dt * (isWok ? 9 : 6)) {
            spawnParticles(s.cx + (random() - 0.5) * 28, s.cy - 8, isWok ? '#ff9f43' : '#fff5e0', 1, 22, -45);
          }
          if (s.cookProgress >= 1) {
            const def = INGREDIENTS[ingId];
            const nextId = isWok ? def.searResult : def.boilResult;
            s.item = makeIngredientItem(nextId, s.wokHei);
            spawnParticles(s.cx, s.cy - 10, '#ffe885', 10, 75, -55);
            addPopup(s.cx, s.cy - 28, `${INGREDIENTS[nextId].short} Done!`, '#ffd97d');
            events |= EVENT_DISH_READY;
          }
        } else {
          // Overcook / burn timer once cooked.
          const burnCap = isWok ? TIMERS.wokBurnAfterReady : TIMERS.potBurnAfterReady;
          s.burnTimer += dt;
          if (s.burnTimer > burnCap * 0.55 && random() < dt * 8) {
            spawnParticles(s.cx + (random() - 0.5) * 24, s.cy - 14, '#594b45', 1, 18, -55);
          }
          if (s.burnTimer >= burnCap) {
            s.item = makeIngredientItem('burnt');
            s.burnTimer = 0;
            s.cookDuration = 0;
            spawnParticles(s.cx, s.cy - 10, '#2b2421', 16, 85, -60);
            addPopup(s.cx, s.cy - 28, 'BURNT!', '#ff6b6b');
            events |= EVENT_WARN;
          }
        }
      }
    }
    return events;
  }

  function stepParticlesAndPopups(dt) {
    for (let i = state.particles.length - 1; i >= 0; i -= 1) {
      const p = state.particles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 90 * dt;
      p.life -= dt;
      if (p.life <= 0) state.particles.splice(i, 1);
    }
    for (let i = state.popups.length - 1; i >= 0; i -= 1) {
      const pop = state.popups[i];
      pop.y -= 26 * dt;
      pop.life -= dt;
      if (pop.life <= 0) state.popups.splice(i, 1);
    }
    if (state.toast) {
      state.toast.timer -= dt;
      if (state.toast.timer <= 0) state.toast = null;
    }
    if (state.bellAnim > 0) state.bellAnim = Math.max(0, state.bellAnim - dt * 2.8);
  }

  function buildWalkPath(fromX, fromY, dest) {
    const pts = [];
    const crossesIslandY = (fromY < 365 && dest.y > 468) || (fromY > 468 && dest.y < 365);
    const midX = (fromX + dest.x) * 0.5;
    if (crossesIslandY && midX > 345 && midX < 870) {
      const sideX = midX < 605 ? 340 : 876;
      pts.push({ x: sideX, y: fromY < 365 ? 315 : 495 });
      pts.push({ x: sideX, y: dest.y > 468 ? 495 : 315 });
    } else if (fromY > 360 && dest.y > 360 && Math.abs(dest.x - fromX) > 180 && ((fromX < 380 && dest.x > 380) || (fromX > 830 && dest.x < 830) || (fromX > 360 && fromX < 850))) {
      const laneX1 = fromX < 605 ? 340 : 876;
      const laneX2 = dest.x < 605 ? 340 : 876;
      pts.push({ x: laneX1, y: 315 });
      if (laneX2 !== laneX1) pts.push({ x: laneX2, y: 315 });
    }
    pts.push(dest);
    return pts;
  }

  function queueClickAt(px, py, isRightClick = false) {
    const clickedStation = findStationAtPoint(px, py, state.stations);
    const chef = state.chef;
    if (clickedStation) {
      // If already in interaction range, interact immediately without jarring micro-step!
      const clampedX = Math.max(clickedStation.x, Math.min(chef.x, clickedStation.x + clickedStation.w));
      const clampedY = Math.max(clickedStation.y, Math.min(chef.y, clickedStation.y + clickedStation.h));
      if (Math.hypot(chef.x - clampedX, chef.y - clampedY) <= CHEF.interactRange) {
        chef.targetPoint = null;
        chef.waypoints = [];
        chef.pendingStationId = null;
        return interactWithStation(clickedStation, isRightClick);
      }
      const dest = findApproachPoint(clickedStation, chef.x, chef.y, state.stations);
      const path = buildWalkPath(chef.x, chef.y, dest);
      chef.targetPoint = path.shift();
      chef.waypoints = path;
      chef.pendingStationId = clickedStation.id;
      chef.pendingWork = isRightClick;
      return 0;
    }

    // Clicked open kitchen floor: walk there smoothly.
    if (py >= 144 && py <= 648) {
      const path = buildWalkPath(chef.x, chef.y, { x: px, y: py });
      chef.targetPoint = path.shift();
      chef.waypoints = path;
      chef.pendingStationId = null;
      chef.pendingWork = false;
    }
    return 0;
  }

  /**
   * Advance simulation one fixed step `dt`.
   * @param {number} dt
   * @param {{ dx: number, dy: number, sprint: boolean, working: boolean, primaryPressed: boolean, workPressed: boolean, discardPressed: boolean, pointerX?: number, pointerY?: number }} ctrl
   * @param {boolean} [harmless]
   */
  function step(dt, ctrl, harmless = false) {
    let events = 0;
    const mode = modeConfig();
    const chef = state.chef;

    if (chef.chopCooldown > 0) chef.chopCooldown = Math.max(0, chef.chopCooldown - dt);
    if (chef.chopPose > 0) chef.chopPose = Math.max(0, chef.chopPose - dt);

    if (harmless) {
      // Gentle ambient motion for the title backdrop.
      state.elapsed += dt;
      events |= stepStations(dt);
      stepParticlesAndPopups(dt);
      return events;
    }

    state.elapsed += dt;
    if (mode.duration > 0) {
      state.timeLeft = Math.max(0, state.timeLeft - dt);
      if (state.timeLeft <= 0) {
        events |= EVENT_SHIFT_END;
        return events;
      }
    }

    // Combo & Rush Fever decay
    if (state.feverTimer > 0) {
      state.feverTimer = Math.max(0, state.feverTimer - dt);
    }
    if (state.combo > 1) {
      state.comboTimer -= dt;
      if (state.comboTimer <= 0) {
        state.combo = 1;
        state.comboTimer = 0;
        state.feverTimer = 0;
      }
    }

    // Movement: keyboard cancels click auto-walk.
    let mx = ctrl.dx;
    let my = ctrl.dy;
    if (mx !== 0 || my !== 0) {
      chef.targetPoint = null;
      chef.waypoints = [];
      chef.pendingStationId = null;
      const len = Math.hypot(mx, my);
      mx /= len;
      my /= len;
    } else if (chef.targetPoint) {
      const tx = chef.targetPoint.x - chef.x;
      const ty = chef.targetPoint.y - chef.y;
      const dist = Math.hypot(tx, ty);
      if (dist <= 10) {
        if (chef.waypoints && chef.waypoints.length > 0) {
          chef.targetPoint = chef.waypoints.shift();
        } else {
          chef.targetPoint = null;
          if (chef.pendingStationId) {
            const targetStation = state.stations.find((s) => s.id === chef.pendingStationId);
            const workFlag = chef.pendingWork;
            chef.pendingStationId = null;
            chef.pendingWork = false;
            if (targetStation) events |= interactWithStation(targetStation, workFlag);
          }
        }
      } else {
        mx = tx / dist;
        my = ty / dist;
      }
    }

    if (mx !== 0 || my !== 0) {
      const speed = CHEF.speed * (ctrl.sprint ? CHEF.sprintMultiplier : 1);
      const nextPos = resolveChefCollisions(chef.x + mx * speed * dt, chef.y + my * speed * dt, state.stations);
      chef.x = nextPos.x;
      chef.y = nextPos.y;
      chef.angle = Math.atan2(my, mx);
      chef.moving = true;
      chef.walkCycle += dt * 11;
    } else {
      chef.moving = false;
    }

    // Update focused and hovered stations.
    const focused = findFocusedStation(chef, state.stations);
    state.focusedStationId = focused ? focused.id : null;
    if (typeof ctrl.pointerX === 'number' && typeof ctrl.pointerY === 'number') {
      const hovered = findStationAtPoint(ctrl.pointerX, ctrl.pointerY, state.stations);
      state.hoveredStationId = hovered ? hovered.id : null;
    }

    // Keyboard interactions
    if (ctrl.primaryPressed && focused) {
      events |= interactWithStation(focused, false);
    } else if (ctrl.workPressed && focused) {
      events |= interactWithStation(focused, true);
    } else if (ctrl.working && focused && !chef.moving) {
      // Continuous hold on F or mouse button chops smoothly with animated knife + audio!
      if (focused.type === STATION_TYPES.BOARD && focused.item?.kind === 'ingredient' && INGREDIENTS[focused.item.ingredientId]?.choppable) {
        focused.chopProgress = Math.min(1, focused.chopProgress + dt * 1.15);
        focused.chopFlash = 0.16;
        chef.chopPose = 0.14;
        if (chef.chopCooldown <= 0) {
          chef.chopCooldown = 0.22;
          events |= EVENT_CHOP;
        }
        if (random() < dt * 10) spawnParticles(focused.cx, focused.cy - 6, INGREDIENTS[focused.item.ingredientId].accent, 2, 50, -40);
        if (focused.chopProgress >= 1) {
          const resId = CHOP_RESULTS[focused.item.ingredientId];
          focused.item = makeIngredientItem(resId);
          focused.chopProgress = 0;
          spawnParticles(focused.cx, focused.cy - 8, '#fff2b2', 12, 85, -55);
          addPopup(focused.cx, focused.cy - 26, INGREDIENTS[resId].short, '#9ef0a2');
          events |= EVENT_CHOP_DONE;
        }
      }
    }

    if (ctrl.discardPressed) {
      if (chef.holding) {
        chef.holding = null;
        spawnParticles(chef.x, chef.y, '#9ca3af', 8, 55, -40);
        showToast('Cleared hands', '#d7be9e');
        events |= EVENT_PLACE;
      } else if (focused && focused.item && (focused.type === STATION_TYPES.WOK || focused.type === STATION_TYPES.POT || focused.type === STATION_TYPES.BOARD || focused.type === STATION_TYPES.COUNTER || focused.type === STATION_TYPES.ASSEMBLY)) {
        if (focused.item.kind === 'ingredient' && focused.item.ingredientId === 'burnt') {
          focused.item = null;
          clearStationProgress(focused);
          spawnParticles(focused.cx, focused.cy, '#9ca3af', 8, 55, -40);
          events |= EVENT_PLACE;
        }
      }
    }

    // Stations & Orders
    events |= stepStations(dt);

    const expired = orderMgr.stepTickets(state, dt, mode);
    if (expired > 0) {
      showToast('An order timed out!', '#ff6b6b');
      events |= EVENT_WARN;
      if (mode.maxStrikes > 0 && state.strikes >= mode.maxStrikes) {
        events |= EVENT_SHIFT_END;
        return events;
      }
    }

    state.spawnTimer -= dt;
    if (state.spawnTimer <= 0) {
      orderMgr.spawnTicket(state, mode, state.elapsed);
      const ramp = Math.min(1, state.elapsed / 120);
      const nextInterval = mode.spawnInterval - (mode.spawnInterval - mode.minSpawnInterval) * ramp;
      state.spawnTimer = nextInterval * (0.85 + random() * 0.3);
    }

    stepParticlesAndPopups(dt);
    return events;
  }

  reset('dinner');

  return {
    state,
    reset,
    step,
    queueClickAt,
    interactWithStation,
    makeIngredientItem,
    makeDishItem,
  };
}
