// The Ember Yard: a 44 x 36 metre arena with two bomb sites, cover and a
// waypoint graph the bots patrol on. All collision is axis-aligned boxes;
// movement resolves per axis so players slide along walls instead of sticking.
import * as THREE from 'three';
import { PALETTE } from './palette.js';

export const ARENA = { halfX: 22, halfZ: 18, wallH: 4 };

export const SITES = [
  { name: 'A', label: 'FURNACE', x: -15, z: -9, r: 3.5, color: PALETTE.siteA },
  { name: 'B', label: 'DEPOT', x: 15, z: -9, r: 3.5, color: PALETTE.siteB },
];

export const SPAWNS = {
  ember: [
    { x: -6, z: 14 }, { x: 0, z: 15 }, { x: 6, z: 14 },
    { x: -12, z: 12 }, { x: 12, z: 12 }, { x: 0, z: 11 },
  ],
  ash: [
    { x: -6, z: -14 }, { x: 0, z: -15 }, { x: 6, z: -14 },
    { x: -12, z: -12 }, { x: 12, z: -12 }, { x: 0, z: -11 },
  ],
};

// Waypoint nodes the bots walk between. Each node lists its neighbours;
// the graph covers both sites, mid and both spawns, with bypasses around
// the big cover blocks so no route dead-ends inside geometry.
export const WAYPOINTS = [
  { x: -6, z: 14, links: [1, 3] },       // 0 ember spawn west
  { x: 6, z: 14, links: [0, 2] },        // 1 ember spawn east
  { x: 0, z: 11, links: [1, 3, 4] },     // 2 ember spawn mid
  { x: -11, z: 6, links: [0, 2, 5] },    // 3 west lane south
  { x: 11, z: 6, links: [1, 2, 6] },     // 4 east lane south
  { x: -14, z: -2, links: [3, 7, 9] },   // 5 west lane
  { x: 14, z: -2, links: [4, 8, 10] },   // 6 east lane
  { x: -15, z: -9, links: [5, 9] },      // 7 site A
  { x: 15, z: -9, links: [6, 10] },      // 8 site B
  { x: -6, z: -6, links: [5, 7, 11] },   // 9 mid west
  { x: 6, z: -6, links: [6, 8, 11] },    // 10 mid east
  { x: 0, z: -5, links: [9, 10, 12] },   // 11 mid
  { x: 0, z: -11, links: [11, 13, 14] }, // 12 ash approach
  { x: -6, z: -14, links: [12, 14] },    // 13 ash spawn west
  { x: 6, z: -14, links: [12, 13] },     // 14 ash spawn east
];

// Cover blocks: {x0, z0, x1, z1, h} axis-aligned boxes. The four walls are
// added by createWorld; these are the interior blocks.
export const BLOCKS = [
  { x0: -21, z0: -4, x1: -18, z1: 2, h: 2.2 },    // west mid crate
  { x0: 18, z0: -4, x1: 21, z1: 2, h: 2.2 },     // east mid crate
  { x0: -8, z0: -1, x1: -5, z1: 2, h: 1.6 },     // mid west low crate
  { x0: 5, z0: -1, x1: 8, z1: 2, h: 1.6 },       // mid east low crate
  { x0: -17, z0: -13, x1: -13, z1: -11, h: 2.6 },// site A stack
  { x0: 13, z0: -13, x1: 17, z1: -11, h: 2.6 },  // site B stack
  { x0: -3, z0: -14, x1: 3, z1: -12, h: 2.2 },   // north centre block
  { x0: -12, z0: 8, x1: -9, z1: 11, h: 1.8 },    // south west crate
  { x0: 9, z0: 8, x1: 12, z1: 11, h: 1.8 },      // south east crate
  { x0: -2, z0: 4, x1: 2, z1: 6, h: 3.0 },       // mid pillar
];

function pointInBlock(x, z, b, pad) {
  return x > b.x0 - pad && x < b.x1 + pad && z > b.z0 - pad && z < b.z1 + pad;
}

export function makeMover(blocks, radius) {
  const all = blocks;
  function blocked(x, z) {
    if (Math.abs(x) > ARENA.halfX - radius - 0.5) return true;
    if (Math.abs(z) > ARENA.halfZ - radius - 0.5) return true;
    for (const b of all) {
      if (pointInBlock(x, z, b, radius)) return true;
    }
    return false;
  }
  return {
    blocked,
    // Move a circle step by step, axis by axis, so it slides along walls.
    move(pos, dx, dz) {
      const nx = pos.x + dx;
      if (!blocked(nx, pos.z)) pos.x = nx;
      const nz = pos.z + dz;
      if (!blocked(pos.x, nz)) pos.z = nz;
    },
  };
}

// Line of sight between two points at eye height: sample the segment and
// report blocked when a tall-enough block crosses it.
export function hasLineOfSight(a, b, blocks, eyeH = 1.4) {
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  const dist = Math.hypot(dx, dz);
  const steps = Math.max(1, Math.ceil(dist / 0.5));
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    const x = a.x + dx * t;
    const z = a.z + dz * t;
    for (const blk of blocks) {
      if (blk.h >= 1.2 && pointInBlock(x, z, blk, 0)) return false;
    }
  }
  return true;
}

export function nearestNode(x, z) {
  let best = 0;
  let bestD = Infinity;
  for (let i = 0; i < WAYPOINTS.length; i++) {
    const d = (WAYPOINTS[i].x - x) ** 2 + (WAYPOINTS[i].z - z) ** 2;
    if (d < bestD) { bestD = d; best = i; }
  }
  return best;
}

// Breadth-first path over the waypoint graph, as a list of node indices.
export function findPath(from, to) {
  if (from === to) return [to];
  const prev = new Array(WAYPOINTS.length).fill(-1);
  const queue = [from];
  prev[from] = from;
  while (queue.length) {
    const cur = queue.shift();
    for (const nb of WAYPOINTS[cur].links) {
      if (prev[nb] === -1) {
        prev[nb] = cur;
        if (nb === to) {
          const path = [to];
          let n = to;
          while (n !== from) { n = prev[n]; path.unshift(n); }
          return path;
        }
        queue.push(nb);
      }
    }
  }
  return [to];
}

export function createWorld(scene) {
  const group = new THREE.Group();
  const groundMat = new THREE.MeshStandardMaterial({ color: PALETTE.ground, roughness: 0.95, metalness: 0 });
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(ARENA.halfX * 2 + 2, ARENA.halfZ * 2 + 2), groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  group.add(ground);

  // Faint grid lines painted onto a canvas texture so the floor reads.
  const gridCanvas = document.createElement('canvas');
  gridCanvas.width = 256;
  gridCanvas.height = 256;
  const gtx = gridCanvas.getContext('2d');
  gtx.fillStyle = '#2a2f28';
  gtx.fillRect(0, 0, 256, 256);
  gtx.strokeStyle = 'rgba(255,255,255,0.05)';
  gtx.lineWidth = 1;
  for (let i = 0; i <= 8; i++) {
    gtx.beginPath(); gtx.moveTo(i * 32, 0); gtx.lineTo(i * 32, 256); gtx.stroke();
    gtx.beginPath(); gtx.moveTo(0, i * 32); gtx.lineTo(256, i * 32); gtx.stroke();
  }
  const gridTex = new THREE.CanvasTexture(gridCanvas);
  gridTex.wrapS = THREE.RepeatWrapping;
  gridTex.wrapT = THREE.RepeatWrapping;
  gridTex.repeat.set(11, 9);
  ground.material = new THREE.MeshStandardMaterial({ map: gridTex, roughness: 0.95, metalness: 0 });

  const wallMat = new THREE.MeshStandardMaterial({ color: PALETTE.wall, roughness: 0.85, metalness: 0.05 });
  const wallDefs = [
    { x: 0, z: -ARENA.halfZ - 0.5, w: ARENA.halfX * 2 + 2, d: 1 },
    { x: 0, z: ARENA.halfZ + 0.5, w: ARENA.halfX * 2 + 2, d: 1 },
    { x: -ARENA.halfX - 0.5, z: 0, w: 1, d: ARENA.halfZ * 2 + 2 },
    { x: ARENA.halfX + 0.5, z: 0, w: 1, d: ARENA.halfZ * 2 + 2 },
  ];
  for (const w of wallDefs) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w.w, ARENA.wallH, w.d), wallMat);
    mesh.position.set(w.x, ARENA.wallH / 2, w.z);
    group.add(mesh);
  }

  const crateMat = new THREE.MeshStandardMaterial({ color: PALETTE.crate, roughness: 0.9, metalness: 0.05 });
  const crateDarkMat = new THREE.MeshStandardMaterial({ color: PALETTE.crateDark, roughness: 0.9, metalness: 0.05 });
  const pillarMat = new THREE.MeshStandardMaterial({ color: PALETTE.pillar, roughness: 0.8, metalness: 0.1 });
  BLOCKS.forEach((b, i) => {
    const w = b.x1 - b.x0;
    const d = b.z1 - b.z0;
    const mat = b.h >= 3 ? pillarMat : (i % 2 === 0 ? crateMat : crateDarkMat);
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, b.h, d), mat);
    mesh.position.set((b.x0 + b.x1) / 2, b.h / 2, (b.z0 + b.z1) / 2);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
  });

  // Site markers: a glowing ring on the floor plus a floating label plate.
  for (const site of SITES) {
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(site.r - 0.25, site.r, 40),
      new THREE.MeshBasicMaterial({ color: site.color, transparent: true, opacity: 0.55, side: THREE.DoubleSide }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(site.x, 0.03, site.z);
    group.add(ring);
    const plate = new THREE.Mesh(
      new THREE.BoxGeometry(2.4, 0.1, 1.2),
      new THREE.MeshBasicMaterial({ color: site.color }),
    );
    plate.position.set(site.x, 3.4, site.z);
    group.add(plate);
  }

  scene.add(group);
  return { group, blocks: BLOCKS };
}
