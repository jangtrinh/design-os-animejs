// Wireframe->PBR crossfade via an EdgesGeometry/LineSegments overlay per
// mesh (parented to the mesh itself so it inherits the Arm Rig transform for
// free) plus a horizontal clipping plane for the "draw-in" reveal. No custom
// shader per plan.md hard constraint.
import * as THREE from 'three';
import type { LoadedModel } from './model-loader';
import type { ArmRig } from './arm-rig';
import { poseAt } from '../motion/scrub-tracks';

export interface WireframeOverlay {
  setMix(mix01: number): void; // 1 = full wireframe, 0 = full PBR
  setDrawIn(progress01: number): void; // 0->1 line "draw-in" bottom to top
  setLineColor(hex: number): void;
}

const CLIP_SAMPLE_POINTS = [0, 0.5, 1] as const;
const ZERO_ARM_POSE = { baseYawDeg: 0, shoulderPitchDeg: 0, elbowPitchDeg: 0 };

// Review finding M-5: the clipping plane used to be measured from a single
// world bbox at pose 0, then frozen there for the rest of the session — once
// the Scrub controller (section 2) rotated the arm to a pose whose geometry
// reaches higher than the zero-pose bbox, that geometry got clipped (up to
// ~253mm per the review's math). Sampling the union of bboxes at p=0/0.5/1
// (the same beats the choreography's `poseAt` uses) instead covers the arm's
// full range of motion. Exported as a pure-ish helper (only side effect is
// driving `rig` through its samples, restored to zero pose before returning)
// so the bbox math is unit-testable without a real gltf/WebGL context.
export function computeClipBoundsY(
  rig: Pick<ArmRig, 'setPose'>,
  armRoot: THREE.Object3D,
  poseSamples: readonly number[] = CLIP_SAMPLE_POINTS,
): { minY: number; maxY: number } {
  const unionBox = new THREE.Box3();
  for (const p of poseSamples) {
    const pose = poseAt(p);
    rig.setPose({
      baseYawDeg: pose.baseYawDeg,
      shoulderPitchDeg: pose.shoulderPitchDeg,
      elbowPitchDeg: pose.elbowPitchDeg,
    });
    armRoot.updateWorldMatrix(true, true);
    unionBox.union(new THREE.Box3().setFromObject(armRoot));
  }
  rig.setPose(ZERO_ARM_POSE); // restore the zero pose main.ts/hero-intro.ts assume the rig starts at
  return { minY: unionBox.min.y, maxY: unionBox.max.y };
}

export function createWireframeOverlay(model: LoadedModel, rig: ArmRig): WireframeOverlay {
  const { meshes, pbrMaterial, armRoot } = model;

  const lineMaterial = new THREE.LineBasicMaterial({
    color: 0xa7a29c,
    transparent: true,
    opacity: 1,
    depthTest: true,
  });

  for (const mesh of meshes) {
    // Threshold 30 -> 38: phase-07 polish. At 30 the small clustered parts
    // (head/elbow area at full explode) generate enough overlapping edges to
    // read as a near-black blob against the reference's mid-grey hairlines;
    // 38 keeps every structurally-real edge (checked visually against
    // reference/f07.png + animejs-toolbox-exploded-ref.png) while dropping
    // the near-flat facets that inflate line density without adding shape.
    const lines = new THREE.LineSegments(new THREE.EdgesGeometry(mesh.geometry, 38), lineMaterial);
    mesh.add(lines);
  }

  const { minY, maxY } = computeClipBoundsY(rig, armRoot);
  // Plane: normal.dot(point) + constant >= 0 is kept -> -y + constant >= 0
  // -> y <= constant. Raising constant from minY to maxY reveals bottom-up.
  const plane = new THREE.Plane(new THREE.Vector3(0, -1, 0), minY);
  lineMaterial.clippingPlanes = [plane];

  return {
    setMix(mix01: number): void {
      lineMaterial.opacity = mix01;
      pbrMaterial.opacity = 1 - mix01;
      pbrMaterial.visible = mix01 < 1;
      lineMaterial.visible = mix01 > 0.001;
    },
    setDrawIn(progress01: number): void {
      if (progress01 >= 1) {
        // Phase 03 mandatory fix (H×H risk): computeClipBoundsY only samples
        // explode=0 poses, so its [minY,maxY] never accounts for the
        // exploded-blueprint act's geometry, which reaches ~0.54m above that
        // max. Freezing the plane at maxY here (the pre-fix behaviour) would
        // silently clip the exploded parts. Both Hero Intro exits (play()
        // completing and skipToEnd()) end at draw=1, so pushing the plane
        // far past any real geometry here covers every path permanently.
        plane.constant = 1e6;
        return;
      }
      plane.constant = THREE.MathUtils.lerp(minY, maxY, progress01);
    },
    setLineColor(hex: number): void {
      lineMaterial.color.setHex(hex);
    },
  };
}
