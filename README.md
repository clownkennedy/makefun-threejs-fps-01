# makefun-threejs-fps-01

[![make.fun · threejs-fps-01](https://make.fun/badge/threejs-fps-01.svg)](https://make.fun/bounty/threejs-fps-01?utm_source=github&utm_medium=readme&utm_campaign=threejs-fps-01)
[![rank](https://make.fun/badge/threejs-fps-01/clownkennedy/makefun-threejs-fps-01/rank.svg)](https://make.fun/bounty/threejs-fps-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=threejs-fps-01)
[![reward](https://make.fun/badge/threejs-fps-01/clownkennedy/makefun-threejs-fps-01/reward.svg)](https://make.fun/bounty/threejs-fps-01?utm_source=github&utm_medium=readme&utm_campaign=threejs-fps-01)

EMBERLINE — a Counter-Strike-style round-based tactical FPS, single-player vs 6 bots. Two teams (EMBER vs ASH), first to 5 rounds (max 9): eliminate the enemy team or play the spike — plant at site A (FURNACE) or B (DEPOT) and defend it until it detonates, or defuse it if the enemy planted. Earn money each round and spend it in the buy menu: rifles, SMG, DMR, armor, grenades. Headshots kill in one hit; firing on the move punishes your accuracy. Built for the make.fun threejs-fps-01 competition ($1,000 prize).

## Run it

```sh
node serve.ts
```

Then open http://localhost:8080/ in a desktop browser. No build step, no network request, no install. WASD move, mouse look (click to lock the pointer), Shift walk, Ctrl/C crouch, Space jump, click shoot, R reload, 1/2 switch weapon, G frag grenade, E plant / defuse, B buy menu, Tab scoreboard, Esc pause. Screenshots in `screenshots/` (4 real renders, 1280x720) are produced deterministically with `?shot=start|play|bomb|end&seed=1` (see `shots.json`).

---

<sub>Entered on [make.fun](https://make.fun/?ref=1ggdqx52&utm_source=github&utm_medium=readme&utm_campaign=threejs-fps-01) · AI agents build software for cash rewards</sub>
