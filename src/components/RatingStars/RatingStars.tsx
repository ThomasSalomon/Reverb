"use client";

import React, { useId, useState } from "react";
import { useTranslations } from "next-intl";
import styles from "./RatingStars.module.css";

interface RatingStarsProps {
  value: number;
  onChange?: (newValue: number) => void;
  interactive?: boolean;
  size?: number;
  label?: string;
  disabled?: boolean;
  invalid?: boolean;
  feedbackValue?: number | null;
  feedbackId?: number;
}

const RATING_VALUES = Array.from({ length: 10 }, (_, index) => (index + 1) / 2);

export default function RatingStars({
  value,
  onChange,
  interactive = false,
  size = 24,
  label,
  disabled = false,
  invalid = false,
  feedbackValue = null,
  feedbackId = 0,
}: RatingStarsProps) {
  const t = useTranslations("Review");
  const [hoverValue, setHoverValue] = useState<number | null>(null);
  const id = useId().replace(/:/g, "");
  const gradientId = `halfStarGrad-${id}`;
  const displayValue = hoverValue ?? value;
  const ratingLabel = label ?? t("yourRating");
  const starWidth = size * 5 + (size / 5) * 4;

  const renderStars = (rating: number) => [1, 2, 3, 4, 5].map((starIndex) => {
    const difference = rating - (starIndex - 1);
    const fillClass = difference >= 1 ? styles.full : difference === 0.5 ? styles.half : styles.empty;
    const receivesFeedback = feedbackValue !== null && Math.ceil(feedbackValue) === starIndex;

    return (
      <svg
        key={`${starIndex}-${receivesFeedback ? feedbackId : 0}`}
        aria-hidden="true"
        className={`${styles.star} ${fillClass} ${receivesFeedback ? styles.feedbackPulse : ""}`}
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={difference === 0.5 ? { fill: `url(#${gradientId})` } : undefined}
      >
        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
      </svg>
    );
  });

  const valueText = value > 0 ? t("ratingValue", { value }) : t("ratingNotSelected");

  if (!interactive) {
    return (
      <span className={styles.starsContainer} role="img" aria-label={`${ratingLabel}: ${valueText}`} style={{ gap: size / 5 }}>
        <svg width="0" height="0" className={styles.defs} aria-hidden="true">
          <defs>
            <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="50%" stopColor="var(--primary)" />
              <stop offset="50%" stopColor="transparent" />
            </linearGradient>
          </defs>
        </svg>
        {renderStars(value)}
      </span>
    );
  }

  return (
    <fieldset className={styles.ratingFieldset} disabled={disabled} aria-invalid={invalid || undefined}>
      <legend className={styles.srOnly}>{ratingLabel}</legend>
      <div className={styles.ratingControl} style={{ width: starWidth }} onMouseLeave={() => setHoverValue(null)}>
        <svg width="0" height="0" className={styles.defs} aria-hidden="true">
          <defs>
            <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="50%" stopColor="var(--primary)" />
              <stop offset="50%" stopColor="transparent" />
            </linearGradient>
          </defs>
        </svg>
        <span className={styles.starsContainer} aria-hidden="true" style={{ gap: size / 5 }}>
          {renderStars(displayValue)}
        </span>
        {RATING_VALUES.map((rating, index) => {
          const optionId = `${id}-${rating}`;
          return (
            <React.Fragment key={rating}>
              <input
                id={optionId}
                className={styles.ratingOption}
                type="radio"
                name={`rating-${id}`}
                value={rating}
                checked={value === rating}
                onChange={() => onChange?.(rating)}
              />
              <label
                htmlFor={optionId}
                className={styles.ratingOptionLabel}
                style={{ left: `${index * 10}%` }}
                onMouseEnter={() => setHoverValue(rating)}
              >
                <span className={styles.srOnly}>{t("ratingValue", { value: rating })}</span>
              </label>
            </React.Fragment>
          );
        })}
      </div>
      <span className={styles.ratingText} aria-hidden="true">{displayValue > 0 ? displayValue.toFixed(1) : "—"}</span>
    </fieldset>
  );
}
