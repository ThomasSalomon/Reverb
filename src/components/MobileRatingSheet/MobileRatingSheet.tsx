import React, { useEffect, useState } from "react";
import styles from "./MobileRatingSheet.module.css";
import SliderRating from "../SliderRating/SliderRating";
import { useTranslations } from "next-intl";
import AccessibleDialog from "@/components/AccessibleDialog/AccessibleDialog";

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
    }
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
    <AccessibleDialog
      isOpen={isOpen || isAnimatingOut}
      onClose={handleClose}
      labelledBy="mobile-rating-sheet-title"
      className={`${styles.overlay} ${isAnimatingOut ? styles.fadeOut : ""}`}
    >
      <div 
        className={`${styles.sheet} ${isAnimatingOut ? styles.slideDown : ""}`}
      >
        <div className={styles.dragHandle} />
        
        <h3 id="mobile-rating-sheet-title" className={styles.title}>{t("rateAlbum")}</h3>
        <p className={styles.subtitle}>{albumTitle}</p>
        
        <div className={styles.starsWrapper}>
          <SliderRating 
            value={localRating || 0.5} 
            onChange={handleRate} 
            size={36} 
          />
        </div>
        
        <div className={styles.actions}>
          <button type="button" data-dialog-initial-focus className={styles.cancelBtn} onClick={handleClose}>
            {common("cancel")}
          </button>
          <button type="button" className="neon-btn" onClick={handleSave} style={{ padding: "12px 24px", width: "100%" }}>
            {common("save")}
          </button>
        </div>
      </div>
    </AccessibleDialog>
  );
}
