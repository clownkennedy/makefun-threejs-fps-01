// The player: first-person movement, camera, health and weapons.
// Movement is a simple accelerate/friction model on the ground plane;
// shooting and damage are owned by main.js, this module owns the body.
import * as THREE from 'three';
import { WEAPONS, createWeaponState, createViewModel, ARMOR_AMOUNT } from './weapons.js';
import { MATCH } from './rounds.js';

export const EYE_HEIGHT = 1.6;
export const PLAYER_RADIUS = 0.35;
export const WALK_SPEED = 5.2;
export const LOOK_SENS = 0.0023;

export function createPlayer(camera, mover, input, economy) {
  const pos = new THREE.Vector3(0, EYE_HEIGHT, 14);
  const vel = new THREE.Vector3();
  let yaw = 0;
  let pitch = 0;
  let health = 100;
  let alive = true;
  let weaponId = 'p9';
  let weapon = createWeaponState(WEAPONS.p9);
  let viewModel = createViewModel(camera, 'pistol');
  let plantProgress = 0;
  let defuseProgress = 0;
  let planting = false;
  let defusing = false;
  let stepAcc = 0;

  function spawnAt(spawn) {
    pos.set(spawn.x, EYE_HEIGHT, spawn.z);
    vel.set(0, 0, 0);
    yaw = spawn.z > 0 ? 0 : Math.PI;
    pitch = 0;
    health = 100;
    alive = true;
    plantProgress = 0;
    defuseProgress = 0;
    planting = false;
    defusing = false;
  }

  function equip(id) {
    if (!WEAPONS[id] || !economy.state.owned.has(id)) return false;
    if (id === weaponId) return true;
    weaponId = id;
    weapon = createWeaponState(WEAPONS[id]);
    camera.remove(viewModel.group);
    viewModel = createViewModel(camera, WEAPONS[id].kind);
    return true;
  }

  function buyAndEquip(id) {
    if (economy.buyWeapon(id)) return equip(id);
    return false;
  }

  function damage(amount) {
    if (!alive) return 0;
    const through = economy.absorb(amount);
    health -= through;
    if (health <= 0) {
      health = 0;
      alive = false;
    }
    return through;
  }

  function step(dt, ctx) {
    // ctx: { phase, canMove, onStep, onShoot, onReload }
    const look = input.takeLook();
    yaw -= look.dx * LOOK_SENS;
    pitch -= look.dy * LOOK_SENS;
    pitch = Math.max(-1.5, Math.min(1.5, pitch));
    camera.rotation.order = 'YXZ';
    camera.rotation.y = yaw;
    camera.rotation.x = pitch;

    let fx = 0;
    let fz = 0;
    if (ctx.canMove) {
      if (input.down('KeyW')) fz -= 1;
      if (input.down('KeyS')) fz += 1;
      if (input.down('KeyA')) fx -= 1;
      if (input.down('KeyD')) fx += 1;
    }
    const len = Math.hypot(fx, fz) || 1;
    fx /= len;
    fz /= len;
    const sin = Math.sin(yaw);
    const cos = Math.cos(yaw);
    const wx = fx * cos + fz * sin;
    const wz = -fx * sin + fz * cos;
    const accel = 42;
    vel.x += wx * accel * dt;
    vel.z += wz * accel * dt;
    const damp = Math.max(0, 1 - 9 * dt);
    vel.x *= damp;
    vel.z *= damp;
    const speed = Math.hypot(vel.x, vel.z);
    if (speed > WALK_SPEED) {
      vel.x *= WALK_SPEED / speed;
      vel.z *= WALK_SPEED / speed;
    }
    mover.move(pos, vel.x * dt, vel.z * dt);
    camera.position.set(pos.x, EYE_HEIGHT, pos.z);

    if (speed > 1.5 && ctx.canMove) {
      stepAcc += dt * speed;
      if (stepAcc > 2.4) {
        stepAcc = 0;
        if (ctx.onStep) ctx.onStep();
      }
    }

    weapon.step(dt);
    viewModel.step(dt);

    // Plant / defuse progress while E is held near the objective.
    planting = false;
    defusing = false;
    if (ctx.canMove && ctx.phase === 'live' && input.down('KeyE')) {
      if (ctx.nearSite >= 0 && ctx.plantState === 'none') {
        planting = true;
        plantProgress += dt;
        if (ctx.onPlantTick) ctx.onPlantTick(plantProgress / MATCH.plantTime);
        if (plantProgress >= MATCH.plantTime) {
          plantProgress = 0;
          if (ctx.onPlantDone) ctx.onPlantDone(ctx.nearSite);
        }
      } else if (ctx.plantState === 'planted' && ctx.nearSpike) {
        defusing = true;
        defuseProgress += dt;
        if (ctx.onDefuseTick) ctx.onDefuseTick(defuseProgress / MATCH.defuseTime);
        if (defuseProgress >= MATCH.defuseTime) {
          defuseProgress = 0;
          if (ctx.onDefuseDone) ctx.onDefuseDone();
        }
      }
    }
    if (!planting) plantProgress = 0;
    if (!defusing) defuseProgress = 0;
  }

  return {
    pos,
    vel,
    get yaw() { return yaw; },
    get pitch() { return pitch; },
    get health() { return health; },
    get alive() { return alive; },
    get weaponId() { return weaponId; },
    get weapon() { return weapon; },
    get weaponDef() { return WEAPONS[weaponId]; },
    get planting() { return planting; },
    get defusing() { return defusing; },
    get plantProgress() { return plantProgress; },
    get defuseProgress() { return defuseProgress; },
    spawnAt,
    equip,
    buyAndEquip,
    damage,
    step,
    speed() { return Math.hypot(vel.x, vel.z); },
    reset() {
      health = 100;
      alive = true;
      weaponId = 'p9';
      weapon = createWeaponState(WEAPONS.p9);
      camera.remove(viewModel.group);
      viewModel = createViewModel(camera, 'pistol');
    },
    refillAmmo() { weapon.refill(); },
    setArmorFull() { economy.state.armor = ARMOR_AMOUNT; },
  };
}
