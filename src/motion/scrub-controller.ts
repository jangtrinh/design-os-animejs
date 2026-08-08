// Bridges an act section's scroll position to the Arm Rig pose, camera orbit
// and background/wireframe mix. Instantiated once per act (main.ts, via
// act-wiring.ts); a SectionRouter gates which instance is allowed to write
// this frame (report-then-gate, see frame() below) so exactly one act drives
// the scene at a time. anime.js's ScrollObserver drives a plain `{ p }` state
// object (sync:true -> raw, unsmoothed progress, applied synchronously on
// each native scroll event, independent of the render loop's engine.update()
// calls); the render-loop frame callback then damps toward that raw target
// and applies the resulting pose every frame — this keeps the single owned
// RAF loop (render-loop.ts) as the only place that mutates three.js/overlay
// state.
import { createTimeline, onScroll } from 'animejs';
import type { ArmRig } from '../scene/arm-rig';
import type { SceneContext } from '../scene/scene-setup';
import type { WireframeOverlay } from '../scene/wireframe-overlay';
import type { RenderLoop } from '../scene/render-loop';
import { poseAt, damp } from './scrub-tracks';
import { applyPose } from './apply-scrub-pose';
import type { ActPose } from './act-tracks';
import type { SectionRouter } from './section-router';
import { createReducedMotionController } from './reduced-motion-controller';
import { withIdleOffset, type IdleMotion } from './idle-motion';

// Router surface a controller needs: report every frame (even inactive), and
// read whether it's the one act allowed to write camera/rig/background this
// frame. Pick<> keeps this file decoupled from section-router.ts's DOM side.
type ScrubRouter = Pick<SectionRouter, 'isActive' | 'report'>;

export interface ScrubController {
  refresh(): void;
  destroy(): void;
  progress(): number;
}

const DAMP_LAMBDA = 6; // ~0.3s settle, per spec
const EPSILON = 1e-4;
// #zoom-veil opacity write threshold (phase-05 spec §step 1) — same
// changed-check idiom as lastLineColor below, coarser since opacity is
// visually forgiving at this scale.
const VEIL_EPSILON = 0.005;
// LINE_COLOR_PAPER_BG/BG_MIX_THRESHOLD moved to reduced-motion-controller.ts
// (phase 02 §step 1) — nothing else here uses them. LINE_COLOR_DARK_BG stays
// (defaultPoseFn below still needs it); the new module keeps its own copy
// rather than a cross-import between peer modules for one hex literal.
const LINE_COLOR_DARK_BG = 0xa7a29c;
const DEFAULT_ACT_INDEX = 0;
// No router/poseFn supplied -> always-active single-act behaviour, identical
// to the pre-phase-01 controller (kept optional so the existing reduced-
// motion unit test, whose fake collaborators predate the router, still
// type-checks and passes unmodified — real callers (act-wiring.ts) always
// pass all three).
const DEFAULT_ROUTER: ScrubRouter = { isActive: () => true, report: () => {} };
function defaultPoseFn(p: number): ActPose {
  return { ...poseAt(p), lineColor: LINE_COLOR_DARK_BG };
}

export function createScrubController(args: {
  sectionEl: HTMLElement;
  rig: ArmRig;
  ctx: SceneContext;
  overlay: WireframeOverlay;
  loop: RenderLoop;
  reducedMotion: boolean;
  onProgress?: (pSmoothed: number) => void;
  actIndex?: number;
  poseFn?: (p: number) => ActPose;
  router?: ScrubRouter;
  // Shared #zoom-veil element (act-wiring.ts) — only acts 2/3 ever sample a
  // non-zero pose.veil. Optional so the pre-phase-05 unit test still type-checks.
  veilEl?: HTMLElement;
  // Idle motion layer (phase 02) — additive Arm-Rig-only offsets applied in
  // frame() below, right before applyPose(). Optional so every unit test
  // that predates idle (reduced-motion + router-gate) still type-checks.
  idle?: IdleMotion;
}): ScrubController {
  const {
    sectionEl,
    rig,
    ctx,
    overlay,
    loop,
    reducedMotion,
    onProgress,
    actIndex = DEFAULT_ACT_INDEX,
    poseFn = defaultPoseFn,
    router = DEFAULT_ROUTER,
    veilEl,
    idle,
  } = args;

  if (reducedMotion) {
    // Phase 02 §step 1: lifted verbatim into reduced-motion-controller.ts
    // (file-size prerequisite for the idle layer below) — same poseAt(0),
    // same LINE_COLOR_* rule, same ctx.render()-before-onProgress ordering,
    // same no-op refresh/destroy, same progress() === 0.
    return createReducedMotionController({ rig, ctx, overlay, onProgress, veilEl });
  }

  const state = { p: 0 };
  const observer = onScroll({
    target: sectionEl,
    axis: 'y',
    sync: true,
    enter: 'top top',
    leave: 'bottom bottom',
  });
  const timeline = createTimeline({ defaults: { ease: 'linear' }, autoplay: observer }).add(
    state,
    { p: [0, 1], duration: 1000, ease: 'linear' },
    0,
  );

  let pSmooth = 0;
  let lastApplied = Number.NaN; // NaN never equals itself -> forces first apply
  let lastLineColor = -1; // never a valid 0xRRGGBB hex -> forces first apply
  let lastVeil = Number.NaN; // NaN never equals itself -> forces first apply
  let armed = false; // true once this act has been active at least one frame

  function frame(dt: number): void {
    // Every act reports every frame, including inactive ones — the router
    // needs this frame's full picture to compute activeIndex; reporting
    // only when active would leave it reading last frame's stale value.
    router.report(actIndex, state.p);
    if (!router.isActive(actIndex)) {
      armed = false;
      return;
    }
    if (!armed) {
      // Snap (not damp) on (re)activation so switching acts — including
      // scrolling back up into an earlier one — never damps in from
      // wherever pSmooth was last left.
      pSmooth = state.p;
      armed = true;
    }

    pSmooth = damp(pSmooth, state.p, DAMP_LAMBDA, dt);

    // Phase 02: idle-aware EPSILON early return. `idleOffset` is non-null
    // only for acts with nonzero idle weight and no reduced motion
    // (idle-motion.ts's offsetFor); an act at scroll rest with idle active
    // must keep repainting every frame (this bypass is the whole reason the
    // idle layer is visible — plan.md's Verified Fact 4), while an
    // idle-inactive act keeps today's exact skip.
    const idleOffset = idle?.offsetFor(actIndex) ?? null;
    const scrubMoved = Number.isNaN(lastApplied) || Math.abs(pSmooth - lastApplied) >= EPSILON;
    if (!scrubMoved && !idleOffset) return;

    const pose = poseFn(pSmooth);
    applyPose(idleOffset ? withIdleOffset(pose, idleOffset) : pose, rig, ctx, overlay);
    rig.setExplode(pose.explode);

    // Phase 04 §step 6: every act's edge colour now comes straight off its
    // own ActPose.lineColor (blueprint's own dark/paper threshold rule moved
    // into act-tracks.ts's blueprintLineColor(); acts 3/4 are flat per-act
    // constants) — this "changed since last frame" guard replaces the old
    // bgMix-threshold branch, same idiom as the lastApplied check above.
    // Colour/veil/explode all read the un-idled `pose` — idle only offsets
    // the 3 arm angles (F1), never these.
    if (pose.lineColor !== lastLineColor) {
      overlay.setLineColor(pose.lineColor);
      lastLineColor = pose.lineColor;
    }

    // One guarded DOM write to the shared #zoom-veil element (phase-05).
    if (veilEl && (Number.isNaN(lastVeil) || Math.abs(pose.veil - lastVeil) > VEIL_EPSILON)) {
      veilEl.style.opacity = String(pose.veil);
      lastVeil = pose.veil;
    }

    // N3: only a REAL scroll move re-notifies progress (part-labels' DOM
    // write) — idle repainting the pose at rest must not fire this every
    // frame, only the pose write above repeats.
    if (scrubMoved) {
      lastApplied = pSmooth;
      onProgress?.(pSmooth);
    }
  }

  loop.add(frame);

  return {
    refresh(): void {
      observer.refresh();
      // N-6: force the next frame() to re-apply/re-project even if pSmooth
      // hasn't moved (EPSILON early-return above would otherwise leave
      // labels/ticker at their pre-resize pixel coordinates).
      lastApplied = Number.NaN;
    },
    destroy(): void {
      timeline.revert();
      observer.revert();
    },
    progress(): number {
      return pSmooth;
    },
  };
}
