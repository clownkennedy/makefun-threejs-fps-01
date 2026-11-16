// EMBERLINE — entry point. Wires the world, the player, the bots, the rounds
// and the HUD together and runs the fixed-step simulation loop.
// The game is a round-based tactical FPS: EMBER (you) versus six ASH bots.
import * as THREE from 'three';
import { PALETTE } from './palette.js';
import { createAudio } from './audio.js';
import { createInput } from './input.js';
import { createPlayer, EYE_HEIGHT } from './player.js';
import { WEAPONS } from './weapons.js';
import { createBots } from './bots.js';
import { createEconomy } from './economy.js';
import { createRounds, MATCH } from './rounds.js';
import { createHud } from './hud.js';
import { createWorld, makeMover, BLOCKS, SITES, SPAWNS } from './world.js';

const STEP = 1 / 60;
const WEAPON_KEYS = ['p9', 'vex9', 'ar77', 'longshot'];

export function startGame() {
  const container = document.getElementById('game');
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(PALETTE.canvas);
  scene.fog = new THREE.Fog(PALETTE.canvas, 30, 90);
  const camera = new THREE.PerspectiveCamera(78, window.innerWidth / window.innerHeight, 0.1, 200);
  camera.position.set(0, EYE_HEIGHT, 14);

  const hemi = new THREE.HemisphereLight(0xdfe8ff, 0x2a2620, 1.15);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xffe0b3, 1.1);
  sun.position.set(18, 26, 10);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -30;
  sun.shadow.camera.right = 30;
  sun.shadow.camera.top = 30;
  sun.shadow.camera.bottom = -30;
  scene.add(sun);
  const fill = new THREE.DirectionalLight(0x8fb3ff, 0.65);
  fill.position.set(-14, 18, -12);
  scene.add(fill);

  const world = createWorld(scene);
  const mover = makeMover(BLOCKS, 0.35);
  const input = createInput(renderer.domElement);
  const audio = createAudio();
  const economy = createEconomy();
  const hud = createHud();

  const player = createPlayer(camera, mover, input, economy);
  const bots = createBots(scene, mover, BLOCKS);

  const state = {
    started: false,
    kills: 0,
    deaths: 0,
    buyOpen: false,
    prevAttack: false,
    beepLeft: 0,
    minimapLeft: 0,
    grenades: [],
    tracers: [],
    flashes: [],
  };

  const raycaster = new THREE.Raycaster();

  function botHitMeshes() {
    const list = [];
    for (const b of bots.bots) {
      if (!b.alive) continue;
      list.push({ mesh: b.body, bot: b, part: 'body' });
      list.push({ mesh: b.head, bot: b, part: 'head' });
    }
    return list;
  }

  function addTracer(from, to) {
    const geo = new THREE.BufferGeometry().setFromPoints([from, to]);
    const mat = new THREE.LineBasicMaterial({ color: PALETTE.tracer, transparent: true, opacity: 0.9 });
    const line = new THREE.Line(geo, mat);
    scene.add(line);
    state.tracers.push({ line, age: 0 });
  }

  function addFlash(pos, size, color) {
    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(1, 16, 12),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.85 }),
    );
    mesh.position.copy(pos);
    mesh.scale.setScalar(0.2);
    scene.add(mesh);
    state.flashes.push({ mesh, age: 0, size });
  }

  function playerShoot() {
    const def = player.weaponDef;
    const weapon = player.weapon;
    if (!weapon.ready()) {
      if (weapon.state.mag === 0 && weapon.state.reloadLeft === 0) audio.dryFire();
      return;
    }
    weapon.takeRound();
    const spread = weapon.spread(player.speed());
    const dir = new THREE.Vector3();
    camera.getWorldDirection(dir);
    const right = new THREE.Vector3().crossVectors(dir, camera.up).normalize();
    const up = new THREE.Vector3().crossVectors(right, dir).normalize();
    const jx = (Math.random() * 2 - 1) * spread;
    const jy = (Math.random() * 2 - 1) * spread;
    dir.addScaledVector(right, jx).addScaledVector(up, jy).normalize();
    const origin = camera.position.clone();
    raycaster.set(origin, dir);
    raycaster.far = def.range;
    const targets = botHitMeshes().map((t) => t.mesh);
    const hits = raycaster.intersectObjects(targets, false);
    const muzzle = origin.clone().addScaledVector(dir, 0.6);
    muzzle.y -= 0.12;
    let end = origin.clone().addScaledVector(dir, def.range);
    if (hits.length) {
      const hit = hits[0];
      end = hit.point.clone();
      const entry = botHitMeshes().find((t) => t.mesh === hit.object);
      if (entry) {
        const isHead = entry.part === 'head';
        const dmg = def.damage * (isHead ? def.headMul : 1);
        const killed = bots.damageBot(entry.bot, dmg);
        hud.hitmarker();
        audio.hit();
        if (killed) {
          state.kills += 1;
          economy.addKill();
          audio.kill();
          hud.killfeed('YOU', entry.bot.name, def.name, isHead);
        }
      }
    }
    addTracer(muzzle, end);
    audio.shoot(def.kind);
  }

  function throwGrenade() {
    if (economy.state.grenades <= 0) return;
    economy.state.grenades -= 1;
    const dir = new THREE.Vector3();
    camera.getWorldDirection(dir);
    const vel = dir.multiplyScalar(11);
    vel.y += 5;
    state.grenades.push({
      pos: camera.position.clone(),
      vel,
      fuse: 1.2,
    });
    audio.grenadeThrow();
  }

  function explodeGrenade(g) {
    const pos = g.pos.clone();
    pos.y = Math.max(0.15, pos.y);
    addFlash(pos, 6, 0xffb347);
    audio.explosion();
    for (const b of bots.bots) {
      if (!b.alive) continue;
      const d = Math.hypot(b.pos.x - pos.x, b.pos.z - pos.z);
      if (d < 6) {
        const dmg = Math.round(110 * (1 - d / 6));
        if (bots.damageBot(b, dmg)) {
          state.kills += 1;
          economy.addKill();
          audio.kill();
          hud.killfeed('YOU', b.name, 'Grenade', false);
        }
      }
    }
  }

  function stepGrenades(dt) {
    for (let i = state.grenades.length - 1; i >= 0; i--) {
      const g = state.grenades[i];
      g.vel.y -= 18 * dt;
      g.pos.addScaledVector(g.vel, dt);
      if (g.pos.y < 0.1) {
        g.pos.y = 0.1;
        g.vel.y *= -0.4;
        g.vel.x *= 0.7;
        g.vel.z *= 0.7;
      }
      g.fuse -= dt;
      if (g.fuse <= 0) {
        explodeGrenade(g);
        state.grenades.splice(i, 1);
      }
    }
  }

  function stepFx(dt) {
    for (let i = state.tracers.length - 1; i >= 0; i--) {
      const t = state.tracers[i];
      t.age += dt;
      t.line.material.opacity = Math.max(0, 0.9 - t.age * 9);
      if (t.age > 0.1) {
        scene.remove(t.line);
        t.line.geometry.dispose();
        t.line.material.dispose();
        state.tracers.splice(i, 1);
      }
    }
    for (let i = state.flashes.length - 1; i >= 0; i--) {
      const f = state.flashes[i];
      f.age += dt;
      const k = Math.min(1, f.age / 0.45);
      f.mesh.scale.setScalar(0.2 + k * f.size);
      f.mesh.material.opacity = 0.85 * (1 - k);
      if (k >= 1) {
        scene.remove(f.mesh);
        f.mesh.geometry.dispose();
        f.mesh.material.dispose();
        state.flashes.splice(i, 1);
      }
    }
  }

  function nearSiteIndex() {
    for (let i = 0; i < SITES.length; i++) {
      const dx = player.pos.x - SITES[i].x;
      const dz = player.pos.z - SITES[i].z;
      if (Math.hypot(dx, dz) < SITES[i].r) return i;
    }
    return -1;
  }

  function nearSpike() {
    const plant = rounds.state.plant;
    if (plant.state !== 'planted') return false;
    const site = SITES[plant.siteIndex];
    return Math.hypot(player.pos.x - site.x, player.pos.z - site.z) < 2.5;
  }

  function scoreboardRows() {
    const rows = [{
      name: 'YOU', team: 'EMBER', kills: state.kills, deaths: state.deaths, money: economy.state.money,
    }];
    for (const b of bots.bots) {
      rows.push({ name: b.name, team: 'ASH', kills: b.kills, deaths: b.deaths, money: 0 });
    }
    return rows;
  }

  function onBuy(kind, id) {
    if (rounds.state.phase !== 'buy') return;
    let ok = false;
    if (kind === 'weapon') ok = player.buyAndEquip(id);
    else if (kind === 'armor') ok = economy.buyArmor();
    if (ok) audio.buy();
    else audio.denied();
    hud.setMoney(economy.state.money);
    hud.setAmmo(player.weapon.state.mag, player.weapon.state.reserve, player.weaponDef.name, economy.state.grenades);
  }

  const rounds = createRounds({
    onRoundStart(n) {
      player.spawnAt(SPAWNS.ember[(n - 1) % SPAWNS.ember.length]);
      player.refillAmmo();
      bots.spawnAll(SPAWNS.ash);
      economy.startRound();
      state.grenades = [];
      hud.setRound(n);
      hud.setScore(rounds.state.scoreEmber, rounds.state.scoreAsh);
      hud.setMoney(economy.state.money);
      hud.setAmmo(player.weapon.state.mag, player.weapon.state.reserve, player.weaponDef.name, economy.state.grenades);
      hud.setHealth(player.health, economy.state.armor);
      hud.bombBanner(null);
      hud.plantBar(null);
      hud.hideScoreboard();
      hud.banner('ROUND ' + n, n === 1 ? 'First to 5 rounds takes the match' : '', 2200);
      if (state.started) {
        state.buyOpen = true;
        hud.showBuyMenu(onBuy);
      }
    },
    onLive() {
      state.buyOpen = false;
      hud.hideBuyMenu();
    },
    onRoundEnd(winner, reason, score) {
      economy.endRound(winner === 'ember');
      hud.setScore(score.ember, score.ash);
      hud.setMoney(economy.state.money);
      hud.hideBuyMenu();
      state.buyOpen = false;
      hud.banner(winner === 'ember' ? 'ROUND WON' : 'ROUND LOST', reason, 3000);
      if (winner === 'ember') audio.roundWin();
      else audio.roundLose();
    },
    onMatchEnd(winner, score) {
      hud.hideBuyMenu();
      input.exitLock();
      hud.setPlaying(false);
      hud.overlay(true, winner === 'ember' ? 'VICTORY' : 'DEFEAT',
        'EMBER ' + score.ember + ' — ' + score.ash + ' ASH · Click to play again');
      if (winner === 'ember') audio.matchWin();
      else audio.roundLose();
    },
    onPlanted(siteIndex) {
      hud.bombBanner('SPIKE PLANTED — SITE ' + SITES[siteIndex].name);
      audio.planted();
      state.beepLeft = 0;
    },
    onDetonated() {
      const site = SITES[rounds.state.plant.siteIndex];
      addFlash(new THREE.Vector3(site.x, 1, site.z), 9, 0xff7733);
      audio.explosion();
      hud.bombBanner(null);
      hud.plantBar(null);
    },
    onDefused() {
      audio.defused();
      hud.bombBanner(null);
      hud.plantBar(null);
    },
  });

  function resetMatch() {
    economy.reset();
    player.reset();
    bots.reset();
    state.kills = 0;
    state.deaths = 0;
    rounds.reset();
    hud.setScore(0, 0);
    hud.setMoney(economy.state.money);
  }

  function stepSim(dt) {
    // The simulation only runs after the player clicks play; before that the
    // overlay is up and the buy timer must not tick down.
    if (!state.started) return;
    const phase = rounds.state.phase;
    const canMove = state.started && player.alive && phase !== 'matchEnd';
    const attack = input.attack;

    // Semi-auto weapons fire on the press edge; automatics fire while held.
    if (canMove && phase === 'live' && player.alive) {
      const def = player.weaponDef;
      if (def.auto) {
        if (attack) playerShoot();
      } else if (attack && !state.prevAttack) {
        playerShoot();
      }
    }
    state.prevAttack = attack;

    if (canMove && input.pressed('KeyR') && player.weapon.reload()) audio.reload();
    if (canMove && phase === 'live' && input.pressed('KeyG')) throwGrenade();

    if (phase === 'buy') {
      WEAPON_KEYS.forEach((id, i) => {
        if (input.pressed('Digit' + (i + 1))) onBuy('weapon', id);
      });
      if (input.pressed('KeyA')) onBuy('armor');
      if (input.pressed('KeyB')) {
        state.buyOpen = !state.buyOpen;
        if (state.buyOpen) hud.showBuyMenu(onBuy);
        else hud.hideBuyMenu();
      }
    }

    player.step(dt, {
      phase,
      canMove,
      onStep: () => audio.step(),
      nearSite: nearSiteIndex(),
      plantState: rounds.state.plant.state,
      nearSpike: nearSpike(),
      onPlantTick: (p) => hud.plantBar(p),
      onPlantDone: (siteIndex) => {
        if (rounds.plant(siteIndex, player)) {
          economy.addPlant();
          hud.setMoney(economy.state.money);
        }
      },
      onDefuseTick: (p) => hud.plantBar(p),
      onDefuseDone: () => { rounds.defuse(); },
    });

    bots.step(dt, {
      playerPos: player.pos,
      playerAlive: player.alive,
      playerSpeed: player.speed(),
      phase,
      plantState: rounds.state.plant.state,
      plantSite: rounds.state.plant.state === 'planted' ? SITES[rounds.state.plant.siteIndex] : null,
      onBotShot: (bot, hit, headshot) => {
        const from = bot.pos.clone();
        from.y = 1.15;
        const to = player.pos.clone();
        addTracer(from, to);
        if (!hit || !player.alive) return;
        const dmg = bot.weaponDef.damage * (headshot ? bot.weaponDef.headMul : 1);
        player.damage(dmg);
        hud.damageFlash();
        audio.hurt();
        hud.setHealth(player.health, economy.state.armor);
        if (!player.alive) {
          bot.kills += 1;
          state.deaths += 1;
          hud.killfeed(bot.name, 'YOU', bot.weaponDef.name, headshot);
        }
      },
      onDefuseTick: (bot, p) => hud.plantBar(p),
      onDefuseDone: () => { rounds.defuse(); },
    });

    stepGrenades(dt);
    stepFx(dt);

    rounds.step(dt, {
      ember: player.alive ? 1 : 0,
      ash: bots.aliveCount(),
    });

    // HUD timer + beeps while the spike is planted.
    const rs = rounds.state;
    if (rs.phase === 'buy') hud.setTimer('BUY ' + Math.ceil(rs.timer), false);
    else if (rs.phase === 'live') {
      if (rs.plant.state === 'planted') {
        hud.setTimer('💣 ' + Math.ceil(rs.plant.timer), true);
        state.beepLeft -= dt;
        if (state.beepLeft <= 0) {
          audio.beep();
          state.beepLeft = 0.8;
        }
      } else {
        hud.setTimer(String(Math.ceil(rs.timer)), rs.timer < 10);
      }
    } else {
      hud.setTimer('—', false);
    }
    hud.setHealth(player.health, economy.state.armor);
    hud.setAmmo(player.weapon.state.mag, player.weapon.state.reserve, player.weaponDef.name, economy.state.grenades);
    const spreadPx = 4 + player.weapon.spread(player.speed()) * 900;
    hud.setCrosshairGap(Math.min(22, spreadPx));

    state.minimapLeft -= dt;
    if (state.minimapLeft <= 0) {
      hud.drawMinimap(player, bots.bots);
      state.minimapLeft = 0.15;
    }
    if (input.down('Tab')) hud.showScoreboard(scoreboardRows());
    else hud.hideScoreboard();
  }

  function render() {
    renderer.render(scene, camera);
  }

  let last = performance.now();
  let acc = 0;
  function frame(now) {
    requestAnimationFrame(frame);
    let dt = (now - last) / 1000;
    last = now;
    if (dt > 0.25) dt = 0.25;
    acc += dt;
    let steps = 0;
    while (acc >= STEP && steps < 5) {
      stepSim(STEP);
      acc -= STEP;
      steps += 1;
    }
    render();
  }

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  const playBtn = document.getElementById('play');
  if (playBtn) {
    playBtn.addEventListener('click', () => {
      audio.unlock();
      if (rounds.state.phase === 'matchEnd') resetMatch();
      if (!state.started) {
        state.started = true;
        rounds.startRound();
      }
      hud.overlay(false);
      hud.setPlaying(true);
      input.requestLock();
    });
  }
  input.onLockChange = (locked) => {
    if (!locked && state.started && rounds.state.phase !== 'matchEnd') {
      hud.overlay(true, 'EMBERLINE', 'Paused — click to resume the match.');
      hud.setPlaying(true);
    }
  };

  hud.setScore(0, 0);
  hud.setMoney(economy.state.money);
  hud.setHealth(100, 0);
  hud.setAmmo(12, 36, 'P9 Sidearm', 1);
  hud.setRound(1);
  hud.setTimer('BUY 12', false);
  hud.overlay(true, 'EMBERLINE', 'Round-based tactical FPS in the Ember Yard. Plant the spike at Furnace or Depot — or eliminate the ASH team. First to 5 rounds takes the match.');
  hud.drawMinimap(player, bots.bots);
  requestAnimationFrame(frame);

  window.__game = {
    player,
    bots,
    rounds,
    economy,
    camera,
    scene,
    input,
    state,
    teleport(x, z) { player.pos.set(x, EYE_HEIGHT, z); },
    hurt(n) { player.damage(n); },
    killBot(i) { const b = bots.bots[i]; if (b) bots.damageBot(b, 9999); },
    plant(siteIndex) { rounds.plant(siteIndex, player); },
  };
  window.__shotReady = true;
  return window.__game;
}

startGame();
