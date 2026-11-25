// Ingredient catalog, kitchen station transformations, and the six combinable bistro recipes.

export const INGREDIENTS = {
  steak_raw: { id: 'steak_raw', name: 'Raw Steak', short: 'Steak', color: '#c44545', accent: '#f0b8b0', choppable: true },
  steak_chopped: { id: 'steak_chopped', name: 'Sliced Steak', short: 'Sliced Beef', color: '#b53939', accent: '#f5cac2', searTime: 3.1, searResult: 'steak_seared' },
  steak_seared: { id: 'steak_seared', name: 'Seared Steak', short: 'Seared Beef', color: '#7a2e23', accent: '#d98a5b', ready: true },

  mushroom_raw: { id: 'mushroom_raw', name: 'Shiitake', short: 'Mushroom', color: '#7b5742', accent: '#e7d5be', choppable: true },
  mushroom_chopped: { id: 'mushroom_chopped', name: 'Cut Shiitake', short: 'Cut Shroom', color: '#8a6349', accent: '#ebd9c2', searTime: 2.5, searResult: 'mushroom_seared' },
  mushroom_seared: { id: 'mushroom_seared', name: 'Seared Shiitake', short: 'Seared Shroom', color: '#5c3c29', accent: '#d9a46c', ready: true },

  scallion_raw: { id: 'scallion_raw', name: 'Scallion', short: 'Scallion', color: '#45a84b', accent: '#eff7df', choppable: true },
  scallion_chopped: { id: 'scallion_chopped', name: 'Chopped Scallion', short: 'Scallions', color: '#56c45a', accent: '#d5f2b1', ready: true },

  egg_raw: { id: 'egg_raw', name: 'Farm Egg', short: 'Egg', color: '#f0d8b8', accent: '#d1a87e', searTime: 2.1, searResult: 'egg_fried', boilTime: 2.3, boilResult: 'egg_soft' },
  egg_fried: { id: 'egg_fried', name: 'Sunny Fried Egg', short: 'Fried Egg', color: '#fffef6', accent: '#ffb71b', ready: true },
  egg_soft: { id: 'egg_soft', name: 'Soft-Boiled Egg', short: 'Soft Egg', color: '#fffdf4', accent: '#f29224', ready: true },

  noodles_raw: { id: 'noodles_raw', name: 'Ramen Noodles', short: 'Noodles', color: '#f3d16b', accent: '#d6a43c', boilTime: 2.7, boilResult: 'noodles_broth' },
  noodles_broth: { id: 'noodles_broth', name: 'Broth & Noodles', short: 'Broth Noodles', color: '#e08b36', accent: '#fce28b', ready: true, vessel: 'bowl' },

  rice_steamed: { id: 'rice_steamed', name: 'Steamed Rice', short: 'Warm Rice', color: '#faf7f0', accent: '#dcd5c6', ready: true, vessel: 'plate' },

  burnt: { id: 'burnt', name: 'Charred Scrap', short: 'Burnt', color: '#2b2421', accent: '#594b45', burnt: true },
};

export const CHOP_RESULTS = {
  steak_raw: 'steak_chopped',
  mushroom_raw: 'mushroom_chopped',
  scallion_raw: 'scallion_chopped',
};

/**
 * Six original bistro recipes with mutually non-subset ingredient lists so assembly is unambiguous.
 */
export const RECIPES = [
  {
    id: 'jade_noodles',
    name: 'Jade Scallion Noodles',
    shortName: 'Jade Noodles',
    vessel: 'bowl',
    ingredients: ['noodles_broth', 'egg_fried', 'scallion_chopped'],
    basePoints: 95,
    patience: 48,
    accent: '#58c25d',
  },
  {
    id: 'crispy_egg_rice',
    name: 'Crispy Egg Rice',
    shortName: 'Egg Rice',
    vessel: 'plate',
    ingredients: ['rice_steamed', 'egg_fried', 'scallion_chopped'],
    basePoints: 85,
    patience: 45,
    accent: '#f5b82e',
  },
  {
    id: 'savory_steak_rice',
    name: 'Savory Steak Don',
    shortName: 'Steak Don',
    vessel: 'plate',
    ingredients: ['rice_steamed', 'steak_seared', 'scallion_chopped'],
    basePoints: 110,
    patience: 52,
    accent: '#c94c38',
  },
  {
    id: 'truffle_shroom_ramen',
    name: 'Shiitake Broth Ramen',
    shortName: 'Shroom Ramen',
    vessel: 'bowl',
    ingredients: ['noodles_broth', 'mushroom_seared', 'egg_soft', 'scallion_chopped'],
    basePoints: 130,
    patience: 58,
    accent: '#9c6844',
  },
  {
    id: 'ember_house_ramen',
    name: 'Ember House Ramen',
    shortName: 'Ember Ramen',
    vessel: 'bowl',
    ingredients: ['noodles_broth', 'steak_seared', 'egg_soft', 'scallion_chopped'],
    basePoints: 150,
    patience: 64,
    accent: '#ff7038',
  },
  {
    id: 'midnight_feast',
    name: 'Midnight Bistro Feast',
    shortName: 'Bistro Feast',
    vessel: 'plate',
    ingredients: ['rice_steamed', 'steak_seared', 'mushroom_seared', 'egg_fried'],
    basePoints: 165,
    patience: 66,
    accent: '#e09a38',
  },
];

export const RECIPE_BY_ID = Object.fromEntries(RECIPES.map((r) => [r.id, r]));

/**
 * Find recipes that can still be completed from a current list of plated ingredients plus an optional candidate.
 * @param {string[]} currentIngredients
 * @param {string | null} [candidate]
 * @returns {typeof RECIPES}
 */
export function matchingCandidateRecipes(currentIngredients, candidate = null) {
  const combined = candidate ? [...currentIngredients, candidate] : currentIngredients;
  const seen = new Set();
  for (const item of combined) {
    if (seen.has(item)) return [];
    seen.add(item);
  }
  return RECIPES.filter((recipe) => combined.every((ing) => recipe.ingredients.includes(ing)));
}

/**
 * Return the completed recipe when all required ingredients are present on a plate/bowl, else null.
 * @param {string[]} currentIngredients
 */
export function completedRecipeFor(currentIngredients) {
  if (currentIngredients.length < 3) return null;
  for (const recipe of RECIPES) {
    if (
      recipe.ingredients.length === currentIngredients.length &&
      recipe.ingredients.every((ing) => currentIngredients.includes(ing))
    ) {
      return recipe;
    }
  }
  return null;
}

/**
 * Return the best matching recipe hint for a partially assembled dish (preferring active tickets).
 * @param {string[]} currentIngredients
 * @param {Array<{ recipeId: string }>} tickets
 */
export function bestPartialRecipe(currentIngredients, tickets) {
  const candidates = matchingCandidateRecipes(currentIngredients);
  if (candidates.length === 0) return null;
  for (const ticket of tickets) {
    const found = candidates.find((r) => r.id === ticket.recipeId);
    if (found) return found;
  }
  return candidates[0];
}
