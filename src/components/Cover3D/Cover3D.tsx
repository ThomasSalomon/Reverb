"use client";

import React, { useRef } from "react";
import styles from "./Cover3D.module.css";

interface Cover3DProps {
  src: string;
  alt: string;
  size?: number | string;
}

export default function Cover3D({ src, alt, size = 300 }: Cover3DProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const glowRef = useRef<HTMLDivElement>(null);

  let rafId: number | null = null;

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const container = containerRef.current;
    const card = cardRef.current;
    const glow = glowRef.current;
    if (!container || !card) return;

    const rect = container.getBoundingClientRect();
    const x = e.clientX - rect.left; // cursor x relative to card
    const y = e.clientY - rect.top;  // cursor y relative to card

    // Normalize coordinates: range -0.5 to 0.5
    const normalizedX = x / rect.width - 0.5;
    const normalizedY = y / rect.height - 0.5;

    // Calculation for rotation degrees (max 20 degrees for premium subtle tilt)
    const rotateX = -normalizedY * 20;
    const rotateY = normalizedX * 20;

    if (rafId) cancelAnimationFrame(rafId);
    rafId = requestAnimationFrame(() => {
      card.style.transform = `rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale(1.03)`;
      if (glow) {
        glow.style.background = `radial-gradient(circle 160px at ${x}px ${y}px, rgba(255, 255, 255, 0.16), transparent)`;
      }
    });
  };

  const handleMouseLeave = () => {
    const card = cardRef.current;
    const glow = glowRef.current;
    if (!card) return;

    if (rafId) cancelAnimationFrame(rafId);
    rafId = requestAnimationFrame(() => {
      card.style.transform = "rotateX(0deg) rotateY(0deg) scale(1)";
      if (glow) {
        glow.style.background = "transparent";
      }
    });
  };

  const sizeStyle = typeof size === "number" ? `${size}px` : size;

  return (
    <div
      ref={containerRef}
      className={styles.container}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{ width: sizeStyle, height: sizeStyle }}
    >
      <div ref={cardRef} className={styles.card}>
        <div ref={glowRef} className={styles.glow} />
        <img src={src} alt={alt} className={styles.image} loading="lazy" />
      </div>
    </div>
  );
}
