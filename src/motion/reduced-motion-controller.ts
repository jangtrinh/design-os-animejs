// Pure lift of scrub-controller.ts's original reduced-motion branch (phase
// 02 §step 1 — file-size prerequisite for the idle layer). Behaviour is
// verbatim, only relocated so scrub-controller.ts stays under the project's
// 200-line hard constraint after idle-motion wiring. `applyPose()`
// (apply-scrub-pose.ts) stays the single writer of three.js state; this
// module never mutates anything beyond what the original branch did.
import type { ArmRig } from '../scene/arm-rig';
import type { SceneContext } from '../scene/scene-setup';
import type { WireframeOverlay } from '../scene/wireframe-overlay';
import { poseAt } from './scrub-tracks';
import { applyPose } from './apply-scrub-pose';
import type { ScrubController } from './scrub-controller';

// Same hex literals scrub-controller.ts used inline before the lift. Kept as
// this module's own copy (not re-exported/shared) rather than a cross-import
// between two peer modules for one hex literal each — scrub-controller.ts
// keeps its own LINE_COLOR_DARK_BG for defaultPoseFn.
const LINE_COLOR_DARK_BG = 0xa7a29c;
const LINE_COLOR_PAPER_BG = 0x1a1a1a;
const BG_MIX_THRESHOLD = 0.5;

export function createReducedMotionController(args: {
  rig: ArmRig;
  ctx: SceneContext;
  overlay: WireframeOverlay;
  onProgress?: (p: number) => void;
  veilEl?: HTMLElement;
}): ScrubController {
  const { rig, ctx, overlay, onProgress, veilEl } = args;

  // Review findings M-3 + M-2 (locked together — same patch, per team-lead
  // ruling): reduced-motion used to jump straight to poseAt(0.5), which (a)
  // painted the "paper" background under the Hero's white text (1.26:1
  // contrast, WCAG fail) and (b) posed the arm mid-scroll instead of the
  // "full render now" the a11y branch promises. p=0 is the intentional
  // reduced-motion pose: dark background, wireMix 0 (full PBR, no
  // wireframe), zero arm pose — matches scene-setup.ts's default camera.
  const pose = poseAt(0);
  applyPose(pose, rig, ctx, overlay);
  overlay.setLineColor(pose.bgMix > BG_MIX_THRESHOLD ? LINE_COLOR_PAPER_BG : LINE_COLOR_DARK_BG);
  // One-shot: poseAt(0).veil is 0, guarantees the veil starts hidden.
  if (veilEl) veilEl.style.opacity = String(pose.veil);

  // M-2: bootstrap's reduced-motion path never awaits anything (see
  // main.ts), so no rAF has rendered yet when we get here — camera.project()
  // inside labels.update() would read a stale/identity matrixWorldInverse
  // and place labels off-screen. Force one render so the camera matrix is
  // current before the single, static label projection below.
  ctx.render();
  onProgress?.(0);

  return {
    refresh(): void {},
    destroy(): void {},
    progress(): number {
      return 0;
    },
  };
}
