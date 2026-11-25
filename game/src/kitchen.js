// Kitchen floor layout, station definitions, collision bounds, and nearest-station queries.

import { CHEF } from './config.js';

export const STATION_TYPES = {
  PANTRY: 'pantry',
  COUNTER: 'counter',
  BOARD: 'board',
  WOK: 'wok',
  POT: 'pot',
  PLATE_STACK: 'plate_stack',
  ASSEMBLY: 'assembly',
  SERVE_PASS: 'serve_pass',
  BELL: 'bell',
  TRASH: 'trash',
};

/**
 * Construct the initial station list for the U-shaped + Central Island night kitchen.
 */
export function createKitchenStations() {
  const stations = [
    // Left Wing: 6 Fresh Ingredient Pantry Crates along the left counter
    { id: 'pantry_steak', type: STATION_TYPES.PANTRY, x: 34, y: 162, w: 86, h: 72, ingredient: 'steak_raw', label: 'Steak' },
    { id: 'pantry_mushroom', type: STATION_TYPES.PANTRY, x: 34, y: 240, w: 86, h: 72, ingredient: 'mushroom_raw', label: 'Shiitake' },
    { id: 'pantry_scallion', type: STATION_TYPES.PANTRY, x: 34, y: 318, w: 86, h: 72, ingredient: 'scallion_raw', label: 'Scallion' },
    { id: 'pantry_egg', type: STATION_TYPES.PANTRY, x: 34, y: 396, w: 86, h: 72, ingredient: 'egg_raw', label: 'Farm Egg' },
    { id: 'pantry_noodles', type: STATION_TYPES.PANTRY, x: 34, y: 474, w: 86, h: 72, ingredient: 'noodles_raw', label: 'Noodles' },
    { id: 'pantry_rice', type: STATION_TYPES.PANTRY, x: 34, y: 552, w: 86, h: 72, ingredient: 'rice_steamed', label: 'Rice Tub' },

    // Top Prep & Cooking Line
    { id: 'counter_prep_left', type: STATION_TYPES.COUNTER, x: 170, y: 158, w: 94, h: 82, label: 'Prep Counter' },
    { id: 'board_1', type: STATION_TYPES.BOARD, x: 274, y: 158, w: 96, h: 82, label: 'Chop Board' },
    { id: 'board_2', type: STATION_TYPES.BOARD, x: 380, y: 158, w: 96, h: 82, label: 'Chop Board' },
    { id: 'wok_1', type: STATION_TYPES.WOK, x: 500, y: 158, w: 100, h: 82, label: 'Iron Wok 1' },
    { id: 'wok_2', type: STATION_TYPES.WOK, x: 610, y: 158, w: 100, h: 82, label: 'Iron Wok 2' },
    { id: 'pot_1', type: STATION_TYPES.POT, x: 734, y: 158, w: 100, h: 82, label: 'Broth Pot 1' },
    { id: 'pot_2', type: STATION_TYPES.POT, x: 844, y: 158, w: 100, h: 82, label: 'Broth Pot 2' },
    { id: 'counter_prep_top_right', type: STATION_TYPES.COUNTER, x: 954, y: 158, w: 94, h: 82, label: 'Garnish Shelf' },

    // Central Island: Plates + Assembly Counters + Spare Counter
    { id: 'plate_stack', type: STATION_TYPES.PLATE_STACK, x: 388, y: 374, w: 92, h: 86, label: 'Plates & Bowls' },
    { id: 'assembly_1', type: STATION_TYPES.ASSEMBLY, x: 492, y: 374, w: 108, h: 86, label: 'Assembly 1' },
    { id: 'assembly_2', type: STATION_TYPES.ASSEMBLY, x: 612, y: 374, w: 108, h: 86, label: 'Assembly 2' },
    { id: 'counter_island', type: STATION_TYPES.COUNTER, x: 732, y: 374, w: 96, h: 86, label: 'Prep Island' },

    // Bottom Prep Counter Wing (ingredients on counter & quick staging)
    { id: 'counter_bottom_1', type: STATION_TYPES.COUNTER, x: 388, y: 554, w: 96, h: 80, label: 'Herb Counter' },
    { id: 'counter_bottom_2', type: STATION_TYPES.COUNTER, x: 496, y: 554, w: 96, h: 80, label: 'Spice Counter' },
    { id: 'assembly_3', type: STATION_TYPES.ASSEMBLY, x: 604, y: 554, w: 108, h: 80, label: 'Assembly 3' },

    // Right Service Pass Wing (generous vertical gap above Pass 1 for READY TO SERVE badge)
    { id: 'counter_right_garnish', type: STATION_TYPES.COUNTER, x: 1144, y: 162, w: 98, h: 74, label: 'Prep Shelf' },
    { id: 'pass_1', type: STATION_TYPES.SERVE_PASS, x: 1144, y: 266, w: 98, h: 86, label: 'Serve Pass 1' },
    { id: 'pass_2', type: STATION_TYPES.SERVE_PASS, x: 1144, y: 366, w: 98, h: 86, label: 'Serve Pass 2' },
    { id: 'serve_bell', type: STATION_TYPES.BELL, x: 1144, y: 466, w: 98, h: 78, label: 'Service Bell' },
    { id: 'trash_bin', type: STATION_TYPES.TRASH, x: 1144, y: 556, w: 98, h: 78, label: 'Compost Bin' },
  ];

  return stations.map((s) => ({
    ...s,
    cx: s.x + s.w / 2,
    cy: s.y + s.h / 2,
    item: null,
    cookProgress: 0,
    cookDuration: 0,
    burnTimer: 0,
    chopProgress: 0,
    chopFlash: 0,
    wokHei: false,
    tossAnim: 0,
  }));
}

/**
 * Resolve circle-vs-rect collisions against all solid kitchen stations and playfield borders.
 * @param {number} x
 * @param {number} y
 * @param {Array<{ x: number, y: number, w: number, h: number }>} stations
 */
export function resolveChefCollisions(x, y, stations) {
  let nx = Math.max(24 + CHEF.radius, Math.min(1256 - CHEF.radius, x));
  let ny = Math.max(148 + CHEF.radius, Math.min(644 - CHEF.radius, y));
  const r = CHEF.radius;

  for (let pass = 0; pass < 2; pass += 1) {
    for (let i = 0; i < stations.length; i += 1) {
      const s = stations[i];
      const closestX = Math.max(s.x, Math.min(nx, s.x + s.w));
      const closestY = Math.max(s.y, Math.min(ny, s.y + s.h));
      const dx = nx - closestX;
      const dy = ny - closestY;
      const distSq = dx * dx + dy * dy;
      if (distSq < r * r) {
        if (distSq > 0.0001) {
          const dist = Math.sqrt(distSq);
          const push = r - dist;
          nx += (dx / dist) * push;
          ny += (dy / dist) * push;
        } else {
          // Inside box fallback: push out along nearest edge.
          const leftPen = nx - s.x;
          const rightPen = s.x + s.w - nx;
          const topPen = ny - s.y;
          const bottomPen = s.y + s.h - ny;
          const minPen = Math.min(leftPen, rightPen, topPen, bottomPen);
          if (minPen === leftPen) nx = s.x - r;
          else if (minPen === rightPen) nx = s.x + s.w + r;
          else if (minPen === topPen) ny = s.y - r;
          else ny = s.y + s.h + r;
        }
      }
    }
  }
  return { x: nx, y: ny };
}

/**
 * Find a clear floor coordinate adjacent to `station` where Chef Pip can stand and interact.
 * @param {{ x: number, y: number, w: number, h: number, cx: number, cy: number }} station
 * @param {number} fromX
 * @param {number} fromY
 * @param {Array} stations
 */
export function findApproachPoint(station, fromX, fromY, stations) {
  const pad = CHEF.radius + 14;
  const candidates = [
    { x: station.cx, y: station.y + station.h + pad },
    { x: station.cx, y: station.y - pad },
    { x: station.x + station.w + pad, y: station.cy },
    { x: station.x - pad, y: station.cy },
  ];

  let best = null;
  let bestScore = Infinity;
  for (const cand of candidates) {
    if (cand.x < 46 || cand.x > 1234 || cand.y < 168 || cand.y > 624) continue;
    const blocked = stations.some(
      (s) =>
        cand.x + CHEF.radius - 2 > s.x &&
        cand.x - CHEF.radius + 2 < s.x + s.w &&
        cand.y + CHEF.radius - 2 > s.y &&
        cand.y - CHEF.radius + 2 < s.y + s.h,
    );
    if (blocked) continue;
    const dist = Math.hypot(cand.x - fromX, cand.y - fromY);
    if (dist < bestScore) {
      bestScore = dist;
      best = cand;
    }
  }
  return best ?? { x: station.cx, y: Math.min(620, station.y + station.h + pad) };
}

/**
 * Pick the nearest station within interaction range, weighted lightly toward the direction Pip is facing.
 */
export function findFocusedStation(chef, stations) {
  const lookX = chef.x + Math.cos(chef.angle) * 28;
  const lookY = chef.y + Math.sin(chef.angle) * 28;
  let best = null;
  let bestDist = Infinity;

  for (let i = 0; i < stations.length; i += 1) {
    const s = stations[i];
    const clampedX = Math.max(s.x, Math.min(chef.x, s.x + s.w));
    const clampedY = Math.max(s.y, Math.min(chef.y, s.y + s.h));
    const edgeDist = Math.hypot(chef.x - clampedX, chef.y - clampedY);
    if (edgeDist > CHEF.interactRange) continue;

    const aimDist = Math.hypot(lookX - s.cx, lookY - s.cy);
    const score = edgeDist * 1.35 + aimDist * 0.45;
    if (score < bestDist) {
      bestDist = score;
      best = s;
    }
  }
  return best;
}

/**
 * Find any station under pointer coordinates `(px, py)` with a generous hit pad.
 */
export function findStationAtPoint(px, py, stations) {
  for (let i = 0; i < stations.length; i += 1) {
    const s = stations[i];
    if (px >= s.x - 6 && px <= s.x + s.w + 6 && py >= s.y - 6 && py <= s.y + s.h + 6) {
      return s;
    }
  }
  return null;
}
