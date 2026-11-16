// Shared palette for EMBERLINE: one set of colors for the 3D scene and the HUD.
// Numbers are three.js hex values; the HUD derives CSS strings from them.
export const PALETTE = {
  canvas: 0x10141a,
  surface: 0x232830,
  hairline: 0x313842,
  ink: 0xe9e6df,
  muted: 0x98a0a8,
  accent: 0xf0a830,
  ash: 0x3fc1b0,
  danger: 0xe5484d,
  gold: 0xd9b45b,
  ground: 0x2a2f28,
  groundGrid: 0x39413a,
  wall: 0x4a4640,
  crate: 0x6b5a33,
  crateDark: 0x54452a,
  pillar: 0x5a6068,
  siteA: 0xf0a830,
  siteB: 0x3fc1b0,
  botBody: 0x3a4a42,
  botHead: 0x8a7a5a,
  botVisor: 0x22d3ee,
  tracer: 0xffd166,
};

export function css(hex) {
  return '#' + hex.toString(16).padStart(6, '0');
}
