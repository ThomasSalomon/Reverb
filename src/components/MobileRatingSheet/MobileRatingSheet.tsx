import React, { useEffect, useState } from "react";
import styles from "./MobileRatingSheet.module.css";
import RatingStars from "../RatingStars/RatingStars";

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
    onRate(value);
    // Auto close after a short delay for a satisfying UX
    setTimeout(() => {
      handleClose();
    }, 400);
  };

  if (!isOpen && !isAnimatingOut) return null;

  return (
    <div className={`${styles.overlay} ${isAnimatingOut ? styles.fadeOut : ""}`} onClick={handleClose}>
      <div 
        className={`${styles.sheet} ${isAnimatingOut ? styles.slideDown : ""}`} 
        onClick={(e) => e.stopPropagation()}
      >
        <div className={styles.dragHandle} />
        
        <h3 className={styles.title}>Calificar Álbum</h3>
        <p className={styles.subtitle}>{albumTitle}</p>
        
        <div className={styles.starsWrapper}>
          <RatingStars 
            value={localRating || 0} 
            interactive={true} 
            onChange={handleRate} 
            size={48} 
          />
        </div>
        
        <button className={styles.cancelBtn} onClick={handleClose}>
          Cancelar
        </button>
      </div>
    </div>
  );
}
