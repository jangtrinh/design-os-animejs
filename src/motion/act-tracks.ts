// Per-act pose lookup. Index 1 (blueprint) delegates to the existing
// poseAt() choreography (scrub-tracks.ts) unchanged; acts 2/3/4/5 each own a
// real track table (2 and 5 added by phase 05 — zoom-through + outro; 3/4
// added by phase 04, see act-track-tables.ts). Only act 0 (hero) still holds
// a static pose (by design — the hero never moves the camera). Each act
// carries a lineColor (a plain 0xRRGGBB number, not a sampled track —
// colours aren't a scrub curve, see scrub-tracks.ts's ScrubPose comment);
// blueprint and zoom are the two exceptions (both derived from their own
// bgMix via blueprintLineColor, §step 6) — every other act's lineColor is a
// flat constant.
import { poseAt, sampleTrack, type ScrubPose, type Track } from './scrub-tracks';
import { ZOOM_TRACKS, OUTRO_TRACKS, SCROLL_TRACKS, CLOCKWORK_TRACKS } from './act-track-tables';

export interface ActPose extends ScrubPose {
  explode: number;
  veil: number;
  lineColor: number;
}

const LINE_COLOR_NEUTRAL = 0xa7a29c;
const LINE_COLOR_PAPER = 0x1a1a1a;
const LINE_COLOR_SCROLL = 0x3ee06f;
const LINE_COLOR_CLOCKWORK = 0xf5c518;
const BG_MIX_PAPER_THRESHOLD = 0.5;

// p=0 hold: byte-identical to scene-setup.ts's parked camera (hero act holds
// this for its whole 80vh range — plan.md §step 10). Acts 2 and 5 (zoom,
// outro) no longer reuse this as a placeholder — phase 05 gives them real
// tracks (act-track-tables.ts's ZOOM_TRACKS/OUTRO_TRACKS).
const HOLD_START: ScrubPose = poseAt(0);

// Every ScrubPose key, in table order — used to sample a full pose out of a
// per-act Track record without repeating each key by hand (sampleAll below).
const SCRUB_KEYS: readonly (keyof ScrubPose)[] = [
  'baseYawDeg',
  'shoulderPitchDeg',
  'elbowPitchDeg',
  'camRadius',
  'camTheta',
  'camPhi',
  'camTargetY',
  'bgMix',
  'wireMix',
  'explode',
  'veil',
];

function sampleAll(tracks: Record<keyof ScrubPose, Track>, p: number): ScrubPose {
  const pose = {} as ScrubPose;
  for (const key of SCRUB_KEYS) pose[key] = sampleTrack(tracks[key], p);
  return pose;
}

function withExtras(pose: ScrubPose, lineColor: number): ActPose {
  return { ...pose, lineColor };
}

// Phase-04 spec §step 6: the blueprint act's line colour used to be a plain
// dark/paper threshold switch living in scrub-controller.ts's frame(); now
// that every act's colour comes from ActPose.lineColor, blueprint (and, as of
// phase 05, zoom — same "two-value rule as act 1" per its own spec) keep that
// exact two-value rule here instead (acts 3/4/5 below are flat constants).
function blueprintLineColor(bgMix: number): number {
  return bgMix > BG_MIX_PAPER_THRESHOLD ? LINE_COLOR_PAPER : LINE_COLOR_NEUTRAL;
}

/** Full Arm Rig + camera + material pose for act `index` at local progress `p`. */
export function poseAtAct(index: number, p: number): ActPose {
  switch (index) {
    case 0: // hero — static, camera never moves during this act
      return withExtras(HOLD_START, LINE_COLOR_NEUTRAL);
    case 1: { // blueprint — real per-p choreography; lineColor tracks bgMix
      const pose = poseAt(p);
      return withExtras(pose, blueprintLineColor(pose.bgMix));
    }
    case 2: { // zoom — real per-p choreography (phase 05); lineColor tracks bgMix, same rule as act 1
      const pose = sampleAll(ZOOM_TRACKS, p);
      return withExtras(pose, blueprintLineColor(pose.bgMix));
    }
    case 3: // scroll — real per-p choreography (phase 04)
      return withExtras(sampleAll(SCROLL_TRACKS, p), LINE_COLOR_SCROLL);
    case 4: // clockwork — real per-p choreography (phase 04)
      return withExtras(sampleAll(CLOCKWORK_TRACKS, p), LINE_COLOR_CLOCKWORK);
    case 5: // outro — real per-p choreography (phase 05)
      return withExtras(sampleAll(OUTRO_TRACKS, p), LINE_COLOR_NEUTRAL);
    default:
      return withExtras(HOLD_START, LINE_COLOR_NEUTRAL);
  }
}
