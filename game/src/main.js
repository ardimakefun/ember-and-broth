// Bootstraps Ember & Broth, runs the fixed-timestep loop, handles screen transitions,
// unlocks procedural audio, and exposes deterministic ?shot= staging for screenshots.

import { createAudio } from './audio.js';
import { BEST_SCORE_KEY, STEP } from './config.js';
import {
  ACTION_CONFIRM,
  ACTION_DISCARD,
  ACTION_MUTE,
  ACTION_PAUSE,
  ACTION_PRIMARY,
  ACTION_RECIPES,
  ACTION_WORK,
  createInput,
} from './input.js';
import { createRandom } from './random.js';
import {
  SCREEN_OVER,
  SCREEN_PAUSED,
  SCREEN_PLAY,
  SCREEN_TITLE,
  createRenderer,
} from './render.js';
import { stageShot } from './shots.js';
import {
  EVENT_CHOP,
  EVENT_CHOP_DONE,
  EVENT_COOK_START,
  EVENT_DISH_READY,
  EVENT_PICKUP,
  EVENT_PLACE,
  EVENT_PLATE,
  EVENT_SERVED,
  EVENT_SHIFT_END,
  EVENT_WARN,
  EVENT_WOK_TOSS,
  createWorld,
} from './world.js';

const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shotName = params.get('shot');
const parsedSeed = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(parsedSeed) ? parsedSeed : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const statusEl = document.getElementById('status');
const world = createWorld(createRandom(seed));
const renderer = createRenderer(canvas);
const audio = createAudio();

function readBestScore() {
  try {
    return Number.parseInt(window.localStorage.getItem(BEST_SCORE_KEY) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

function writeBestScore(score) {
  try {
    window.localStorage.setItem(BEST_SCORE_KEY, String(score));
  } catch {
    // Private browsing or blocked storage keeps best score in memory for this visit.
  }
}

function runShotMode(name) {
  const staged = stageShot(name, world);
  let frames = 0;
  function paint() {
    renderer.draw(world.state, staged.screen, staged.best);
    frames += 1;
    if (frames < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGameLoop() {
  const input = createInput(canvas);
  let screen = SCREEN_TITLE;
  let bestScore = readBestScore();
  let accumulator = 0;
  let lastTime = performance.now();
  let lastUrgentSecond = -1;

  function announce(msg) {
    statusEl.textContent = msg;
  }

  function startShift(modeId = world.state.modeId) {
    audio.unlock();
    world.reset(modeId);
    world.state.muted = audio.isMuted();
    accumulator = 0;
    lastUrgentSecond = -1;
    screen = SCREEN_PLAY;
    announce(`Service started in ${modeId} mode.`);
  }

  function endShift() {
    screen = SCREEN_OVER;
    if (world.state.score > bestScore) {
      bestScore = world.state.score;
      writeBestScore(bestScore);
    }
    audio.playBell();
    announce(`Shift complete. Score $${world.state.score}, served ${world.state.served} dishes.`);
  }

  function triggerAudioForEvents(events) {
    if (!events) return;
    if (events & EVENT_SERVED) audio.playBell();
    else if (events & EVENT_DISH_READY) audio.playReady();
    else if (events & EVENT_WOK_TOSS) audio.playWokToss();
    else if (events & EVENT_COOK_START) audio.playSizzle();
    else if (events & EVENT_CHOP_DONE) audio.playChop(true);
    else if (events & EVENT_CHOP) audio.playChop(false);
    else if (events & EVENT_PLATE) audio.playPlate();
    else if (events & EVENT_PICKUP) audio.playPickup();
    else if (events & EVENT_PLACE) audio.playPlace();
    else if (events & EVENT_WARN) audio.playWarn();
  }

  function handleUiAction(buttonId) {
    if (buttonId === 'toggle_mute') {
      world.state.muted = audio.toggleMute();
      return true;
    }
    if (buttonId === 'toggle_recipes') {
      world.state.showRecipes = !world.state.showRecipes;
      return true;
    }
    if (buttonId === 'toggle_pause') {
      if (screen === SCREEN_PLAY) {
        screen = SCREEN_PAUSED;
        announce('Paused.');
      } else if (screen === SCREEN_PAUSED) {
        screen = SCREEN_PLAY;
        announce('Resumed.');
      }
      return true;
    }
    if (buttonId === 'start_game') {
      startShift(world.state.modeId);
      return true;
    }
    if (buttonId.startsWith('mode_')) {
      world.state.modeId = buttonId.slice(5);
      return true;
    }
    if (buttonId === 'resume_game') {
      screen = SCREEN_PLAY;
      return true;
    }
    if (buttonId === 'restart_game') {
      startShift(world.state.modeId);
      return true;
    }
    if (buttonId === 'back_title') {
      world.reset(world.state.modeId);
      screen = SCREEN_TITLE;
      return true;
    }
    return false;
  }

  window.addEventListener('keydown', (event) => {
    if (screen === SCREEN_TITLE) {
      if (event.code === 'Digit1') world.state.modeId = 'dinner';
      else if (event.code === 'Digit2') world.state.modeId = 'blitz';
      else if (event.code === 'Digit3') world.state.modeId = 'endless';
    }
  });

  function stepFrame() {
    const actions = input.takeActions();
    const leftClick = input.takeLeftClick();
    const rightClick = input.takeRightClick();

    if (leftClick || rightClick || actions) audio.unlock();

    if (actions & ACTION_MUTE) {
      world.state.muted = audio.toggleMute();
    }
    if (actions & ACTION_RECIPES && screen === SCREEN_PLAY) {
      world.state.showRecipes = !world.state.showRecipes;
      return;
    }

    if (leftClick) {
      const hit = renderer.hitButton(leftClick.x, leftClick.y);
      if (hit && handleUiAction(hit)) return;
      if (world.state.showRecipes) {
        world.state.showRecipes = false;
        return;
      }
    }

    if (world.state.showRecipes) {
      if (actions & (ACTION_PAUSE | ACTION_CONFIRM)) {
        world.state.showRecipes = false;
      }
      return;
    }

    if (screen === SCREEN_TITLE) {
      if (actions & ACTION_CONFIRM) {
        startShift(world.state.modeId);
        return;
      }
      world.step(STEP, { dx: 0, dy: 0, sprint: false, working: false, primaryPressed: false, workPressed: false, discardPressed: false }, true);
      return;
    }

    if (screen === SCREEN_PAUSED) {
      if (actions & (ACTION_PAUSE | ACTION_CONFIRM)) {
        screen = SCREEN_PLAY;
        announce('Resumed.');
      }
      return;
    }

    if (screen === SCREEN_OVER) {
      if (actions & ACTION_CONFIRM) {
        startShift(world.state.modeId);
      }
      return;
    }

    if (actions & ACTION_PAUSE) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
      return;
    }

    let clickEvents = 0;
    if (leftClick) clickEvents |= world.queueClickAt(leftClick.x, leftClick.y, false);
    if (rightClick) clickEvents |= world.queueClickAt(rightClick.x, rightClick.y, true);

    const move = input.moveVector();
    const ptr = input.pointer();
    const stepEvents = world.step(STEP, {
      dx: move.dx,
      dy: move.dy,
      sprint: move.sprint,
      working: move.working,
      primaryPressed: Boolean(actions & ACTION_PRIMARY),
      workPressed: Boolean(actions & ACTION_WORK),
      discardPressed: Boolean(actions & ACTION_DISCARD),
      pointerX: ptr.moved ? ptr.x : undefined,
      pointerY: ptr.moved ? ptr.y : undefined,
    });

    const combined = clickEvents | stepEvents;
    triggerAudioForEvents(combined);

    if (world.state.timeLeft > 0 && world.state.timeLeft <= 10) {
      const sec = Math.ceil(world.state.timeLeft);
      if (sec !== lastUrgentSecond) {
        lastUrgentSecond = sec;
        audio.playTick();
      }
    }

    if (combined & EVENT_SHIFT_END) {
      endShift();
    }
  }

  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min((now - lastTime) / 1000, MAX_FRAME);
    lastTime = now;
    accumulator += dt;

    if (screen === SCREEN_PLAY || screen === SCREEN_TITLE) {
      while (accumulator >= STEP) {
        stepFrame();
        accumulator -= STEP;
        if (screen === SCREEN_PAUSED || screen === SCREEN_OVER) break;
      }
    } else {
      stepFrame();
      accumulator = 0;
    }

    renderer.draw(world.state, screen, bestScore);
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    }
  });

  // Expose minimal read-only inspection state for automated browser play-testing.
  window.__emberDebug = () => ({
    screen,
    score: world.state.score,
    served: world.state.served,
    timeLeft: world.state.timeLeft,
    tickets: world.state.tickets.length,
    holding: world.state.chef.holding,
    chef: { x: Math.round(world.state.chef.x), y: Math.round(world.state.chef.y) },
  });

  announce('Ember and Broth loaded. Press Space or click Start Service to begin.');
  requestAnimationFrame(frame);
}

if (shotName) runShotMode(shotName);
else runGameLoop();
