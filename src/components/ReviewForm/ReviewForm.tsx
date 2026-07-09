"use client";

import React, { useState } from "react";
import RatingStars from "../RatingStars/RatingStars";
import SliderRating from "../SliderRating/SliderRating";
import styles from "./ReviewForm.module.css";

interface ReviewFormProps {
  musicItemId: string;
  initialContent?: string;
  rating?: number;
  onRatingChange?: (rating: number) => void;
  onSuccess?: () => void;
}

export default function ReviewForm({
  musicItemId,
  initialContent = "",
  rating = 0,
  onRatingChange,
  onSuccess,
}: ReviewFormProps) {
  const [content, setContent] = useState(initialContent);
  const [localRating, setLocalRating] = useState(rating);

  React.useEffect(() => {
    setLocalRating(rating);
  }, [rating]);

  const handleRatingChange = (newVal: number) => {
    setLocalRating(newVal);
    if (onRatingChange) {
      onRatingChange(newVal);
    }
  };
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);

  const AVAILABLE_TAGS = [
    "Épico", "Relajante", "Melancólico", "Enérgico", "Oscuro",
    "Experimental", "Clásico", "Innovador", "Nostálgico", "Divertido"
  ];

  const toggleTag = (tag: string) => {
    setSelectedTags(prev => 
      prev.includes(tag) 
        ? prev.filter(t => t !== tag)
        : prev.length < 5 ? [...prev, tag] : prev
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (localRating === 0) {
      setError("Por favor, selecciona una calificación de estrellas");
      return;
    }
    if (!content.trim()) {
      setError("Por favor, escribe el contenido de la reseña");
      return;
    }

    setLoading(true);
    setError(null);
    setSuccessMsg(null);

    try {
      const res = await fetch("/api/reviews", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          musicItemId,
          content,
          ratingValue: localRating,
          tags: selectedTags,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Algo salió mal");
      }

      setSuccessMsg("¡Reseña publicada con éxito!");
      if (onSuccess) {
        onSuccess();
      }
    } catch (e: any) {
      setError(e.message || "Error al publicar la reseña");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className={styles.form}>
      <h3 className={styles.title}>Escribe tu Reseña</h3>
      
      <div className={styles.ratingSection}>
        <span className={styles.label}>Tu Calificación:</span>
        <div className={styles.desktopRating}>
          <RatingStars value={localRating} onChange={handleRatingChange} interactive={true} size={28} />
        </div>
        <div className={styles.mobileRating}>
          <SliderRating value={localRating || 0.5} onChange={handleRatingChange} size={24} />
        </div>
      </div>

      <div className={styles.tagsSection}>
        <span className={styles.label}>Tags / Mood (Max 5):</span>
        <div className={styles.tagsContainer}>
          {AVAILABLE_TAGS.map(tag => (
            <div 
              key={tag}
              onClick={() => toggleTag(tag)}
              className={`${styles.tagPill} ${selectedTags.includes(tag) ? styles.tagPillActive : ""}`}
            >
              {tag}
            </div>
          ))}
        </div>
      </div>

      <div className={styles.inputSection}>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="¿Qué opinas de este álbum? Cuenta los detalles..."
          rows={5}
          className={styles.textarea}
          disabled={loading}
        />
      </div>

      {error && <div className={styles.errorMsg}>{error}</div>}
      {successMsg && <div className={styles.successMsg}>{successMsg}</div>}

      <button type="submit" className="neon-btn" disabled={loading}>
        {loading ? "Publicando..." : "Publicar Reseña"}
      </button>
    </form>
  );
}
