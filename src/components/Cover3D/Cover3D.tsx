"use client";

import React, { useRef, useEffect } from "react";
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
  
  // Cache the bounding rect to avoid layout thrashing on mousemove
  const rectRef = useRef<DOMRect | null>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
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
  }, []);

  const handleMouseEnter = () => {
    if (containerRef.current) {
      rectRef.current = containerRef.current.getBoundingClientRect();
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
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

    // Normalize coordinates: range -0.5 to 0.5
    const normalizedX = x / rect.width - 0.5;
    const normalizedY = y / rect.height - 0.5;

    // Calculation for rotation degrees (max 20 degrees for premium subtle tilt)
    const rotateX = -normalizedY * 20;
    const rotateY = normalizedX * 20;

    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => {
      card.style.transform = `rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale(1.03)`;
      if (glow) {
        glow.style.background = `radial-gradient(circle 160px at ${x}px ${y}px, rgba(255, 255, 255, 0.16), transparent)`;
      }
    });
  };

  const handleMouseLeave = () => {
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
      onMouseEnter={handleMouseEnter}
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
