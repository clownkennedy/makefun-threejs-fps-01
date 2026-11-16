// main.ts — build entrypoint for the EMBERLINE threejs-fps-01 submission.
// Copies game/ and screenshots/ into the output directory and writes
// dossier.json for the competition checker. Node 22, standard library only.
//
// Usage:  MAKEFUN_OUTPUT_DIR=out node main.ts
// The grader runs this in a fresh container with no network; the output
// directory defaults to /output when MAKEFUN_OUTPUT_DIR is not set.
import { copyFile, mkdir, readdir, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-threejs.ts';

// The repository root is the directory holding this file.
const REPO_ROOT = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = process.env.MAKEFUN_OUTPUT_DIR
  ? resolve(process.env.MAKEFUN_OUTPUT_DIR)
  : '/output';

// The threejs-fps-01 caps: 160 KiB of dossier text, at most four screenshots
// of 256 KiB each, and the game tree capped at 993 files / 48 MiB.
const CAPS = {
  text_max_bytes: 160 * 1024,
  screenshots: { max: 4, max_bytes: 256 * 1024 },
  game_max_files: 993,
  game_max_bytes: 48 * 1024 * 1024,
};

async function copyTree(src, dst) {
  await mkdir(dst, { recursive: true });
  const entries = await readdir(src, { withFileTypes: true });
  for (const entry of entries) {
    const from = join(src, entry.name);
    const to = join(dst, entry.name);
    if (entry.isDirectory()) {
      await copyTree(from, to);
    } else if (entry.isFile()) {
      await copyFile(from, to);
    }
  }
}

async function build() {
  await mkdir(OUT_DIR, { recursive: true });
  await copyTree(join(REPO_ROOT, 'game'), join(OUT_DIR, 'game'));
  await copyTree(join(REPO_ROOT, 'screenshots'), join(OUT_DIR, 'screenshots'));
  const dossier = buildDossier(OUT_DIR, CAPS);
  const dossierPath = join(OUT_DIR, 'dossier.json');
  await writeFile(dossierPath, dossier);
  console.log(`wrote ${dossierPath} (${dossier.byteLength} bytes)`);
}

build().catch((err) => {
  console.error(err);
  process.exit(1);
});
