// Pure choreography math for the Scrub controller: keyframe sampling, frame-
// rate independent damping, and the pose lookup table. No imports on purpose
// (per phase-03 spec) so this runs under vitest's plain "node" environment.

export type EaseName = 'linear' | 'smooth' | 'smoother';

/**
 * Segment easing. Non-overshooting by contract: monotone on [0,1], f(0)=0,
 * f(1)=1, f'(0)=f'(1)=0. Only these three exist on purpose (motion-quality
 * phase 01 F3) — an overshooting ease (back/elastic/bounce) could push a
 * sampled value outside its keyframe interval and silently break
 * ARM_LIMITS's clampPose-identity guarantee. Keep it this way.
 */
export const EASES: Record<EaseName, (t: number) => number> = {
  linear: (t) => t,
  smooth: (t) => t * t * (3 - 2 * t),
  smoother: (t) => t * t * t * (t * (t * 6 - 15) + 10),
};

export type Keyframe = {
  p: number;
  v: number;
  /** Easing for the segment STARTING at this keyframe. Absent = 'linear' (unchanged behaviour). Meaningless on the last keyframe (never read). */
  ease?: EaseName;
};
export type Track = Keyframe[];

/** Interpolates across `track` (p ascending, p[0]=0, p[last]=1), applying each keyframe's opt-in `ease` to the segment it starts. Clamps p to [0,1]. */
export function sampleTrack(track: Track, p: number): number {
  const pc = Math.min(1, Math.max(0, p));
  const first = track[0];
  const last = track[track.length - 1];
  if (pc <= first.p) return first.v;
  if (pc >= last.p) return last.v;
  for (let i = 0; i < track.length - 1; i++) {
    const a = track[i];
    const b = track[i + 1];
    if (pc >= a.p && pc <= b.p) {
      const t = (pc - a.p) / (b.p - a.p);
      return a.v + (b.v - a.v) * EASES[a.ease ?? 'linear'](t);
    }
  }
  return last.v;
}

/** Frame-rate independent exponential damping toward `target`. */
export function damp(current: number, target: number, lambda: number, dt: number): number {
  return target + (current - target) * Math.exp(-lambda * dt);
}

export interface ScrubPose {
  baseYawDeg: number;
  shoulderPitchDeg: number;
  elbowPitchDeg: number;
  camRadius: number;
  camTheta: number;
  camPhi: number;
  camTargetY: number;
  bgMix: number;
  wireMix: number;
  // animejs-full-clone phase 01: explode drives arm-rig.ts's setExplode()
  // (no-op until phase 03); veil drives the phase-05 zoom-through cut and
  // has no keyframes yet (flat 0) — both numeric, unlike lineColor which is
  // a per-act constant living on ActPose (act-tracks.ts), not a sampled track.
  explode: number;
  veil: number;
}

// Choreography (plan-approved values, verbatim). 4 beats: intro -> reach ->
// fold -> rest. Angles in ARM_LIMITS range (arm-rig-math.ts).
//
// Phase 03 (Fable-approved directive, deferred from phase 01 §step 4): the
// blueprint act's p=1 endpoint is rewritten to the exploded-blueprint end
// framing this phase adds (arm-rig.ts's setExplode, explode-offsets.ts's
// verified 178.8u top / -26u bottom union bbox). Phase 01 deliberately kept
// the OLD endpoints (baseYawDeg -18/shoulderPitchDeg 8/elbowPitchDeg -20/
// camRadius 3.0/camTheta 2.6/wireMix 0.85) because rewriting them then would
// have broken 6 hardcoded tests/scrub-tracks.test.ts assertions with no
// exploded-view content yet to justify the new framing — see phase-01
// report's "Unresolved questions". Now that setExplode is real, the new
// values are this phase's own deliverable, so the same 6 assertions are
// updated in place (see tests/scrub-tracks.test.ts) — a deliberate spec
// change, not a silent break. camPhi/camTargetY also move to the values
// phase 05's zoom-through act needs as its own start pose (this phase's
// spec §Next steps): camPhi 1.16, camTargetY 0.86. Only the p=1 keyframe
// changes in every track below — every earlier keyframe (p<1) is untouched.
export const BLUEPRINT_TRACKS: Record<keyof ScrubPose, Track> = {
  baseYawDeg: [
    { p: 0, v: 0 },
    { p: 0.3, v: 34 },
    { p: 0.6, v: 34 },
    { p: 1, v: 20 },
  ],
  shoulderPitchDeg: [
    { p: 0, v: 0 },
    { p: 0.3, v: 0 },
    { p: 0.6, v: 16 },
    { p: 0.85, v: 8 },
    { p: 1, v: 10 },
  ],
  elbowPitchDeg: [
    { p: 0, v: 0 },
    { p: 0.3, v: -6 },
    { p: 0.6, v: -26 },
    { p: 0.85, v: -12 },
    { p: 1, v: -18 },
  ],
  camRadius: [
    { p: 0, v: 3.2 },
    { p: 0.5, v: 2.5 },
    { p: 1, v: 4.8 },
  ],
  camTheta: [
    { p: 0, v: 0.62 },
    { p: 1, v: 2.35 },
  ],
  camPhi: [
    { p: 0, v: 1.22 },
    { p: 0.5, v: 1.02 },
    { p: 1, v: 1.16 },
  ],
  camTargetY: [
    { p: 0, v: 0.62 },
    { p: 1, v: 0.86 },
  ],
  bgMix: [
    { p: 0, v: 0 },
    { p: 0.18, v: 1 },
    { p: 1, v: 1 },
  ],
  wireMix: [
    { p: 0, v: 0 },
    { p: 0.18, v: 0.85 },
    { p: 1, v: 1 },
  ],
  // New this phase. Values per plan §step 4 (untouched by the deviation
  // above — explode has no prior test coverage to conflict with).
  explode: [
    { p: 0, v: 0 },
    { p: 0.35, v: 0 },
    { p: 0.75, v: 1 },
    { p: 1, v: 1 },
  ],
  // No keyframe table specified for the blueprint act in phase 01 (the veil
  // is a phase-05 zoom-through concept) — flat 0 so it's inert everywhere
  // until phase 05 supplies real values.
  veil: [
    { p: 0, v: 0 },
    { p: 1, v: 0 },
  ],
};

/** Samples every track at `p` and returns the full Arm Rig + camera + material pose. */
export function poseAt(p: number): ScrubPose {
  return {
    baseYawDeg: sampleTrack(BLUEPRINT_TRACKS.baseYawDeg, p),
    shoulderPitchDeg: sampleTrack(BLUEPRINT_TRACKS.shoulderPitchDeg, p),
    elbowPitchDeg: sampleTrack(BLUEPRINT_TRACKS.elbowPitchDeg, p),
    camRadius: sampleTrack(BLUEPRINT_TRACKS.camRadius, p),
    camTheta: sampleTrack(BLUEPRINT_TRACKS.camTheta, p),
    camPhi: sampleTrack(BLUEPRINT_TRACKS.camPhi, p),
    camTargetY: sampleTrack(BLUEPRINT_TRACKS.camTargetY, p),
    bgMix: sampleTrack(BLUEPRINT_TRACKS.bgMix, p),
    wireMix: sampleTrack(BLUEPRINT_TRACKS.wireMix, p),
    explode: sampleTrack(BLUEPRINT_TRACKS.explode, p),
    veil: sampleTrack(BLUEPRINT_TRACKS.veil, p),
  };
}

/** p milestones for phase-04 labels/ticker beats. */
export const BEATS: readonly number[] = [0, 0.3, 0.6, 0.85];
