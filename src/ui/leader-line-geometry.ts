// Pure 2D geometry for the blueprint act's leader lines: a 3-point polyline
// from a fixed-column label to its 3D part anchor — a long horizontal run
// out of the label, then a 45° diagonal to the anchor. No three.js import
// so this runs under vitest's plain "node" environment.

export interface Pt {
  x: number;
  y: number;
}

export type LeaderSide = 'left' | 'right';

const LABEL_GAP_PX = 8;
const DEFAULT_MIN_RUN_PX = 90;

/**
 * 3-point polyline label -> bend -> anchor; the middle segment is exactly 45°.
 * `side='right'` means the label sits right of the object, so the run goes
 * left (dir=-1); `side='left'` runs right (dir=1) toward the object.
 * The horizontal run (label -> bend) is clamped to at least `minRunPx` — if
 * the 45° leg would start past that, the diagonal is shortened instead of
 * letting it cross the label text.
 */
export function leaderPoints(
  label: Pt,
  anchor: Pt,
  side: LeaderSide,
  minRunPx: number = DEFAULT_MIN_RUN_PX,
): [Pt, Pt, Pt] {
  const dir = side === 'right' ? -1 : 1;
  const p0: Pt = { x: label.x + dir * LABEL_GAP_PX, y: label.y };

  const dy = Math.abs(anchor.y - label.y);
  const rawBendX = anchor.x - dir * dy; // exactly 45°: |bendX - anchor.x| === dy
  const bendX = dir === 1 ? Math.max(rawBendX, p0.x + minRunPx) : Math.min(rawBendX, p0.x - minRunPx);
  const p1: Pt = { x: bendX, y: label.y };

  return [p0, p1, anchor];
}

/** "M x0 y0 L x1 y1 L x2 y2", coordinates rounded to 1 decimal. */
export function leaderPathD(points: readonly Pt[]): string {
  return points.map((pt, i) => `${i === 0 ? 'M' : 'L'} ${pt.x.toFixed(1)} ${pt.y.toFixed(1)}`).join(' ');
}
