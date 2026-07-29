import React, { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import RatingStars from "../RatingStars/RatingStars";
import styles from "./SliderRating.module.css";

interface SliderRatingProps {
  value: number;
  onChange: (value: number) => void;
  onChangeComplete?: (value: number) => void;
  size?: number;
  label?: string;
  disabled?: boolean;
}

export default function SliderRating({ value, onChange, onChangeComplete, size = 32, label, disabled = false }: SliderRatingProps) {
  const t = useTranslations("Review");
  const [localValue, setLocalValue] = useState(value);

  // Sync with external value if it changes
  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVal = parseFloat(e.target.value);
    setLocalValue(newVal);
    onChange(newVal);
  };

  const handleDragEnd = () => {
    if (onChangeComplete) {
      onChangeComplete(localValue);
    }
  };

  const handleKeyUp = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End"].includes(e.key)) {
      onChangeComplete?.(parseFloat(e.currentTarget.value));
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.starsWrapper}>
        <RatingStars value={localValue} size={size} interactive={false} />
        <span className={styles.ratingText}>{localValue.toFixed(1)}</span>
      </div>
      
      <div className={styles.sliderContainer}>
        <input 
          type="range" 
          min="0.5" 
          max="5" 
          step="0.5" 
          value={localValue || 0.5} 
          onChange={handleChange} 
          onMouseUp={handleDragEnd}
          onTouchEnd={handleDragEnd}
          onKeyUp={handleKeyUp}
          className={styles.slider} 
          aria-label={label ?? t("yourRating")}
          aria-valuetext={t("ratingValue", { value: localValue })}
          disabled={disabled}
          style={{
            // Fill background before thumb dynamically
            background: `linear-gradient(to right, var(--primary) ${((localValue || 0.5) - 0.5) / 4.5 * 100}%, rgba(255, 255, 255, 0.1) ${((localValue || 0.5) - 0.5) / 4.5 * 100}%)`
          }}
        />
        <div className={styles.marks}>
          <span>0.5</span>
          <span>5.0</span>
        </div>
      </div>
    </div>
  );
}
