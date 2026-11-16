# EMBERLINE

![threejs-fps-01](https://img.shields.io/badge/make.fun-threejs--fps--01-f0a830)
![three.js](https://img.shields.io/badge/three.js-0.187.0-000000)

A round-based tactical FPS built with three.js for the [make.fun](https://make.fun) competition **threejs-fps-01**.

Repository: `makefun-threejs-fps-01` · Ref: `1ggdqx52`

## The game

**EMBERLINE** is a Counter-Strike-style tactical shooter: you are the only
EMBER operative, up against six ASH bots defending the Ember Yard. First team
to win 5 rounds takes the match (max 9 rounds).

- **The map** — Ember Yard, a 44×36 m industrial yard with two bomb sites
  (A FURNACE and B DEPOT), a mid lane, and crates and pillars for cover.
- **The spike** — carry it to a site, hold **E** for 3 s to plant, then defend
  it for 35 s until it detonates. The bots will push in and try to defuse
  (5 s). No plant before the timer runs out and the defenders win the round.
- **The economy** — start with $800, earn for wins, kills and plants, and
  spend it in the buy phase (**B**) on SMGs, rifles, a DMR and armor.
- **The bots** — six ASH defenders that patrol the waypoint graph, engage on
  sight after a short aim delay, path around cover with BFS, and converge to
  defuse a planted spike.

## Controls

| Key | Action |
| --- | --- |
| W A S D | Move |
| Mouse | Look (pointer lock) |
| Click | Shoot |
| R | Reload |
| E | Plant / defuse (hold) |
| B | Buy menu |
| 1 / 2 | Switch weapon |
| G | Throw grenade |
| Tab | Scoreboard |
| Esc | Pause |

## Weapons

| Weapon | Price | Mag / Reserve | Damage | Fire gap |
| --- | --- | --- | --- | --- |
| P9 Sidearm | free | 12 / 36 | 26 | 0.16 s |
| Vex-9 SMG | $1,200 | 32 / 96 | 21 | 0.075 s |
| AR-77 Rifle | $2,700 | 30 / 90 | 34 | 0.10 s |
| Longshot DMR | $4,200 | 6 / 18 | 92 | 0.90 s |

Headshots multiply damage (×2, ×1.8 on the Vex-9). Armor ($650) absorbs half
the damage you take. One grenade per round, free.

## Run it

```sh
node serve.ts
# open http://localhost:8080
```

## Build

`main.ts` (Node 22, standard library only) copies `game/` and `screenshots/`
into the output directory and writes `dossier.json`:

```sh
MAKEFUN_OUTPUT_DIR=out node main.ts
```

## Layout

- `game/index.html` — page and HUD
- `game/src/main.js` — entry point, fixed-step loop, shooting, grenades
- `game/src/world.js` — the Ember Yard: geometry, collision, waypoints
- `game/src/player.js` — movement, look, weapons, planting
- `game/src/bots.js` — the six ASH bots
- `game/src/rounds.js` — round phases, spike timer, match score
- `game/src/economy.js` — money, buy menu, armor
- `game/src/weapons.js` — weapon table and view models
- `game/src/hud.js` — DOM HUD, minimap, scoreboard
- `game/src/audio.js` — WebAudio sound bank
- `game/src/input.js` — keyboard, mouse, pointer lock
- `game/src/palette.js` — the shared color palette
- `game/vendor/three/` — three.js 0.187.0 (vendored)

## License

MIT — see [LICENSE](LICENSE).
