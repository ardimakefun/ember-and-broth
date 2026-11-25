// Unified keyboard and mouse input state for Ember & Broth.
// Translates physical coordinates into logical 1280x720 playfield coordinates and queues discrete actions.

import { FIELD } from './config.js';

export const ACTION_PRIMARY = 1;
export const ACTION_WORK = 2;
export const ACTION_DISCARD = 4;
export const ACTION_PAUSE = 8;
export const ACTION_MUTE = 16;
export const ACTION_CONFIRM = 32;
export const ACTION_RECIPES = 64;

const UP = new Set(['ArrowUp', 'KeyW']);
const DOWN = new Set(['ArrowDown', 'KeyS']);
const LEFT = new Set(['ArrowLeft', 'KeyA']);
const RIGHT = new Set(['ArrowRight', 'KeyD']);
const PRIMARY = new Set(['KeyE', 'Space']);
const WORK = new Set(['KeyF']);
const DISCARD = new Set(['KeyQ', 'Backspace']);
const PAUSE = new Set(['KeyP', 'Escape']);

export function createInput(canvas) {
  const held = new Set();
  let actions = 0;
  let pointerX = FIELD.width / 2;
  let pointerY = FIELD.height / 2;
  let pointerMoved = false;
  let leftClick = null;
  let rightClick = null;
  let pointerDown = false;

  function toFieldCoords(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return { x: FIELD.width / 2, y: FIELD.height / 2 };
    const scale = Math.min(rect.width / FIELD.width, rect.height / FIELD.height);
    const offsetX = (rect.width - FIELD.width * scale) / 2;
    const offsetY = (rect.height - FIELD.height * scale) / 2;
    return {
      x: (clientX - rect.left - offsetX) / scale,
      y: (clientY - rect.top - offsetY) / scale,
    };
  }

  window.addEventListener('keydown', (event) => {
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    held.add(event.code);
    if (UP.has(event.code) || DOWN.has(event.code) || LEFT.has(event.code) || RIGHT.has(event.code)) {
      event.preventDefault();
      return;
    }
    if (PRIMARY.has(event.code)) {
      if (!event.repeat) actions |= ACTION_PRIMARY | ACTION_CONFIRM;
      event.preventDefault();
    } else if (WORK.has(event.code)) {
      if (!event.repeat) actions |= ACTION_WORK;
      event.preventDefault();
    } else if (DISCARD.has(event.code)) {
      if (!event.repeat) actions |= ACTION_DISCARD;
      event.preventDefault();
    } else if (PAUSE.has(event.code)) {
      if (!event.repeat) actions |= ACTION_PAUSE;
      event.preventDefault();
    } else if (event.code === 'KeyM') {
      if (!event.repeat) actions |= ACTION_MUTE;
      event.preventDefault();
    } else if (event.code === 'KeyR') {
      if (!event.repeat) actions |= ACTION_RECIPES;
      event.preventDefault();
    } else if (event.code === 'Enter') {
      if (!event.repeat) actions |= ACTION_CONFIRM;
      event.preventDefault();
    }
  });

  window.addEventListener('keyup', (event) => {
    held.delete(event.code);
  });

  window.addEventListener('blur', () => {
    held.clear();
    pointerDown = false;
  });

  canvas.addEventListener('pointermove', (event) => {
    const pt = toFieldCoords(event.clientX, event.clientY);
    pointerX = pt.x;
    pointerY = pt.y;
    pointerMoved = true;
  });

  canvas.addEventListener('pointerdown', (event) => {
    canvas.focus({ preventScroll: true });
    const pt = toFieldCoords(event.clientX, event.clientY);
    pointerX = pt.x;
    pointerY = pt.y;
    if (event.button === 2) {
      rightClick = pt;
    } else {
      pointerDown = true;
      leftClick = pt;
    }
  });

  window.addEventListener('pointerup', () => {
    pointerDown = false;
  });

  canvas.addEventListener('contextmenu', (event) => {
    event.preventDefault();
  });

  return {
    moveVector() {
      const dx = (held.has('ArrowRight') || held.has('KeyD') ? 1 : 0) - (held.has('ArrowLeft') || held.has('KeyA') ? 1 : 0);
      const dy = (held.has('ArrowDown') || held.has('KeyS') ? 1 : 0) - (held.has('ArrowUp') || held.has('KeyW') ? 1 : 0);
      return {
        dx,
        dy,
        sprint: held.has('ShiftLeft') || held.has('ShiftRight'),
        working: held.has('KeyF') || pointerDown,
      };
    },
    pointer() {
      return { x: pointerX, y: pointerY, moved: pointerMoved };
    },
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
    takeLeftClick() {
      const c = leftClick;
      leftClick = null;
      return c;
    },
    takeRightClick() {
      const c = rightClick;
      rightClick = null;
      return c;
    },
  };
}
