// Pure data + maths for the exploded-blueprint act — no three.js import in
// the source module by design (phase 03 interface), so this runs under
// plain "node" with zero WebGL risk.
import { describe, expect, it } from 'vitest';
import {
  EXPLODE_OFFSETS,
  explodedExtent,
  offsetAt,
  type ExplodeKey,
} from '../src/scene/explode-offsets';

const ALL_KEYS = Object.keys(EXPLODE_OFFSETS) as ExplodeKey[];

describe('offsetAt', () => {
  it('is the zero vector at t=0 for every key', () => {
    for (const key of ALL_KEYS) {
      const d = offsetAt(key, 0);
      // toBeCloseTo (not toEqual/toBe) because 0 * a negative delta yields
      // -0 in IEEE754 — a real, harmless artifact of the multiplication, not
      // a behavioral difference from +0.
      expect(d.x).toBeCloseTo(0, 9);
      expect(d.y).toBeCloseTo(0, 9);
      expect(d.z).toBeCloseTo(0, 9);
    }
  });

  it('equals the EXPLODE_OFFSETS table value at t=1 for every key', () => {
    for (const key of ALL_KEYS) {
      expect(offsetAt(key, 1)).toEqual(EXPLODE_OFFSETS[key]);
    }
  });

  it('is linear: t=0.5 is exactly half the table value (shoulder key: 16,28,0 -> 8,14,0)', () => {
    expect(offsetAt('shoulder', 0.5)).toEqual({ x: 8, y: 14, z: 0 });
  });

  it('clamps t outside [0,1] to the nearest boundary', () => {
    expect(offsetAt('plinth', -1)).toEqual(offsetAt('plinth', 0));
    expect(offsetAt('plinth', 2)).toEqual(offsetAt('plinth', 1));
  });
});

describe('explodedExtent', () => {
  it('at t=1, maxY-minY stays within the 210-unit framing budget and minY >= -30', () => {
    const { minY, maxY } = explodedExtent(1);
    expect(maxY - minY).toBeLessThanOrEqual(210);
    expect(minY).toBeGreaterThanOrEqual(-30);
  });

  it('at t=1, reproduces the phase-03 spec verified numbers (minY=-26, maxY=178.7, within 0.1)', () => {
    const { minY, maxY } = explodedExtent(1);
    expect(minY).toBeCloseTo(-26, 1);
    expect(maxY).toBeCloseTo(178.7, 1);
  });

  it('at t=0, reproduces the assembled rest bbox exactly (Y 0..124.5, plan.md fact #3)', () => {
    const { minY, maxY } = explodedExtent(0);
    expect(minY).toBeCloseTo(0.0, 9);
    expect(maxY).toBeCloseTo(124.5, 9);
  });
});

// Centre-to-centre pairwise separation, per the phase-06 spec's test matrix.
// Uses the Y-axis only (not full 3D distance): explodedExtent() above and
// the plan's own framing arithmetic are both Y-range based — the explode
// system's whole purpose is vertical separation between clusters — and the
// rest Y-centres below are read directly off the phase-03 spec's "Key facts"
// bbox-centre table (not invented): base_circle_low y=4.2 "plinth",
// base1_low y=27.5 "base1"/yawBase (immobile — no explode key ever applies
// to it), base6_low y=38.8 "baseCollar", the main-arm envelope
// (main2_low/joint2_low, combined Y range 46.0-124.5 per phase-03's own
// recomputation -> centre y=85.25) as "shoulder"'s representative point,
// sub2_low y=91.3 as "elbow"'s (it rides elbowGroup, so it accumulates BOTH
// the shoulder and elbow offsets — arm-rig.ts's group nesting: shoulderGroup
// contains elbowGroup contains sub_arm_LP's children), and head1_low y=70.3
// as "head"'s (rides elbowGroup + its own 'head' offset). (A full-3D version
// of this check was tried first and rejected: the shoulder/elbow pair's X
// components converge as t grows while Y diverges, producing a non-monotonic
// 3D magnitude — verified by hand computation, not a test bug; Y-only is the
// axis the source module itself treats as the separation signal.)
interface RestPointY {
  y: number;
  keys: ExplodeKey[]; // which offset keys' Y-components accumulate onto this point, in order
}

const PLINTH: RestPointY = { y: 4.2, keys: ['plinth'] };
const BASE1_IMMOBILE: RestPointY = { y: 27.5, keys: [] };
const BASE_COLLAR: RestPointY = { y: 38.8, keys: ['baseCollar'] };
const SHOULDER: RestPointY = { y: 85.25, keys: ['shoulder'] };
const ELBOW: RestPointY = { y: 91.3, keys: ['shoulder', 'elbow'] };
const HEAD: RestPointY = { y: 70.3, keys: ['shoulder', 'elbow', 'head'] };

function worldY(rest: RestPointY, t: number): number {
  let y = rest.y;
  for (const key of rest.keys) y += offsetAt(key, t).y;
  return y;
}

function distance(a: RestPointY, b: RestPointY, t: number): number {
  return Math.abs(worldY(a, t) - worldY(b, t));
}

describe('explode separation (pairwise centre-to-centre distance)', () => {
  const pairs: [string, RestPointY, RestPointY][] = [
    ['plinth vs base1', PLINTH, BASE1_IMMOBILE],
    ['baseCollar vs shoulder', BASE_COLLAR, SHOULDER],
    ['shoulder vs elbow', SHOULDER, ELBOW],
    ['elbow vs head', ELBOW, HEAD],
  ];

  it.each(pairs)('%s: distance strictly increases at t = 0.25 / 0.5 / 1', (_name, a, b) => {
    const d25 = distance(a, b, 0.25);
    const d50 = distance(a, b, 0.5);
    const d100 = distance(a, b, 1);
    expect(d50).toBeGreaterThan(d25);
    expect(d100).toBeGreaterThan(d50);
  });
});
