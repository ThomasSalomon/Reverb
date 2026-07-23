import React, { useEffect, useState } from "react";
import styles from "./MobileRatingSheet.module.css";
import SliderRating from "../SliderRating/SliderRating";
import { useTranslations } from "next-intl";

interface MobileRatingSheetProps {
  isOpen: boolean;
  onClose: () => void;
  albumTitle: string;
  currentRating: number | null;
  onRate: (rating: number) => void;
}

export default function MobileRatingSheet({
  isOpen,
  onClose,
  albumTitle,
  currentRating,
  onRate,
}: MobileRatingSheetProps) {
  const t = useTranslations("Album");
  const common = useTranslations("Common");
  const [localRating, setLocalRating] = useState<number | null>(currentRating);
  const [isAnimatingOut, setIsAnimatingOut] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setLocalRating(currentRating);
      setIsAnimatingOut(false);
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen, currentRating]);

  const handleClose = () => {
    setIsAnimatingOut(true);
    setTimeout(() => {
      onClose();
      setIsAnimatingOut(false);
    }, 300); // Wait for animation to finish
  };

  const handleRate = (value: number) => {
    setLocalRating(value);
  };

  const handleSave = () => {
    if (localRating !== null) {
      onRate(localRating);
    }
    handleClose();
  };

  if (!isOpen && !isAnimatingOut) return null;

  return (
    <div className={`${styles.overlay} ${isAnimatingOut ? styles.fadeOut : ""}`} onClick={handleClose}>
      <div 
        className={`${styles.sheet} ${isAnimatingOut ? styles.slideDown : ""}`} 
        onClick={(e) => e.stopPropagation()}
      >
        <div className={styles.dragHandle} />
        
        <h3 className={styles.title}>{t("rateAlbum")}</h3>
        <p className={styles.subtitle}>{albumTitle}</p>
        
        <div className={styles.starsWrapper}>
          <SliderRating 
            value={localRating || 0.5} 
            onChange={handleRate} 
            size={36} 
          />
        </div>
        
        <div className={styles.actions}>
          <button className={styles.cancelBtn} onClick={handleClose}>
            {common("cancel")}
          </button>
          <button className="neon-btn" onClick={handleSave} style={{ padding: "12px 24px", width: "100%" }}>
            {common("save")}
          </button>
        </div>
      </div>
    </div>
  );
}
