// Pure math for the Arm Rig pose. No imports on purpose so this module can
// run under vitest's plain "node" environment without a DOM/WebGL context.

export const DEG = Math.PI / 180;

export function clamp(v: number, min: number, max: number): number {
  return Math.min(Math.max(v, min), max);
}

export interface ArmPose {
  baseYawDeg: number;
  shoulderPitchDeg: number;
  elbowPitchDeg: number;
}

export const ARM_LIMITS: Record<keyof ArmPose, [number, number]> = {
  baseYawDeg: [-60, 60],
  shoulderPitchDeg: [-14, 18],
  elbowPitchDeg: [-30, 12],
};

export function clampPose(pose: ArmPose): ArmPose {
  return {
    baseYawDeg: clamp(pose.baseYawDeg, ARM_LIMITS.baseYawDeg[0], ARM_LIMITS.baseYawDeg[1]),
    shoulderPitchDeg: clamp(
      pose.shoulderPitchDeg,
      ARM_LIMITS.shoulderPitchDeg[0],
      ARM_LIMITS.shoulderPitchDeg[1],
    ),
    elbowPitchDeg: clamp(pose.elbowPitchDeg, ARM_LIMITS.elbowPitchDeg[0], ARM_LIMITS.elbowPitchDeg[1]),
  };
}
