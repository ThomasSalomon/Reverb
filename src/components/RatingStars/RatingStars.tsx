"use client";

import React, { useState } from "react";
import styles from "./RatingStars.module.css";

interface RatingStarsProps {
  value: number;
  onChange?: (newValue: number) => void;
  interactive?: boolean;
  size?: number;
}

export default function RatingStars({
  value,
  onChange,
  interactive = false,
  size = 24,
}: RatingStarsProps) {
  const [hoverValue, setHoverValue] = useState<number | null>(null);

  const displayValue = hoverValue !== null ? hoverValue : value;

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!interactive) return;
    const container = e.currentTarget;
    const rect = container.getBoundingClientRect();
    const x = e.clientX - rect.left;

    // Calculate rating based on mouse horizontal position
    let rating = (x / rect.width) * 5;
    // Round to nearest 0.5
    rating = Math.ceil(rating * 2) / 2;
    // Bound the values
    rating = Math.max(1, Math.min(5, rating));

    setHoverValue(rating);
  };

  const handleMouseLeave = () => {
    if (!interactive) return;
    setHoverValue(null);
  };

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!interactive || !onChange) return;
    
    const container = e.currentTarget;
    const rect = container.getBoundingClientRect();
    const x = e.clientX - rect.left;

    // Calculate rating based on click horizontal position
    let rating = (x / rect.width) * 5;
    // Round to nearest 0.5
    rating = Math.ceil(rating * 2) / 2;
    // Bound the values
    rating = Math.max(1, Math.min(5, rating));

    onChange(rating);
  };

  const renderStar = (starIndex: number) => {
    const difference = displayValue - (starIndex - 1);

    let fillClass = styles.empty;
    if (difference >= 1) {
      fillClass = styles.full;
    } else if (difference === 0.5) {
      fillClass = styles.half;
    }

    return (
      <svg
        key={starIndex}
        className={`${styles.star} ${fillClass}`}
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
      </svg>
    );
  };

  return (
    <div
      className={`${styles.starsContainer} ${interactive ? styles.interactive : ""}`}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onClick={handleClick}
      style={{ gap: size / 5 }}
    >
      {/* Global defs for rendering half stars with linear gradients */}
      <svg width="0" height="0" style={{ position: "absolute" }}>
        <defs>
          <linearGradient id="halfStarGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="50%" stopColor="var(--primary)" />
            <stop offset="50%" stopColor="transparent" />
          </linearGradient>
        </defs>
      </svg>

      {[1, 2, 3, 4, 5].map((index) => renderStar(index))}

      {interactive && displayValue > 0 && (
        <span className={styles.ratingText}>{displayValue.toFixed(1)}</span>
      )}
    </div>
  );
}
