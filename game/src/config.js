// Tuning constants, playfield geometry, game modes, and visual palette for Ember & Broth.

export const FIELD = {
  width: 1280,
  height: 720,
  hudHeight: 136,
  footerY: 654,
  kitchenLeft: 20,
  kitchenTop: 142,
  kitchenRight: 1260,
  kitchenBottom: 648,
};

/** Fixed simulation step (60 Hz) regardless of monitor refresh rate. */
export const STEP = 1 / 60;

export const CHEF = {
  radius: 21,
  speed: 330,
  sprintMultiplier: 1.32,
  interactRange: 84,
};

export const TIMERS = {
  chopTapsNeeded: 3,
  chopHoldRate: 2.6,
  wokBurnAfterReady: 5.8,
  potBurnAfterReady: 7.5,
  orderSpawnGrace: 1.2,
  maxTickets: 4,
  comboWindow: 22,
};

export const MODES = {
  dinner: {
    id: 'dinner',
    label: 'Dinner Service',
    subtitle: '3:00 balanced bistro rush',
    duration: 180,
    maxStrikes: 0,
    initialTickets: 2,
    spawnInterval: 11.5,
    minSpawnInterval: 6.2,
    patienceScale: 1.0,
    vipChance: 0.22,
  },
  blitz: {
    id: 'blitz',
    label: 'Midnight Blitz',
    subtitle: '2:00 fast VIP combos',
    duration: 120,
    maxStrikes: 0,
    initialTickets: 3,
    spawnInterval: 8.8,
    minSpawnInterval: 4.8,
    patienceScale: 0.85,
    vipChance: 0.36,
  },
  endless: {
    id: 'endless',
    label: 'Endless Rush',
    subtitle: '3 missed orders ends shift',
    duration: 0,
    maxStrikes: 3,
    initialTickets: 2,
    spawnInterval: 11.0,
    minSpawnInterval: 4.5,
    patienceScale: 1.0,
    vipChance: 0.28,
  },
};

export const PALETTE = {
  bgOuter: '#140f0d',
  woodDark: '#2c1d16',
  woodMid: '#4c3224',
  woodLight: '#7b533b',
  woodTrim: '#a87854',
  tileLight: '#efe3d1',
  tileDark: '#e2cfb6',
  counterTop: '#d7be9e',
  counterMarble: '#f4eee6',
  counterSteel: '#8e98a4',
  brass: '#e6b85c',
  brassBright: '#ffd97d',
  emberOrange: '#ff6f3c',
  emberGold: '#ffb648',
  flameBlue: '#5bc0ff',
  brothAmber: '#d97b29',
  emerald: '#2eb872',
  emeraldDark: '#1c7c4d',
  crimson: '#e04f47',
  ticketPaper: '#fffaf0',
  ticketBorder: '#d8c8ad',
  ink: '#241914',
  inkMuted: '#6e5a4f',
  cream: '#fff6ea',
};

export const FONT_UI = '"Trebuchet MS", "Segoe UI", system-ui, sans-serif';
export const FONT_DISPLAY = 'Georgia, "Times New Roman", serif';
export const BEST_SCORE_KEY = 'ember-and-broth.best.v1';
