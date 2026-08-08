// Builds the Arm Rig by hand: gltf gives 4 sibling nodes with identity
// transforms (no pivot), so rotation groups + explicit offset math are
// required (see plan.md "Discovered facts" #1-2). Pivots below are measured
// in model space (pre 0.01 scale) per phase-02 spec §Implementation Steps 5.
import * as THREE from 'three';
import type { LoadedModel } from './model-loader';
import { clampPose, DEG, type ArmPose } from './arm-rig-math';
import { offsetAt, type ExplodeKey } from './explode-offsets';

export interface ArmRig {
  setPose(pose: ArmPose): void;
  pivotWorldPositions(): Record<'base' | 'shoulder' | 'elbow' | 'head', THREE.Vector3>;
  // Phase 03: offsets 8 clusters along their own kinematic/spin axes, driven
  // by the blueprint act's `explode` track (scrub-controller.ts's frame()).
  setExplode(t01: number): void;
}

// Pivot of shoulderGroup, expressed in its parent (yawGroup) space.
const SHOULDER_PIVOT = new THREE.Vector3(0, 39, 0);
// Pivot of elbowGroup, expressed in its parent (shoulderGroup) space.
const ELBOW_PIVOT_LOCAL = new THREE.Vector3(42.7, 76, 0);
// Same elbow pivot, expressed in armRoot space (= SHOULDER_PIVOT + ELBOW_PIVOT_LOCAL).
// Needed to offset parts re-parented directly into elbowGroup.
const ELBOW_PIVOT_IN_ARM_ROOT = new THREE.Vector3(42.7, 115, 0);

const BBOX_TOLERANCE = 1e-3;
const BASE_PART_NAMES = ['base1_low', 'base2_low', 'base3_low', 'base4_low', 'base5_low', 'base6_low'];
const EXPLODE_EPSILON = 1e-4;

function requireNode(byName: Map<string, THREE.Object3D>, name: string): THREE.Object3D {
  const node = byName.get(name);
  if (!node) throw new Error(`Arm rig node missing: ${name}`);
  return node;
}

// `add` (not `attach`) re-parents while keeping local position as-is; every
// part starts at local (0,0,0) (identity chain), so we set the compensating
// offset by hand: -pivot, in the *new* parent's space.
function attachWithOffset(group: THREE.Group, part: THREE.Object3D, pivot: THREE.Vector3): void {
  group.add(part);
  part.position.set(-pivot.x, -pivot.y, -pivot.z);
}

export function buildArmRig(model: LoadedModel): ArmRig {
  const { root, armRoot, byName } = model;

  root.updateMatrixWorld(true);
  const preRigBox = new THREE.Box3().setFromObject(armRoot);

  const yawGroup = new THREE.Group();
  yawGroup.name = 'yawGroup';

  const shoulderGroup = new THREE.Group();
  shoulderGroup.name = 'shoulderGroup';
  shoulderGroup.position.copy(SHOULDER_PIVOT);

  const elbowGroup = new THREE.Group();
  elbowGroup.name = 'elbowGroup';
  elbowGroup.position.copy(ELBOW_PIVOT_LOCAL);

  armRoot.add(yawGroup);
  for (const name of BASE_PART_NAMES) {
    yawGroup.add(requireNode(byName, name)); // yawGroup pivot is (0,0,0) -> no offset needed
  }

  yawGroup.add(shoulderGroup);
  attachWithOffset(shoulderGroup, requireNode(byName, 'main_arm_LP'), SHOULDER_PIVOT);
  attachWithOffset(shoulderGroup, requireNode(byName, 'wheel1_low'), SHOULDER_PIVOT);

  shoulderGroup.add(elbowGroup);
  attachWithOffset(elbowGroup, requireNode(byName, 'sub_arm_LP'), ELBOW_PIVOT_IN_ARM_ROOT);
  attachWithOffset(elbowGroup, requireNode(byName, 'wheel2_low'), ELBOW_PIVOT_IN_ARM_ROOT);
  attachWithOffset(elbowGroup, requireNode(byName, 'wheel3_low'), ELBOW_PIVOT_IN_ARM_ROOT);

  // Mandatory self-check: at zero pose the rigged model must reproduce the
  // pre-rig bounding box. A mismatch means an attach offset is wrong.
  root.updateMatrixWorld(true);
  const postRigBox = new THREE.Box3().setFromObject(armRoot);
  const minDelta = preRigBox.min.distanceTo(postRigBox.min);
  const maxDelta = preRigBox.max.distanceTo(postRigBox.max);
  if (minDelta > BBOX_TOLERANCE || maxDelta > BBOX_TOLERANCE) {
    throw new Error(
      `Arm rig self-check failed: bbox drift after rigging (min ${minDelta.toFixed(6)}, max ${maxDelta.toFixed(6)})`,
    );
  }

  const headNode = requireNode(byName, 'head1_low');

  // Phase 03 explode targets. baseCircleLow stays a direct child of base_LP
  // (excluded from BASE_PART_NAMES, so it never yawed and never got
  // re-parented); wheel1/2/3Low + head2/plugsLow were already located above
  // via attachWithOffset / the BASE_PART_NAMES loop's sibling lookups.
  const baseCircleLow = requireNode(byName, 'base_circle_low');
  const base6Low = requireNode(byName, 'base6_low');
  const wheel1Low = requireNode(byName, 'wheel1_low');
  const wheel2Low = requireNode(byName, 'wheel2_low');
  const wheel3Low = requireNode(byName, 'wheel3_low');
  const head2Low = requireNode(byName, 'head2_low');
  const plugsLow = requireNode(byName, 'plugs_low');

  // Rest positions captured once, empirically (the values already assigned
  // above by attachWithOffset for the wheel nodes, or the untouched identity
  // (0,0,0) for base_circle_low/base6_low/head2_low/plugs_low) — explode
  // offsets are always written as rest + t*delta (absolute), never `+=`, so
  // repeated setExplode calls never drift.
  const restShoulder = shoulderGroup.position.clone();
  const restElbow = elbowGroup.position.clone();
  const restPlinth = baseCircleLow.position.clone();
  const restBaseCollar = base6Low.position.clone();
  const restWheel1 = wheel1Low.position.clone();
  const restWheel2 = wheel2Low.position.clone();
  const restWheel3 = wheel3Low.position.clone();
  const restHead1 = headNode.position.clone();
  const restHead2 = head2Low.position.clone();
  const restPlugs = plugsLow.position.clone();

  let lastExplodeT = Number.NaN; // NaN never equals itself -> forces first apply

  function applyOffset(node: THREE.Object3D, rest: THREE.Vector3, key: ExplodeKey, t: number): void {
    const d = offsetAt(key, t);
    node.position.set(rest.x + d.x, rest.y + d.y, rest.z + d.z);
  }

  return {
    setPose(pose: ArmPose): void {
      const clamped = clampPose(pose);
      yawGroup.rotation.y = clamped.baseYawDeg * DEG;
      shoulderGroup.rotation.z = clamped.shoulderPitchDeg * DEG;
      elbowGroup.rotation.z = clamped.elbowPitchDeg * DEG;
    },
    pivotWorldPositions(): Record<'base' | 'shoulder' | 'elbow' | 'head', THREE.Vector3> {
      return {
        base: yawGroup.getWorldPosition(new THREE.Vector3()),
        shoulder: shoulderGroup.getWorldPosition(new THREE.Vector3()),
        elbow: elbowGroup.getWorldPosition(new THREE.Vector3()),
        head: headNode.getWorldPosition(new THREE.Vector3()),
      };
    },
    setExplode(t01: number): void {
      if (!Number.isNaN(lastExplodeT) && Math.abs(t01 - lastExplodeT) < EXPLODE_EPSILON) return;
      lastExplodeT = t01;

      applyOffset(baseCircleLow, restPlinth, 'plinth', t01);
      applyOffset(base6Low, restBaseCollar, 'baseCollar', t01);
      applyOffset(shoulderGroup, restShoulder, 'shoulder', t01);
      applyOffset(wheel1Low, restWheel1, 'wheel1', t01);
      applyOffset(elbowGroup, restElbow, 'elbow', t01);
      applyOffset(wheel2Low, restWheel2, 'wheel2', t01);
      applyOffset(headNode, restHead1, 'head', t01);
      applyOffset(head2Low, restHead2, 'head', t01);
      applyOffset(plugsLow, restPlugs, 'head', t01);
      applyOffset(wheel3Low, restWheel3, 'wheel3', t01);
    },
  };
}
