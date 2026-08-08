// Pure per-frame pose application: writes Arm Rig angles, camera spherical
// position, background mix and wireframe mix onto three.js state. Split out
// of scrub-controller.ts (phase 05, keeping every file <200 lines per
// plan.md's hard constraint) — this function owns no controller state of its
// own, just three.js/rig writes, so it's a safe standalone module reused
// unchanged by every act's ScrubController.
import type { ArmRig } from '../scene/arm-rig';
import type { SceneContext } from '../scene/scene-setup';
import type { WireframeOverlay } from '../scene/wireframe-overlay';
import type { ScrubPose } from './scrub-tracks';

export function applyPose(pose: ScrubPose, rig: ArmRig, ctx: SceneContext, overlay: WireframeOverlay): void {
  rig.setPose({
    baseYawDeg: pose.baseYawDeg,
    shoulderPitchDeg: pose.shoulderPitchDeg,
    elbowPitchDeg: pose.elbowPitchDeg,
  });

  const x = pose.camRadius * Math.sin(pose.camPhi) * Math.sin(pose.camTheta);
  const y = pose.camRadius * Math.cos(pose.camPhi) + pose.camTargetY;
  const z = pose.camRadius * Math.sin(pose.camPhi) * Math.cos(pose.camTheta);
  ctx.camera.position.set(x, y, z);
  ctx.camera.lookAt(0, pose.camTargetY, 0);

  ctx.setBackgroundMix(pose.bgMix);
  overlay.setMix(pose.wireMix);
}
