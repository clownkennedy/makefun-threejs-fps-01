// The ASH bots: six defenders that patrol the waypoint graph, engage the
// player on sight, and converge to defuse the spike once it is planted.
// A bot shot is a probability roll, not a hitscan: its chance to hit falls
// with distance and with the target's movement, after an aim delay on
// first sight of a new target.
import * as THREE from 'three';
import { PALETTE } from './palette.js';
import { WEAPONS } from './weapons.js';
import { WAYPOINTS, nearestNode, findPath, hasLineOfSight } from './world.js';

const BOT_HP = 100;
const BOT_SPEED = 3.6;
const BOT_RADIUS = 0.35;
const AIM_MIN = 0.6;
const AIM_MAX = 1.1;
const VIEW_DIST = 40;
const FOV_COS = 0.5;

function makeBotMesh() {
  const group = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({ color: PALETTE.botBody, roughness: 0.8, metalness: 0.1 });
  const headMat = new THREE.MeshStandardMaterial({ color: PALETTE.botHead, roughness: 0.7, metalness: 0.1 });
  const visorMat = new THREE.MeshStandardMaterial({ color: PALETTE.botVisor, roughness: 0.3, metalness: 0.6, emissive: PALETTE.botVisor, emissiveIntensity: 0.5 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.95, 0.36), bodyMat);
  body.position.y = 0.85;
  body.name = 'body';
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.36, 0.42), headMat);
  head.position.y = 1.55;
  head.name = 'head';
  const visor = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.1, 0.05), visorMat);
  visor.position.set(0, 1.58, 0.22);
  visor.name = 'visor';
  const gun = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.12, 0.62), bodyMat);
  gun.position.set(0.28, 1.05, 0.3);
  gun.name = 'gun';
  group.add(body, head, visor, gun);
  group.traverse((o) => { o.castShadow = true; });
  return { group, body, head };
}

export function createBots(scene, mover, blocks) {
  const bots = [];
  for (let i = 0; i < 6; i++) {
    const { group, body, head } = makeBotMesh();
    scene.add(group);
    bots.push({
      id: i,
      name: 'Ash-' + (i + 1),
      group, body, head,
      pos: new THREE.Vector3(0, 0, -14),
      yaw: 0,
      hp: BOT_HP,
      alive: true,
      weaponDef: WEAPONS.ar77,
      node: 13,
      path: [],
      pathIdx: 0,
      target: null,
      aimLeft: 0,
      shootLeft: 0,
      seenPlayer: false,
      stuckTime: 0,
      lastPos: new THREE.Vector3(),
      defusing: false,
      defuseLeft: 0,
      kills: 0,
      deaths: 0,
    });
  }

  function spawnAll(spawns) {
    for (let i = 0; i < bots.length; i++) {
      const b = bots[i];
      const s = spawns[i % spawns.length];
      b.pos.set(s.x, 0, s.z);
      b.group.position.copy(b.pos);
      b.yaw = Math.PI;
      b.hp = BOT_HP;
      b.alive = true;
      b.node = nearestNode(s.x, s.z);
      b.path = [];
      b.pathIdx = 0;
      b.target = null;
      b.aimLeft = 0;
      b.shootLeft = 0;
      b.seenPlayer = false;
      b.stuckTime = 0;
      b.lastPos.copy(b.pos);
      b.defusing = false;
      b.defuseLeft = 0;
      b.group.visible = true;
    }
  }

  function pickPatrolTarget(b) {
    const links = WAYPOINTS[b.node].links;
    const next = links[Math.floor(Math.random() * links.length)];
    b.path = findPath(b.node, next);
    b.pathIdx = 0;
  }

  function step(dt, ctx) {
    // ctx: { playerPos, playerAlive, playerSpeed, phase, plantState, plantSite, onBotShot, onBotKillPlayer, onDefuseTick, onDefuseDone }
    for (const b of bots) {
      if (!b.alive) continue;
      const toPlayer = new THREE.Vector3().subVectors(ctx.playerPos, b.pos);
      toPlayer.y = 0;
      const dist = toPlayer.length();
      const canSee = ctx.playerAlive && dist < VIEW_DIST && hasLineOfSight(
        { x: b.pos.x, z: b.pos.z }, { x: ctx.playerPos.x, z: ctx.playerPos.z }, blocks);
      const facing = new THREE.Vector3(-Math.sin(b.yaw), 0, -Math.cos(b.yaw));
      const inFront = canSee && (dist < 3 || facing.dot(toPlayer.clone().normalize()) > FOV_COS);

      // Defuse duty overrides everything once the spike is planted.
      if (ctx.phase === 'live' && ctx.plantState === 'planted' && ctx.plantSite) {
        const site = ctx.plantSite;
        const dSite = Math.hypot(site.x - b.pos.x, site.z - b.pos.z);
        if (dSite < 2.2) {
          if (!b.defusing) { b.defusing = true; b.defuseLeft = 5; }
          b.defuseLeft -= dt;
          b.yaw = Math.atan2(-(site.x - b.pos.x), -(site.z - b.pos.z));
          b.group.rotation.y = b.yaw;
          if (ctx.onDefuseTick) ctx.onDefuseTick(b, 1 - b.defuseLeft / 5);
          if (b.defuseLeft <= 0) {
            b.defusing = false;
            if (ctx.onDefuseDone) ctx.onDefuseDone(b);
          }
          continue;
        }
        b.defusing = false;
        // Walk toward the planted site via the waypoint graph.
        const targetNode = nearestNode(site.x, site.z);
        if (!b.path.length || b.path[b.path.length - 1] !== targetNode) {
          b.path = findPath(b.node, targetNode);
          b.pathIdx = 0;
        }
        walkPath(b, dt);
        continue;
      }
      b.defusing = false;

      if (inFront) {
        // Face the player and shoot after the aim delay.
        const wantYaw = Math.atan2(-toPlayer.x, -toPlayer.z);
        b.yaw = wantYaw;
        if (!b.seenPlayer) {
          b.seenPlayer = true;
          b.aimLeft = AIM_MIN + Math.random() * (AIM_MAX - AIM_MIN);
          b.shootLeft = 0;
        }
        if (b.aimLeft > 0) {
          b.aimLeft -= dt;
        } else {
          b.shootLeft -= dt;
          if (b.shootLeft <= 0) {
            b.shootLeft = b.weaponDef.fireGap * 2.2;
            const spread = b.weaponDef.spreadStill + Math.min(1, ctx.playerSpeed / 5.2) * b.weaponDef.spreadMove;
            const angularSize = Math.atan(0.32 / Math.max(1, dist));
            const hitP = Math.max(0.06, Math.min(0.85, (angularSize / Math.max(spread, 0.004)) * 0.55));
            const hit = Math.random() < hitP;
            const headshot = hit && Math.random() < 0.14;
            if (ctx.onBotShot) ctx.onBotShot(b, hit, headshot);
          }
        }
      } else {
        b.seenPlayer = false;
        b.aimLeft = 0;
        // Patrol: follow the current path, pick a new leg when it ends.
        if (!b.path.length || b.pathIdx >= b.path.length) pickPatrolTarget(b);
        walkPath(b, dt);
      }

      b.group.position.copy(b.pos);
      b.group.rotation.y = b.yaw;
    }
  }

  function walkPath(b, dt) {
    if (!b.path.length || b.pathIdx >= b.path.length) return;
    const node = WAYPOINTS[b.path[b.pathIdx]];
    const dx = node.x - b.pos.x;
    const dz = node.z - b.pos.z;
    const d = Math.hypot(dx, dz);
    if (d < 0.4) {
      b.node = b.path[b.pathIdx];
      b.pathIdx += 1;
      b.stuckTime = 0;
      b.lastPos.copy(b.pos);
      return;
    }
    const stepLen = BOT_SPEED * dt;
    const mx = (dx / d) * stepLen;
    const mz = (dz / d) * stepLen;
    mover.move(b.pos, mx, mz);
    b.yaw = Math.atan2(-dx, -dz);
    // Stuck detector: no real progress for 1.2 s -> skip this node.
    if (b.pos.distanceTo(b.lastPos) < 0.02) {
      b.stuckTime += dt;
      if (b.stuckTime > 1.2) {
        b.node = b.path[b.pathIdx];
        b.pathIdx += 1;
        b.stuckTime = 0;
      }
    } else {
      b.stuckTime = 0;
    }
    b.lastPos.copy(b.pos);
    b.group.position.copy(b.pos);
    b.group.rotation.y = b.yaw;
  }

  function damageBot(b, amount) {
    if (!b.alive) return false;
    b.hp -= amount;
    if (b.hp <= 0) {
      b.hp = 0;
      b.alive = false;
      b.group.visible = false;
      b.deaths += 1;
      return true;
    }
    return false;
  }

  return {
    bots,
    spawnAll,
    step,
    damageBot,
    aliveCount() { return bots.filter((b) => b.alive).length; },
    reset() { for (const b of bots) { b.kills = 0; b.deaths = 0; } },
  };
}
