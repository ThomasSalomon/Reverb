export interface CoverTilt {
  transform: string;
  glow: string;
}

export function getCoverTilt(
  prefersReducedMotion: boolean,
  pointer: { x: number; y: number; width: number; height: number },
): CoverTilt {
  if (prefersReducedMotion) {
    return { transform: "rotateX(0deg) rotateY(0deg) scale(1)", glow: "transparent" };
  }

  const normalizedX = pointer.x / pointer.width - 0.5;
  const normalizedY = pointer.y / pointer.height - 0.5;
  const rotateX = -normalizedY * 20;
  const rotateY = normalizedX * 20;

  return {
    transform: `rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale(1.03)`,
    glow: `radial-gradient(circle 160px at ${pointer.x}px ${pointer.y}px, rgba(255, 255, 255, 0.16), transparent)`,
  };
}
