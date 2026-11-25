// Entrypoint for Ember & Broth (Node 22, standard library only).
// Copies the offline static game/ directory and screenshots/ into the grader's output directory,
// then generates /output/dossier.json using the unmodified vendor/makefun-game.ts helper.
//
// Play locally: `node serve.ts` then open http://localhost:8080
// Build output: `mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts`

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const rootDir = fileURLToPath(new URL('.', import.meta.url));
const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

mkdirSync(outDir, { recursive: true });
cpSync(join(rootDir, 'game'), join(outDir, 'game'), { recursive: true });

const screenshotsDest = join(outDir, 'screenshots');
mkdirSync(screenshotsDest, { recursive: true });
const screenshotsSrc = join(rootDir, 'screenshots');
if (existsSync(screenshotsSrc)) {
  cpSync(screenshotsSrc, screenshotsDest, { recursive: true });
}

const dossierBytes = buildDossier(outDir, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
});

writeFileSync(join(outDir, 'dossier.json'), dossierBytes);
