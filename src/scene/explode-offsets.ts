// Pure data + maths for the exploded-blueprint act: per-part offsets applied
// on top of each node's rest position (arm-rig.ts), and the resulting union
// Y-extent used to verify the camera framing stays inside the viewport
// (plan.md §step 1's "verified framing" arithmetic). No three.js import on
// purpose so this runs under vitest's plain "node" environment.

export type ExplodeKey =
  | 'plinth'
  | 'baseCollar'
  | 'shoulder'
  | 'wheel1'
  | 'elbow'
  | 'wheel2'
  | 'head'
  | 'wheel3';

export interface ExplodeOffset {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

// Full offset at t=1, model units (LP_arm space, pre 0.01 world scale).
// Values + rationale: phase-03 spec §step 1's offset table, verbatim.
export const EXPLODE_OFFSETS: Readonly<Record<ExplodeKey, ExplodeOffset>> = {
  plinth: { x: 0, y: -26, z: 0 },
  baseCollar: { x: 0, y: 14, z: 0 },
  shoulder: { x: 16, y: 28, z: 0 },
  wheel1: { x: 0, y: 0, z: 24 },
  elbow: { x: 16, y: 28, z: 0 },
  wheel2: { x: 0, y: 0, z: 24 },
  head: { x: -30, y: -15, z: 0 },
  wheel3: { x: 0, y: 0, z: 16 },
};

/** Linear: base (0,0,0) + t*delta, t clamped to [0,1]. Pure, no three.js import. */
export function offsetAt(key: ExplodeKey, t: number): ExplodeOffset {
  const tc = Math.min(1, Math.max(0, t));
  const d = EXPLODE_OFFSETS[key];
  return { x: d.x * tc, y: d.y * tc, z: d.z * tc };
}

// Rest Y-range (model units, t=0, LP_arm space) for every moving cluster,
// read off the phase-03 spec's "Key facts" bbox table, plus which explode
// keys' Y-offsets accumulate onto it through the pivot chain (elbowGroup is
// a child of shoulderGroup, so anything riding elbowGroup picks up both).
// `yawBase` never explodes (base1-5_low have no offset key) but is included
// as a candidate so explodedExtent(0) reproduces the assembled rest bbox
// exactly (plan.md fact #3: Y 0..124.5).
interface ClusterYRange {
  readonly minY: number;
  readonly maxY: number;
  readonly keys: readonly ExplodeKey[];
}

const CLUSTER_Y_RANGES: readonly ClusterYRange[] = [
  { minY: 0.0, maxY: 8.3, keys: ['plinth'] }, // base_circle_low
  { minY: 1.2, maxY: 53.8, keys: [] }, // base1_low (yawBase, immobile)
  { minY: 27.9, maxY: 49.7, keys: ['baseCollar'] }, // base6_low
  { minY: 30.9, maxY: 46.7, keys: ['shoulder', 'wheel1'] }, // wheel1_low
  { minY: 46.0, maxY: 124.5, keys: ['shoulder'] }, // main_arm_LP envelope (main2/joint2_low)
  { minY: 107.2, maxY: 122.7, keys: ['shoulder', 'elbow', 'wheel2'] }, // wheel2_low
  { minY: 67.3, maxY: 115.3, keys: ['shoulder', 'elbow'] }, // sub_arm_LP envelope (sub2_low)
  { minY: 62.4, maxY: 78.2, keys: ['shoulder', 'elbow', 'head'] }, // head1/head2/plugs_low
  { minY: 69.8, maxY: 76.4, keys: ['shoulder', 'elbow', 'wheel3'] }, // wheel3_low
];

/** Exploded bbox Y-extent in LP_arm units, for the framing assertion in phase 06. */
export function explodedExtent(t: number): { minY: number; maxY: number } {
  const tc = Math.min(1, Math.max(0, t));
  let minY = Infinity;
  let maxY = -Infinity;
  for (const range of CLUSTER_Y_RANGES) {
    let dy = 0;
    for (const key of range.keys) dy += offsetAt(key, tc).y;
    minY = Math.min(minY, range.minY + dy);
    maxY = Math.max(maxY, range.maxY + dy);
  }
  return { minY, maxY };
}
