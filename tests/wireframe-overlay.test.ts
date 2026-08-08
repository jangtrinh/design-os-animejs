// Exercises computeClipBoundsY (review finding M-5): the wireframe clipping
// plane used to be measured once from the bbox at pose 0 and frozen there,
// clipping geometry once the Scrub controller rotated the arm past it. The
// fix unions bboxes sampled at p=0/0.5/1. THREE.Object3D/Box3/BufferGeometry
// have no DOM/WebGL dependency, so this runs under plain node.
import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { computeClipBoundsY, createWireframeOverlay } from '../src/scene/wireframe-overlay';
import { poseAt } from '../src/motion/scrub-tracks';
import type { ArmRig } from '../src/scene/arm-rig';
import type { LoadedModel } from '../src/scene/model-loader';

// Minimal synthetic rig: setPose moves a mesh's world Y by the (real)
// elbowPitchDeg sampled at each p, so the resulting world bbox visibly
// differs per pose without needing the full gltf/pivot chain.
function buildSyntheticArm(): { armRoot: THREE.Object3D; rig: Pick<ArmRig, 'setPose'> } {
  const armRoot = new THREE.Group();
  const part = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.2, 0.2));
  armRoot.add(part);
  armRoot.updateWorldMatrix(true, true);

  const rig: Pick<ArmRig, 'setPose'> = {
    setPose(pose) {
      part.position.y = pose.elbowPitchDeg; // arbitrary but deterministic mapping
      armRoot.updateWorldMatrix(true, true);
    },
  };
  return { armRoot, rig };
}

describe('computeClipBoundsY', () => {
  it('unions the bbox across p=0/0.5/1 instead of only p=0 (the M-5 bug)', () => {
    const { armRoot, rig } = buildSyntheticArm();
    const setPoseSpy = vi.spyOn(rig, 'setPose');

    const bounds = computeClipBoundsY(rig, armRoot);

    // poseAt() was sampled at exactly these 3 points, in order.
    expect(setPoseSpy).toHaveBeenCalledTimes(4); // 3 samples + final zero-pose restore
    const calledElbowDegs = setPoseSpy.mock.calls.map((c) => c[0].elbowPitchDeg);
    expect(calledElbowDegs.slice(0, 3)).toEqual([
      poseAt(0).elbowPitchDeg,
      poseAt(0.5).elbowPitchDeg,
      poseAt(1).elbowPitchDeg,
    ]);
    expect(calledElbowDegs.at(-1)).toBe(0); // restored to zero pose before returning

    // The synthetic part is a 0.2-side box centered at y = elbowPitchDeg(p).
    // Individually, pose-0's bbox is centered at y=0 (elbowPitchDeg(0) === 0).
    const pose0Y = poseAt(0).elbowPitchDeg;
    const pose05Y = poseAt(0.5).elbowPitchDeg;
    const pose1Y = poseAt(1).elbowPitchDeg;
    // Phase 03 moved the p=1 endpoint (-20 -> -18, exploded-blueprint
    // framing) — p=0.5's interpolated value (~-19.3, between the p=0.3/0.6
    // keyframes) is now the deepest of the 3 samples, not p=1. The invariant
    // this test protects (union covers the full sampled range, not just
    // pose 0) is unaffected by which sample happens to win, so compare
    // against the true minimum instead of hardcoding which p produces it.
    const minSampledY = Math.min(pose0Y, pose05Y, pose1Y);
    expect(minSampledY).toBeLessThan(pose0Y);

    // A pose-0-only bbox (the pre-fix behavior) would report minY/maxY close
    // to 0 +/- 0.1 and completely miss the geometry sitting at y ~ minSampledY.
    // The union must cover it.
    expect(bounds.minY).toBeCloseTo(minSampledY - 0.1, 5);
    expect(bounds.maxY).toBeCloseTo(pose0Y + 0.1, 5);
    expect(bounds.minY).toBeLessThan(pose0Y - 0.1); // strictly wider than the pose-0-only bbox
  });

  it('mutate-check contract: a single-sample [0] bbox would be strictly tighter (proves the union is load-bearing)', () => {
    const { armRoot, rig } = buildSyntheticArm();
    const unionBounds = computeClipBoundsY(rig, armRoot, [0, 0.5, 1]);

    const { armRoot: armRoot2, rig: rig2 } = buildSyntheticArm();
    const singleSampleBounds = computeClipBoundsY(rig2, armRoot2, [0]);

    expect(unionBounds.minY).toBeLessThan(singleSampleBounds.minY);
    expect(unionBounds.maxY).toBeCloseTo(singleSampleBounds.maxY, 5); // pose 0 happens to be the max here
  });

  it('restores the rig to zero pose before returning (Hero Intro/main.ts assume the rig starts there)', () => {
    const { armRoot, rig } = buildSyntheticArm();
    const setPoseSpy = vi.spyOn(rig, 'setPose');
    computeClipBoundsY(rig, armRoot);
    const lastCall = setPoseSpy.mock.calls.at(-1)?.[0];
    expect(lastCall).toEqual({ baseYawDeg: 0, shoulderPitchDeg: 0, elbowPitchDeg: 0 });
  });
});

// Phase 03's mandatory clipping-plane fix (H×H risk): computeClipBoundsY only
// samples explode=0 poses, so its [minY,maxY] never accounts for the
// exploded-blueprint act's geometry, which reaches well above that max.
// setDrawIn(1) (both Hero Intro exit paths end at draw=1) must push the
// plane far past any real geometry instead of freezing it at the pre-fix
// maxY, or the exploded parts get silently clipped. No WebGL context needed
// here — createWireframeOverlay only builds THREE.EdgesGeometry/LineSegments
// (pure geometry) and never calls renderer.render().
function buildSyntheticModel(): { model: LoadedModel; rig: ArmRig } {
  const root = new THREE.Group();
  const armRoot = new THREE.Group();
  root.add(armRoot);
  const material = new THREE.MeshStandardMaterial();
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.2, 0.2), material);
  armRoot.add(mesh);
  root.updateMatrixWorld(true);

  const model: LoadedModel = { root, armRoot, meshes: [mesh], byName: new Map(), pbrMaterial: material };
  const rig = {
    setPose: vi.fn(),
    pivotWorldPositions: vi.fn(),
    setExplode: vi.fn(),
  } as unknown as ArmRig;
  return { model, rig };
}

describe('setDrawIn — phase 03 clipping-plane fix', () => {
  it('setDrawIn(1) leaves the clipping plane permissive (constant >= 1e5)', () => {
    const { model, rig } = buildSyntheticModel();
    const overlay = createWireframeOverlay(model, rig);

    overlay.setDrawIn(1);

    // The plane object itself isn't exposed on the WireframeOverlay
    // interface (by design — setDrawIn is the only mutator), so this reads
    // the constant back off the LineSegments' own material's clippingPlanes,
    // the same plane instance createWireframeOverlay attached to lineMaterial.
    const lines = model.meshes[0].children[0] as THREE.LineSegments;
    const material = lines.material as THREE.LineBasicMaterial;
    const plane = material.clippingPlanes?.[0] as THREE.Plane;
    expect(plane.constant).toBeGreaterThanOrEqual(1e5);
  });

  it('setDrawIn(0.5) (not fully drawn in) stays inside the measured bbox range, NOT permissive', () => {
    const { model, rig } = buildSyntheticModel();
    const overlay = createWireframeOverlay(model, rig);

    overlay.setDrawIn(0.5);

    const lines = model.meshes[0].children[0] as THREE.LineSegments;
    const material = lines.material as THREE.LineBasicMaterial;
    const plane = material.clippingPlanes?.[0] as THREE.Plane;
    expect(plane.constant).toBeLessThan(1e5);
  });
});
