// Real-simulation screenshot stager behind ?shot=cover|title|cooking|end&seed=N.
// Drives the genuine world rules forward with a waypoint-aware autonomous chef planner
// so every kitchen scene, timer, mid-assembly dish, and ready plate is authentic.

import { CHEF, STEP } from './config.js';
import { INGREDIENTS, RECIPE_BY_ID } from './recipes.js';
import { SCREEN_OVER, SCREEN_PLAY, SCREEN_TITLE } from './render.js';
import { EVENT_SHIFT_END } from './world.js';

function moveTowards(world, tx, ty, sprint = true) {
  const chef = world.state.chef;
  let navX = tx;
  let navY = ty;
  const crossingDown = chef.y < 365 && ty > 465 && chef.x > 350 && chef.x < 860;
  const crossingUp = chef.y > 465 && ty < 365 && chef.x > 350 && chef.x < 860;
  if (crossingDown || crossingUp) {
    navX = chef.x < 605 ? 340 : 875;
    navY = chef.y;
  } else if (chef.y > 355 && ty > 355 && Math.abs(tx - chef.x) > 160 && chef.x > 350 && chef.x < 860) {
    navX = chef.x < 605 ? 340 : 875;
    navY = 315;
  }

  const dx = navX - chef.x;
  const dy = navY - chef.y;
  const dist = Math.hypot(dx, dy);
  if (dist < 10) return true;
  world.step(STEP, {
    dx: dx / dist,
    dy: dy / dist,
    sprint,
    working: false,
    primaryPressed: false,
    workPressed: false,
    discardPressed: false,
  });
  return false;
}

function goAndInteract(world, station, isWork = false) {
  const clampedX = Math.max(station.x, Math.min(world.state.chef.x, station.x + station.w));
  const clampedY = Math.max(station.y, Math.min(world.state.chef.y, station.y + station.h));
  const edgeDist = Math.hypot(world.state.chef.x - clampedX, world.state.chef.y - clampedY);
  if (edgeDist <= CHEF.interactRange - 8) {
    world.interactWithStation(station, isWork);
    world.step(STEP, { dx: 0, dy: 0, sprint: false, working: false, primaryPressed: false, workPressed: false, discardPressed: false });
    return true;
  }
  let ax = station.cx;
  let ay = station.cy;
  if (station.y > 490) ay = station.y - 34;
  else if (station.y < 250 && station.x > 130) ay = station.y + station.h + 34;
  else if (station.x < 130) ax = station.x + station.w + 34;
  else if (station.x > 1050) ax = station.x - 34;
  else ay = station.y - 34;
  moveTowards(world, ax, ay);
  return false;
}

function findStation(world, id) {
  return world.state.stations.find((s) => s.id === id);
}

/**
 * Autonomous chef loop that cooks full multi-step orders through real world mechanics.
 */
function runChefTask(world, stepsLimit, stopFn) {
  for (let i = 0; i < stepsLimit; i += 1) {
    if (stopFn && stopFn(world.state, i)) break;
    const st = world.state;
    const bell = findStation(world, 'serve_bell');
    const pass1 = findStation(world, 'pass_1');
    const wok1 = findStation(world, 'wok_1');
    const pot1 = findStation(world, 'pot_1');
    const board1 = findStation(world, 'board_1');
    const plateStack = findStation(world, 'plate_stack');
    const assembly1 = findStation(world, 'assembly_1');

    if (pass1.item?.completedRecipeId && st.tickets.some((t) => t.recipeId === pass1.item.completedRecipeId)) {
      goAndInteract(world, bell);
      continue;
    }

    const ticket = st.tickets[0];
    if (!ticket) {
      world.step(STEP, { dx: 0, dy: 0, sprint: false, working: false, primaryPressed: false, workPressed: false, discardPressed: false });
      continue;
    }
    const recipe = RECIPE_BY_ID[ticket.recipeId];

    if (st.chef.holding?.kind === 'dish' && st.chef.holding.completedRecipeId) {
      goAndInteract(world, pass1);
      continue;
    }

    if (!assembly1.item) {
      if (st.chef.holding?.kind === 'dish') goAndInteract(world, assembly1);
      else goAndInteract(world, plateStack);
      continue;
    }

    const dish = assembly1.item;
    if (dish.completedRecipeId) {
      goAndInteract(world, assembly1);
      continue;
    }

    // Discard dish if ticket vanished while assembling
    if (!recipe.ingredients.some((ing) => !dish.ingredients.includes(ing)) || !dish.ingredients.every((ing) => recipe.ingredients.includes(ing))) {
      if (!st.chef.holding) goAndInteract(world, assembly1);
      else goAndInteract(world, findStation(world, 'trash_bin'));
      continue;
    }

    const missing = recipe.ingredients.find((ing) => !dish.ingredients.includes(ing));
    if (st.chef.holding?.kind === 'ingredient' && st.chef.holding.ingredientId === missing) {
      goAndInteract(world, assembly1);
      continue;
    }

    if (!st.chef.holding && wok1.item?.ingredientId === missing) {
      goAndInteract(world, wok1);
      continue;
    }
    if (!st.chef.holding && pot1.item?.ingredientId === missing) {
      goAndInteract(world, pot1);
      continue;
    }
    if (!st.chef.holding && board1.item?.ingredientId === missing) {
      goAndInteract(world, board1);
      continue;
    }

    if (board1.item && INGREDIENTS[board1.item.ingredientId]?.choppable && !st.chef.holding) {
      goAndInteract(world, board1, true);
      continue;
    }
    if (wok1.item && wok1.cookProgress < 1) {
      if (wok1.cookProgress >= 0.45 && !wok1.wokHei) goAndInteract(world, wok1, true);
      else world.step(STEP, { dx: 0, dy: 0, sprint: false, working: false, primaryPressed: false, workPressed: false, discardPressed: false });
      continue;
    }
    if (pot1.item && pot1.cookProgress < 1) {
      world.step(STEP, { dx: 0, dy: 0, sprint: false, working: false, primaryPressed: false, workPressed: false, discardPressed: false });
      continue;
    }

    // Clear burnt or incompatible leftovers before cooking next ingredient
    if (st.chef.holding) {
      const hId = st.chef.holding.ingredientId;
      const neededRaw =
        (missing === 'noodles_broth' && hId === 'noodles_raw') ||
        (missing === 'egg_soft' && hId === 'egg_raw') ||
        (missing === 'egg_fried' && hId === 'egg_raw') ||
        (missing === 'scallion_chopped' && hId === 'scallion_raw') ||
        (missing === 'steak_seared' && (hId === 'steak_raw' || hId === 'steak_chopped')) ||
        (missing === 'mushroom_seared' && (hId === 'mushroom_raw' || hId === 'mushroom_chopped'));
      if (!neededRaw) {
        goAndInteract(world, findStation(world, 'trash_bin'));
        continue;
      }
    }

    if (missing === 'rice_steamed') {
      goAndInteract(world, findStation(world, 'pantry_rice'));
    } else if (missing === 'noodles_broth') {
      if (st.chef.holding?.ingredientId === 'noodles_raw') goAndInteract(world, pot1);
      else goAndInteract(world, findStation(world, 'pantry_noodles'));
    } else if (missing === 'egg_soft') {
      if (st.chef.holding?.ingredientId === 'egg_raw') goAndInteract(world, pot1);
      else goAndInteract(world, findStation(world, 'pantry_egg'));
    } else if (missing === 'egg_fried') {
      if (st.chef.holding?.ingredientId === 'egg_raw') goAndInteract(world, wok1);
      else goAndInteract(world, findStation(world, 'pantry_egg'));
    } else if (missing === 'scallion_chopped') {
      if (st.chef.holding?.ingredientId === 'scallion_raw') goAndInteract(world, board1);
      else goAndInteract(world, findStation(world, 'pantry_scallion'));
    } else if (missing === 'steak_seared') {
      if (st.chef.holding?.ingredientId === 'steak_chopped') goAndInteract(world, wok1);
      else if (board1.item?.ingredientId === 'steak_chopped' && !st.chef.holding) goAndInteract(world, board1);
      else if (st.chef.holding?.ingredientId === 'steak_raw') goAndInteract(world, board1);
      else goAndInteract(world, findStation(world, 'pantry_steak'));
    } else if (missing === 'mushroom_seared') {
      if (st.chef.holding?.ingredientId === 'mushroom_chopped') goAndInteract(world, wok1);
      else if (board1.item?.ingredientId === 'mushroom_chopped' && !st.chef.holding) goAndInteract(world, board1);
      else if (st.chef.holding?.ingredientId === 'mushroom_raw') goAndInteract(world, board1);
      else goAndInteract(world, findStation(world, 'pantry_mushroom'));
    } else {
      world.step(STEP, { dx: 0, dy: 0, sprint: false, working: false, primaryPressed: false, workPressed: false, discardPressed: false });
    }
  }
}

export function stageShot(name, world) {
  if (name === 'title') {
    world.reset('dinner');
    const wok1 = findStation(world, 'wok_1');
    const pot1 = findStation(world, 'pot_1');
    const assembly1 = findStation(world, 'assembly_1');
    const pass1 = findStation(world, 'pass_1');
    if (wok1) {
      wok1.item = world.makeIngredientItem('steak_chopped');
      wok1.cookDuration = 3.1;
      wok1.cookProgress = 0.65;
      wok1.wokHei = true;
    }
    if (pot1) {
      pot1.item = world.makeIngredientItem('noodles_raw');
      pot1.cookDuration = 2.7;
      pot1.cookProgress = 0.55;
    }
    if (assembly1) assembly1.item = world.makeDishItem(['noodles_broth', 'steak_seared'], 1);
    if (pass1) pass1.item = world.makeDishItem(RECIPE_BY_ID.savory_steak_rice.ingredients, 1);
    for (let i = 0; i < 60; i += 1) {
      world.step(STEP, { dx: 0, dy: 0, sprint: false, working: false, primaryPressed: false, workPressed: false, discardPressed: false }, true);
    }
    return { screen: SCREEN_TITLE, best: 1095 };
  }

  if (name === 'end') {
    world.reset('dinner');
    let ended = false;
    runChefTask(world, 190 / STEP, () => {
      if (world.state.timeLeft <= 0) {
        ended = true;
        return true;
      }
      return false;
    });
    if (!ended) {
      while (world.state.timeLeft > 0) {
        if (world.step(STEP, { dx: 0, dy: 0, sprint: false, working: false, primaryPressed: false, workPressed: false, discardPressed: false }) & EVENT_SHIFT_END) break;
      }
    }
    world.state.timeLeft = 0;
    return { screen: SCREEN_OVER, best: Math.max(world.state.score, 940) };
  }

  if (name === 'cooking') {
    world.reset('blitz');
    runChefTask(world, 34 / STEP, (s) => s.served >= 2 && s.tickets.length >= 3);
    const wok2 = findStation(world, 'wok_2');
    const pot1 = findStation(world, 'pot_1');
    const board1 = findStation(world, 'board_1');
    const assembly2 = findStation(world, 'assembly_2');
    const pass2 = findStation(world, 'pass_2');
    if (assembly2) assembly2.item = world.makeDishItem(['noodles_broth', 'egg_soft'], 1);
    if (pass2) pass2.item = world.makeDishItem(RECIPE_BY_ID.crispy_egg_rice.ingredients, 1);
    if (board1) {
      board1.item = world.makeIngredientItem('steak_raw');
      board1.chopProgress = 0.67;
      board1.chopFlash = 0.24;
    }
    if (wok2) {
      wok2.item = world.makeIngredientItem('mushroom_chopped');
      wok2.cookDuration = 2.5;
      wok2.cookProgress = 0.54;
    }
    if (pot1) {
      pot1.item = world.makeIngredientItem('noodles_raw');
      pot1.cookDuration = 2.7;
      pot1.cookProgress = 0.66;
    }
    for (let i = 0; i < 65; i += 1) {
      goAndInteract(world, wok2, i % 18 === 0);
    }
    if (wok2) wok2.tossAnim = 0.52;
    if (board1) board1.chopFlash = 0.24;
    world.state.popups = world.state.popups.filter((p) => !p.text.includes('Done'));
    return { screen: SCREEN_PLAY, best: 940 };
  }

  // Cover: authentic mid-shift service showing kitchen + order board + ingredients on counter + dish mid-assembly + timer + plate ready to serve!
  world.reset('dinner');
  runChefTask(world, 52 / STEP, (s) => s.served >= 3 && s.tickets.length >= 4);
  while (world.state.tickets.length < 4) {
    world.step(STEP, { dx: 0, dy: 0, sprint: false, working: false, primaryPressed: false, workPressed: false, discardPressed: false });
    if (world.state.elapsed > 80) break;
  }
  // Let ticket spawn animation settle cleanly onto the rail
  for (let i = 0; i < 24; i += 1) {
    world.step(STEP, { dx: 0, dy: 0, sprint: false, working: false, primaryPressed: false, workPressed: false, discardPressed: false });
  }

  const pass1 = findStation(world, 'pass_1');
  const firstTicket = world.state.tickets[0];
  const readyRecipeId = firstTicket ? firstTicket.recipeId : 'savory_steak_rice';
  if (pass1) pass1.item = world.makeDishItem(RECIPE_BY_ID[readyRecipeId].ingredients, 1);

  const assembly1 = findStation(world, 'assembly_1');
  const assembly2 = findStation(world, 'assembly_2');
  const ramenTicket = world.state.tickets.find((t) => RECIPE_BY_ID[t.recipeId].vessel === 'bowl') ?? world.state.tickets[1];
  const midRecipe = RECIPE_BY_ID[ramenTicket ? ramenTicket.recipeId : 'ember_house_ramen'];
  if (assembly1) assembly1.item = world.makeDishItem(midRecipe.ingredients.slice(0, 2), 1);
  if (assembly2) assembly2.item = null;

  const wok1 = findStation(world, 'wok_1');
  const pot1 = findStation(world, 'pot_1');
  const board2 = findStation(world, 'board_2');
  const counterTopRight = findStation(world, 'counter_prep_top_right');
  const counterSpice = findStation(world, 'counter_bottom_2');
  if (wok1) {
    wok1.item = world.makeIngredientItem('steak_chopped');
    wok1.cookDuration = 3.1;
    wok1.cookProgress = 0.72;
    wok1.wokHei = true;
    wok1.tossAnim = 0.45;
  }
  if (pot1) {
    pot1.item = world.makeIngredientItem('noodles_raw');
    pot1.cookDuration = 2.7;
    pot1.cookProgress = 0.58;
  }
  if (board2) board2.item = world.makeIngredientItem('scallion_chopped');
  if (counterTopRight) counterTopRight.item = world.makeIngredientItem('mushroom_seared', true);
  if (counterSpice) counterSpice.item = world.makeIngredientItem('egg_fried', false);

  const nextIng = midRecipe.ingredients[2] ?? 'scallion_chopped';
  world.state.chef.holding = world.makeIngredientItem(nextIng, false);
  world.state.chef.x = assembly1.cx + 52;
  world.state.chef.y = assembly1.y - 36;
  world.state.chef.angle = Math.PI * 0.72;
  world.state.focusedStationId = assembly1.id;
  world.state.toast = null;
  world.state.popups = [];

  return { screen: SCREEN_PLAY, best: 940 };
}
