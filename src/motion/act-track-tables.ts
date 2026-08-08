// Pure per-act keyframe data for acts 2-4 (act 1's own choreography lives in
// scrub-tracks.ts; act 0/5's dispatch lives in act-tracks.ts). Split out of
// act-tracks.ts (phase 05, keeping every file <200 lines per plan.md's hard
// constraint) — these are data tables only, no logic, so this file has no
// imports besides the two shared types.
import type { ScrubPose, Track } from './scrub-tracks';

// Act 2 "Zoom-through" — dollies the camera into the re-assembling arm until
// the veil (#zoom-veil, scrub-controller.ts) is fully opaque, masking the cut
// to act 3. Start values are act 1 (blueprint)'s own p=1 endpoint verbatim
// (baseYawDeg 20 / shoulderPitchDeg 10 / elbowPitchDeg -18 / camRadius 4.8 /
// camTheta 2.35 / camPhi 1.16 / camTargetY 0.86 / bgMix 1 / wireMix 1 /
// explode 1 / veil 0 — see scrub-tracks.ts's BLUEPRINT_TRACKS) so there is no
// pose jump crossing the act-1/act-2 boundary. Phase-05 spec §step 2,
// verbatim. Fable directive #3 (no white/black flash): veil is C0-continuous
// across every act boundary by construction — every adjoining pair of tracks
// (blueprint act1 end veil=0 -> zoom act2 start veil=0; zoom act2 end veil=1
// -> scroll act3 start veil=1, see SCROLL_TRACKS below) shares the exact same
// endpoint value, never a jump.
export const ZOOM_TRACKS: Record<keyof ScrubPose, Track> = {
  baseYawDeg: [{ p: 0, v: 20 }, { p: 1, v: 14 }],
  shoulderPitchDeg: [{ p: 0, v: 10 }, { p: 1, v: 8 }],
  elbowPitchDeg: [{ p: 0, v: -18 }, { p: 1, v: -14 }],
  camRadius: [{ p: 0, v: 4.8 }, { p: 0.3, v: 3.2 }, { p: 0.7, v: 1.2 }, { p: 1, v: 0.42 }],
  camTheta: [{ p: 0, v: 2.35 }, { p: 1, v: 2.35 }],
  camPhi: [{ p: 0, v: 1.16 }, { p: 1, v: 1.3 }],
  camTargetY: [{ p: 0, v: 0.86 }, { p: 1, v: 1.05 }],
  bgMix: [{ p: 0, v: 1 }, { p: 0.35, v: 1 }, { p: 0.75, v: 0 }, { p: 1, v: 0 }],
  wireMix: [{ p: 0, v: 1 }, { p: 0.55, v: 1 }, { p: 1, v: 0.35 }],
  // Re-assembly during the first 40% of the dive: diving into an exploded
  // model reads as chaos, diving into a re-assembling one reads as "entering
  // the machine" (phase-05 spec §Key insights).
  explode: [{ p: 0, v: 1 }, { p: 0.4, v: 0 }, { p: 1, v: 0 }],
  // Veil reaches full opacity at p=0.88, where camRadius (interpolated) is
  // ~0.73; the entire p∈[0.88,1] window (where camRadius keeps falling to the
  // near-plane-clipping endpoint 0.42) is fully covered by an opaque veil.
  // Non-negotiable per phase-05 spec §step 2 ("Do not lower the veil ramp")
  // — kept verbatim.
  veil: [{ p: 0, v: 0 }, { p: 0.7, v: 0 }, { p: 0.88, v: 1 }, { p: 1, v: 1 }],
};

// Act 5 "Outro" — arm returns to a front-on view behind the headline + link
// grid (f19.png). Start values are act 4 (clockwork)'s own p=1 endpoint
// verbatim (baseYawDeg -35 / shoulderPitchDeg 9 / elbowPitchDeg -22 /
// camRadius 2.6 / camTheta 1.5 / camPhi 1.12 / camTargetY 0.75 / bgMix 0 /
// wireMix 0.25 / explode 0 / veil 0 — see CLOCKWORK_TRACKS below), so no pose
// jump crossing the act-4/act-5 boundary. Phase-05 spec §step 3, with one
// Fable-approved amendment: camTheta's p=1 endpoint is 4.5 rad, NOT the
// spec's literal 6.28 (~2*PI) — the plan's own amendment (recorded in the
// phase-01 report's "Fable amendment applied" section) rejects 6.28 as a
// near-full spin read as disorienting; the phase-05 spec's own Risk table
// already names 4.5 as the fallback ("phase 07 may reduce to 4.5 if it feels
// frantic") — this phase applies that fallback now instead of waiting for
// phase 07, per the orchestrator's explicit directive.
const OUTRO_CAM_THETA_END = 4.5;
export const OUTRO_TRACKS: Record<keyof ScrubPose, Track> = {
  baseYawDeg: [{ p: 0, v: -35 }, { p: 1, v: -6 }],
  shoulderPitchDeg: [{ p: 0, v: 9 }, { p: 1, v: 4 }],
  elbowPitchDeg: [{ p: 0, v: -22 }, { p: 1, v: -14 }],
  camRadius: [{ p: 0, v: 2.6 }, { p: 1, v: 3.6 }],
  camTheta: [{ p: 0, v: 1.5 }, { p: 1, v: OUTRO_CAM_THETA_END }],
  camPhi: [{ p: 0, v: 1.12 }, { p: 1, v: 1.3 }],
  camTargetY: [{ p: 0, v: 0.75 }, { p: 1, v: 0.62 }],
  bgMix: [{ p: 0, v: 0 }, { p: 1, v: 0 }],
  wireMix: [{ p: 0, v: 0.25 }, { p: 1, v: 0 }],
  explode: [{ p: 0, v: 0 }, { p: 1, v: 0 }],
  veil: [{ p: 0, v: 0 }, { p: 1, v: 0 }],
};

// Act 3 "Scroll" (green #3ee06f) — one continuous sweep, starts exactly
// where phase 05's zoom-through ends (only `veil` needs continuity here: it
// starts at 1, the veil covering the camera cut, and clears by p=0.12).
// Phase-04 spec §step 4, verbatim.
export const SCROLL_TRACKS: Record<keyof ScrubPose, Track> = {
  baseYawDeg: [{ p: 0, v: -25 }, { p: 1, v: 25 }],
  shoulderPitchDeg: [{ p: 0, v: 6 }, { p: 0.5, v: 17 }, { p: 1, v: 6 }],
  elbowPitchDeg: [{ p: 0, v: -10 }, { p: 0.5, v: -28 }, { p: 1, v: -12 }],
  camRadius: [{ p: 0, v: 3.0 }, { p: 1, v: 3.0 }],
  camTheta: [{ p: 0, v: -0.4 }, { p: 1, v: 0.35 }],
  camPhi: [{ p: 0, v: 1.15 }, { p: 1, v: 1.05 }],
  camTargetY: [{ p: 0, v: 0.7 }, { p: 1, v: 0.7 }],
  bgMix: [{ p: 0, v: 0 }, { p: 1, v: 0 }],
  wireMix: [{ p: 0, v: 0.7 }, { p: 1, v: 0.7 }],
  explode: [{ p: 0, v: 0 }, { p: 1, v: 0 }],
  veil: [{ p: 0, v: 1 }, { p: 0.12, v: 0 }, { p: 1, v: 0 }],
};

// Act 4 "Clockwork" (yellow #f5c518) — 4 discrete yaw marks (25 -> 5 -> -15
// -> -35), the whole point of the name. Ticks run downwards because
// ARM_LIMITS.baseYawDeg is [-60, 60] (arm-rig-math.ts): four 20° ticks
// upwards from 25 would clamp silently after the first one. motion-quality
// phase 01 (feedback B, "too robotic"): the 4 marks and both act boundaries
// are unchanged, but each transition between marks is now a 0.16-wide
// `ease: 'smooth'` move instead of a 0.02-wide linear snap — peak yaw rate
// drops from 1000 deg/p to 187.5 deg/p (measured, see phase-01 report) and
// velocity is C1 continuous at every hold/move joint (holds have zero slope,
// smoothstep has zero slope at both ends). Shoulder/elbow trail the yaw by
// +0.03/+0.05 p on entry and +0.04/+0.06 p on settle — the further down the
// kinematic chain, the later the link starts and the later it settles, which
// reads as inertia. Elbow's -24 intermediate (vs its -22 rest) is a
// deliberate 2° over-travel that reads as mass; still 6° inside
// ARM_LIMITS.elbowPitchDeg. Boundary continuity with act 3's p=1: camRadius
// 3.0, camTheta 0.35, camPhi 1.05, camTargetY 0.70, wireMix 0.70, baseYawDeg
// 25 — all match, untouched by this phase. Phase-04 spec §step 5 authored
// the original snap values; motion-quality phase-01 spec §step 5 authored
// this recut (verified via plans/260808-0835-motion-quality/verify-clockwork-and-idle-numbers.mjs).
export const CLOCKWORK_TRACKS: Record<keyof ScrubPose, Track> = {
  baseYawDeg: [
    { p: 0, v: 25 },
    { p: 0.14, v: 25, ease: 'smooth' },
    { p: 0.3, v: 5 },
    { p: 0.4, v: 5, ease: 'smooth' },
    { p: 0.56, v: -15 },
    { p: 0.66, v: -15, ease: 'smooth' },
    { p: 0.82, v: -35 },
    { p: 1, v: -35 },
  ],
  shoulderPitchDeg: [
    { p: 0, v: 6 },
    { p: 0.17, v: 6, ease: 'smooth' },
    { p: 0.34, v: 11 },
    { p: 0.43, v: 11, ease: 'smooth' },
    { p: 0.6, v: 14 },
    { p: 0.69, v: 14, ease: 'smooth' },
    { p: 0.86, v: 9 },
    { p: 1, v: 9 },
  ],
  elbowPitchDeg: [
    { p: 0, v: -12 },
    { p: 0.19, v: -12, ease: 'smooth' },
    { p: 0.36, v: -17 },
    { p: 0.45, v: -17, ease: 'smooth' },
    { p: 0.62, v: -24 },
    { p: 0.71, v: -24, ease: 'smooth' },
    { p: 0.88, v: -22 },
    { p: 1, v: -22 },
  ],
  camRadius: [{ p: 0, v: 3.0 }, { p: 1, v: 2.6 }],
  camTheta: [{ p: 0, v: 0.35 }, { p: 1, v: 1.5 }],
  camPhi: [{ p: 0, v: 1.05 }, { p: 1, v: 1.12 }],
  camTargetY: [{ p: 0, v: 0.7 }, { p: 1, v: 0.75 }],
  bgMix: [{ p: 0, v: 0 }, { p: 1, v: 0 }],
  wireMix: [{ p: 0, v: 0.7 }, { p: 0.4, v: 0.25 }, { p: 1, v: 0.25 }],
  explode: [{ p: 0, v: 0 }, { p: 1, v: 0 }],
  veil: [{ p: 0, v: 0 }, { p: 1, v: 0 }],
};
