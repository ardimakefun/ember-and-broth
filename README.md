# Ember & Broth — Night Kitchen Service

[![make.fun · best-cooking-game-20261125-0137](https://make.fun/badge/best-cooking-game-20261125-0137.svg)](https://make.fun/bounty/best-cooking-game-20261125-0137)
[![rank](https://make.fun/badge/best-cooking-game-20261125-0137/ardimakefun/ember-and-broth/rank.svg)](https://make.fun/bounty/best-cooking-game-20261125-0137/leaderboard)
[![reward](https://make.fun/badge/best-cooking-game-20261125-0137/ardimakefun/ember-and-broth/reward.svg)](https://make.fun/bounty/best-cooking-game-20261125-0137)

**Ember & Broth — Night Kitchen Service** is a complete, original offline desktop-browser cooking game built with zero external dependencies using Canvas 2D, ES modules, and procedural Web Audio synthesis. Play as **Chef Pip** running a bustling lantern-lit night noodle and steakhouse bistro: grab fresh ingredients from pantry crates, chop on butcher blocks, sear with timed **Wok-Hei** tosses, simmer dashi broth, assemble six combinable ramen and rice-bowl dishes mid-rush on the marble island, and ring the brass service bell to serve orders before patience timers run out.

## Game Modes

- **Dinner Service (3:00)** — Classic balanced bistro rush with escalating tickets, VIP 2x orders, and Rush Fever combos.
- **Midnight Blitz (2:00)** — High-tempo 2-minute rush packed with high-value VIP orders and fast combo chains.
- **Endless Rush** — Continuous kitchen service where 3 missed orders end the shift.

## How to Play (Keyboard + Mouse)

- **Move**: `WASD` or Arrow keys (hold `Shift` to sprint), or **left-click** any station or floor tile to walk automatically
- **Interact / Grab / Plate / Serve**: `E`, `Space`, or **left-click** on crates, counters, plates, Serve Pass, or the Service Bell
- **Chop / Stir / Wok Toss (Wok-Hei)**: `F` (tap or hold) or **right-click** on a Chop Board, Iron Wok, or Broth Pot
- **Discard / Clear Hands**: `Q`, `Backspace`, or interact with the Compost Bin
- **Recipe Book / Pause / Mute**: `R` (open/close Recipe Book), `P` or `Esc` (Pause), `M` (Mute procedural music & SFX)

## Run Locally

Requires Node.js 22.18+ (or Node 22.6–22.17 with `--experimental-strip-types`) and a desktop browser such as Chrome:

```sh
node serve.ts
# Open http://localhost:8080 in desktop Chrome
```

To generate the grader dossier output in `out/`:

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

## Repository Structure

```text
.
├── LICENSE                  # MIT License (OSI-approved)
├── README.md                # Project overview & live make.fun badges
├── main.ts                  # Node 22 entrypoint copying game/ & screenshots/ and writing dossier.json
├── serve.ts                 # Local static HTTP server for play-testing game/
├── shots.json               # Deterministic screenshot scene configuration
├── vendor/
│   └── makefun-game.ts      # Unmodified make.fun dossier helper from the bounty kit
├── game/
│   ├── index.html           # Offline static HTML shell (zero network requests)
│   └── src/
│       ├── art.js           # Procedural textures, food layers, lanterns, props, and Chef Pip
│       ├── audio.js         # Procedural Web Audio API synthesizer & bistro soundtrack
│       ├── config.js        # Logical 1280x720 field dimensions, timers, modes, and palette
│       ├── input.js         # Unified keyboard + mouse input handler
│       ├── kitchen.js       # Station layout, collision resolution, and focus detection
│       ├── main.js          # Game loop, screen state machine, and ?shot= integration
│       ├── orders.js        # Order ticket spawner, VIP rules, combos, and payouts
│       ├── random.js        # Deterministic Mulberry32 PRNG
│       ├── recipes.js       # Ingredient states and 6 combinable bistro recipes
│       ├── render.js        # Layered kitchen, order board, HUD, tooltips, and modal overlays
│       ├── shots.js         # Autonomous chef stager for real-simulation screenshots
│       └── world.js         # Core simulation: pathing, cooking, assembly, serving, and FX
└── screenshots/
    ├── 1-cover.jpg          # Live rush: kitchen, order board, counter ingredients, mid-assembly ramen, timers, and ready plate
    ├── 2-title.jpg          # Title screen with mode selection and controls over the active kitchen
    ├── 3-cooking-action.jpg # Active chopping, Wok-Hei flame toss, simmering broth, and service rush
    └── 4-shift-summary.jpg  # End-of-shift 3-Star Master Chef summary screen
```

---

<sub>Built for the [make.fun · Make the best cooking game](https://make.fun/bounty/best-cooking-game-20261125-0137) bounty ($250 USDC)</sub>
