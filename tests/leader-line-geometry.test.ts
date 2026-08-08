// Pure 2D geometry for the blueprint act's leader lines — no DOM needed,
// runs under plain "node". See src/ui/leader-line-geometry.ts's header
// comment for the label -> bend -> anchor polyline contract.
import { describe, expect, it } from 'vitest';
import { leaderPathD, leaderPoints, type Pt } from '../src/ui/leader-line-geometry';

describe('leaderPoints', () => {
  it('the diagonal segment (bend -> anchor) is exactly 45deg when unclamped (|dx| === |dy| within 1e-9)', () => {
    const label: Pt = { x: 100, y: 200 };
    const anchor: Pt = { x: 400, y: 260 }; // dy = 60, well past the default 90px min run
    const [, bend, anchorOut] = leaderPoints(label, anchor, 'left');
    expect(Math.abs(Math.abs(anchorOut.x - bend.x) - Math.abs(anchorOut.y - bend.y))).toBeLessThan(1e-9);
  });

  it('horizontal run (label -> bend) is at least minRunPx once the natural 45deg leg would be shorter', () => {
    const label: Pt = { x: 500, y: 200 };
    const anchor: Pt = { x: 520, y: 205 }; // anchor is right next to the label -> natural run is tiny
    const [p0, p1] = leaderPoints(label, anchor, 'right', 90);
    // side='right' -> run goes left (dir=-1): p1.x must be at least 90px left of p0.x.
    expect(p0.x - p1.x).toBeGreaterThanOrEqual(90 - 1e-9);
  });

  it("left and right sides mirror each other for symmetric label/anchor positions", () => {
    const anchor: Pt = { x: 0, y: 0 };
    const labelLeft: Pt = { x: -200, y: 50 };
    const labelRight: Pt = { x: 200, y: 50 };
    const left = leaderPoints(labelLeft, anchor, 'left');
    const right = leaderPoints(labelRight, anchor, 'right');
    // Mirrored across x=0: every point's x negates, y stays identical.
    for (let i = 0; i < 3; i++) {
      expect(left[i].x).toBeCloseTo(-right[i].x, 9);
      expect(left[i].y).toBeCloseTo(right[i].y, 9);
    }
  });

  it('handles the anchor above the label (anchor.y < label.y)', () => {
    const label: Pt = { x: 100, y: 300 };
    const anchor: Pt = { x: 400, y: 100 }; // 200px above
    const [p0, p1, p2] = leaderPoints(label, anchor, 'left');
    expect(p0.y).toBe(label.y);
    expect(p1.y).toBe(label.y);
    expect(p2).toEqual(anchor);
    expect(Math.abs(p1.x - p2.x)).toBeCloseTo(Math.abs(p2.y - p1.y), 9);
  });

  it('handles the anchor below the label (anchor.y > label.y)', () => {
    const label: Pt = { x: 100, y: 100 };
    const anchor: Pt = { x: 400, y: 300 }; // 200px below
    const [p0, p1, p2] = leaderPoints(label, anchor, 'left');
    expect(p0.y).toBe(label.y);
    expect(p1.y).toBe(label.y);
    expect(p2).toEqual(anchor);
    expect(Math.abs(p1.x - p2.x)).toBeCloseTo(Math.abs(p2.y - p1.y), 9);
  });
});

describe('leaderPathD', () => {
  it('renders 3 points as "M x y L x y L x y"', () => {
    const points: Pt[] = [
      { x: 1.23, y: 4.56 },
      { x: 7.89, y: 0.12 },
      { x: 3.45, y: 6.78 },
    ];
    expect(leaderPathD(points)).toBe('M 1.2 4.6 L 7.9 0.1 L 3.5 6.8');
  });

  it('rounds every coordinate to exactly 1 decimal', () => {
    const points: Pt[] = [
      { x: 0, y: 0 },
      { x: 10.0499, y: 10.05 },
    ];
    // 10.0499 rounds to 10.0 (toFixed rounds half-away-from-zero on .05 boundary per IEEE repr)
    expect(leaderPathD(points)).toBe('M 0.0 0.0 L 10.0 10.1');
  });
});
