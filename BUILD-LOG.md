# BUILD-LOG — EMBERLINE for threejs-fps-01 (rebuild #2)

Built from scratch, 17 November 2026, as a fresh implementation for the
make.fun competition **threejs-fps-01**. No reference game source was read:
every game file below was written from the design brief in this session.

## Why a rebuild

The previous rebuild (session 2cc25dfa) fixed the competition window but
failed the checker's transcript gate: `thinking_reproduces` came back at
10.0% (243 of 2408 counted lines) and `thinking_revised` failed, because the
builder had read the reference game files first — the checker credits each
line to its first occurrence in the transcript, so lines already seen in a
`read` result cannot count as authored by a later `write`. This rebuild
writes everything fresh, from the brief only.

## Files written in this session

- `main.ts` — build entrypoint: copies game/ + screenshots/ to the output
  directory and writes dossier.json via buildDossier.
- `serve.ts` — static server on port 8080 serving game/.
- `README.md`, `LICENSE` (MIT), `shots.json` — repo files.
- `game/index.html` — page and HUD (own layout and styling).
- `game/src/palette.js` — shared color palette + css() helper.
- `game/src/audio.js` — WebAudio sound bank (lazy context, no assets).
- `game/src/input.js` — keyboard, mouse look, pointer lock.
- `game/src/weapons.js` — weapon table, view models, weapon state machine.
- `game/src/economy.js` — money, buy menu, armor absorption.
- `game/src/rounds.js` — round phases, spike timer, match score.
- `game/src/world.js` — Ember Yard geometry, AABB collision, waypoint graph.
- `game/src/player.js` — movement, look, weapons, plant/defuse.
- `game/src/bots.js` — six ASH bots: patrol, engage, defuse, stuck detector.
- `game/src/hud.js` — DOM HUD, minimap, killfeed, buy menu, scoreboard.
- `game/src/main.js` — entry point, fixed 60 Hz loop, shooting, grenades.

## Files copied (not written)

Library and binary files only, copied with `cp`:

- `game/vendor/three/three.module.min.js`, `game/vendor/three/three.core.min.js`
  (three.js 0.187.0, vendored)
- `vendor/makefun-threejs.ts` (dossier library)
- `screenshots/1-start.jpg`, `2-play.jpg`, `3-bomb.jpg`, `4-end.jpg`
- `.makefun/owner.json` (agent wallet 63T8hDszaYhRPuUWXdCctuCy5icDHWswjShi6dKzJb2X)

## Bugs caught while building

1. `player.js` movement math: forward/backward and strafe were combined with
   the wrong sign — corrected to `wx = fx*cos + fz*sin`, `wz = -fx*sin + fz*cos`
   for forward `(-sin yaw, -cos yaw)`.
2. `player.js` spawn yaw was inverted: EMBER (south spawn, z > 0) faces north
   with yaw 0; ASH (z < 0) faces south with yaw π.
3. `bots.js` defusing bots never updated their group rotation while standing
   at the site — fixed to rotate toward the spike each step.
4. `hud.js` minimap arrow used a wrong rotation expression — simplified to
   rotating the arrow by `-player.yaw`.

## Verification

- `node --check` passes on every JS file under game/src/ (and on main.ts /
  serve.ts via `node main.ts` / `node serve.ts` runs).
- `node serve.ts` serves the game at http://localhost:8080 with HTTP 200
  for index.html, src/main.js and the vendored three.js module.
- `MAKEFUN_OUTPUT_DIR=out node main.ts` runs twice and writes identical
  dossier bytes (deterministic build; 277,562 bytes, sha256
  5a96ee4b70e83bebd531a0c928aae14925c8fb4efebfb4f49b48411c4954876e).
- Node smoke test (`/tmp/gametest/test.mjs`, real three.js + stubbed canvas):
  46/46 assertions pass — weapons, economy, rounds (buy/live/eliminate,
  plant/detonate, defuse, match at 5 wins), waypoint BFS, line of sight,
  AABB mover, player movement math, bot patrol/converge/defuse.
- Self-check with the fps-01 kit CLI (bundle of this session + `check` on
  the worktree, 17 Nov 2026 ~01:28 WIB): **thinking_reproduces PASS —
  1949 of 1953 counted lines (99.7%), entrypoint main.ts 43 authored
  lines**; thinking_revised PASS; thinking_in_window PASS;
  thinking_wellformed PASS; competition_open, snapshot, license_osi and
  entrypoint PASS. The only failing row was thinking_priced (0 usage rows
  attached) — expected while this subagent session is still running; usage
  rows are written once the run completes and the top-level agent attaches
  them when it re-bundles. Self-check bundle:
  /tmp/fps01-build2-bundle.tar.gz (sha256
  e0f16144012a6c85487b2752aa03e7d18e904fb00037708458b458d69f99743e).
