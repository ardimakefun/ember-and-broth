// Deterministic Mulberry32 PRNG for reproducible order flows and staged screenshots.

/**
 * Create a deterministic pseudo-random generator returning floats in [0, 1).
 * @param {number} seed
 * @returns {() => number}
 */
export function createRandom(seed) {
  let state = seed >>> 0;
  return function nextRandom() {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
