export const MOTION_DURATION = {
  fast: 0.16,
  normal: 0.25,
  slow: 0.3,
} as const;

export const MOTION_EASE = {
  expressive: [0.23, 1, 0.32, 1],
  entrance: [0.16, 1, 0.3, 1],
} as const;

export function reducedMotionDuration(prefersReducedMotion: boolean, duration: number) {
  return prefersReducedMotion ? 0 : duration;
}
