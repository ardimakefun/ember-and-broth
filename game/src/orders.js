// Order board tickets, VIP rush rules, patience timers, and combo calculation.

import { TIMERS } from './config.js';
import { RECIPES, RECIPE_BY_ID } from './recipes.js';

/**
 * Create the order queue manager.
 * @param {() => number} random
 */
export function createOrderManager(random) {
  let nextOrderNum = 101;

  function pickRecipe(elapsed, existingTickets = []) {
    // Gradually unlock signature 4-step dishes as the shift ramps up, and avoid repeating the same dish constantly.
    const pool = elapsed < 18 ? RECIPES.slice(0, 4) : RECIPES;
    const activeIds = new Set(existingTickets.map((t) => t.recipeId));
    const fresh = pool.filter((r) => !activeIds.has(r.id));
    const choices = fresh.length > 0 ? fresh : pool;
    const idx = Math.floor(random() * choices.length);
    return choices[idx];
  }

  function spawnTicket(state, mode, elapsed) {
    if (state.tickets.length >= TIMERS.maxTickets) return null;
    const recipe = pickRecipe(elapsed, state.tickets);
    const vip = state.served >= 1 && random() < mode.vipChance;
    const patience = Math.round(recipe.patience * mode.patienceScale * (vip ? 0.85 : 1.0));
    const ticket = {
      id: nextOrderNum++,
      recipeId: recipe.id,
      vip,
      maxTime: patience,
      remaining: patience,
      flash: 0,
      spawnAnim: 1,
    };
    state.tickets.push(ticket);
    return ticket;
  }

  function stepTickets(state, dt, mode) {
    let expiredCount = 0;
    for (let i = state.tickets.length - 1; i >= 0; i -= 1) {
      const t = state.tickets[i];
      if (t.spawnAnim > 0) t.spawnAnim = Math.max(0, t.spawnAnim - dt * 3.5);
      if (t.flash > 0) t.flash = Math.max(0, t.flash - dt * 2.5);
      t.remaining -= dt;
      if (t.remaining <= 0) {
        state.tickets.splice(i, 1);
        expiredCount += 1;
        state.combo = 1;
        state.comboTimer = 0;
        state.missed += 1;
        if (mode.maxStrikes > 0) state.strikes += 1;
      }
    }
    return expiredCount;
  }

  /**
   * Match a finished dish against active tickets (oldest / lowest remaining time first).
   * @returns {{ ticket: any, payout: number, tip: number, combo: number } | null}
   */
  function serveDish(state, dish) {
    if (!dish || !dish.completedRecipeId) return null;
    let bestIdx = -1;
    let lowestRemaining = Infinity;
    for (let i = 0; i < state.tickets.length; i += 1) {
      const t = state.tickets[i];
      if (t.recipeId === dish.completedRecipeId && t.remaining < lowestRemaining) {
        lowestRemaining = t.remaining;
        bestIdx = i;
      }
    }

    if (bestIdx === -1) return null;

    const ticket = state.tickets.splice(bestIdx, 1)[0];
    const recipe = RECIPE_BY_ID[ticket.recipeId];
    const timeRatio = Math.max(0, Math.min(1, ticket.remaining / ticket.maxTime));
    const comboMult = state.combo;
    const speedTip = Math.round(recipe.basePoints * 0.35 * timeRatio);
    const wokBonus = dish.wokHeiCount ? dish.wokHeiCount * 15 : 0;
    const vipMult = ticket.vip ? 2 : 1;
    const feverMult = state.feverTimer > 0 ? 1.25 : 1;
    const payout = Math.round((recipe.basePoints + speedTip + wokBonus) * comboMult * vipMult * feverMult);

    state.score += payout;
    state.served += 1;
    state.wokHeiServed += dish.wokHeiCount || 0;
    state.combo = Math.min(4, +(state.combo + 0.5).toFixed(1));
    state.bestCombo = Math.max(state.bestCombo, state.combo);
    state.comboTimer = TIMERS.comboWindow;

    return { ticket, payout, tip: speedTip + wokBonus, combo: state.combo };
  }

  function resetCounter() {
    nextOrderNum = 101;
  }

  return { spawnTicket, stepTickets, serveDish, resetCounter };
}
