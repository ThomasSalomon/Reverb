"use client";

import React, { useRef, useEffect } from "react";
import styles from "./Cover3D.module.css";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";
import { getCoverTilt } from "@/utils/cover-tilt";

interface Cover3DProps {
  src: string;
  alt: string;
  size?: number | string;
}

export default function Cover3D({ src, alt, size = 300 }: Cover3DProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const glowRef = useRef<HTMLDivElement>(null);
  const prefersReducedMotion = usePrefersReducedMotion();
  
  // Cache the bounding rect to avoid layout thrashing on mousemove
  const rectRef = useRef<DOMRect | null>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (prefersReducedMotion) {
      rectRef.current = null;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (cardRef.current) cardRef.current.style.transform = "rotateX(0deg) rotateY(0deg) scale(1)";
      if (glowRef.current) glowRef.current.style.background = "transparent";
      return;
    }

    const handleScroll = () => {
      rectRef.current = null;
    };
    window.addEventListener("scroll", handleScroll, { passive: true });

    return () => {
      window.removeEventListener("scroll", handleScroll);
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, [prefersReducedMotion]);

  const handleMouseEnter = () => {
    if (containerRef.current) {
      rectRef.current = containerRef.current.getBoundingClientRect();
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (prefersReducedMotion) return;
    const card = cardRef.current;
    const glow = glowRef.current;
    if (!card) return;

    // Fallback if mouseenter was missed
    if (!rectRef.current && containerRef.current) {
      rectRef.current = containerRef.current.getBoundingClientRect();
    }
    if (!rectRef.current) return;

    const rect = rectRef.current;
    const x = e.clientX - rect.left; // cursor x relative to card
    const y = e.clientY - rect.top;  // cursor y relative to card

    const tilt = getCoverTilt(false, { x, y, width: rect.width, height: rect.height });

    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => {
      card.style.transform = tilt.transform;
      if (glow) {
        glow.style.background = tilt.glow;
      }
    });
  };

  const handleMouseLeave = () => {
    if (prefersReducedMotion) return;
    const card = cardRef.current;
    const glow = glowRef.current;
    rectRef.current = null; // Clear cache on leave
    if (!card) return;

    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => {
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
      onMouseEnter={prefersReducedMotion ? undefined : handleMouseEnter}
      onMouseMove={prefersReducedMotion ? undefined : handleMouseMove}
      onMouseLeave={prefersReducedMotion ? undefined : handleMouseLeave}
      style={{ width: sizeStyle, height: sizeStyle }}
    >
      <div ref={cardRef} className={styles.card}>
        <div ref={glowRef} className={styles.glow} />
        <img src={src} alt={alt} className={styles.image} loading="lazy" />
      </div>
    </div>
  );
}
