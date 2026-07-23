"use client";

import React, { useState } from "react";
import RatingStars from "../RatingStars/RatingStars";
import SliderRating from "../SliderRating/SliderRating";
import styles from "./ReviewForm.module.css";
import { useTranslations } from "next-intl";

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
  const t = useTranslations("Review");
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
    { value: "Épico", label: "tagEpic" },
    { value: "Relajante", label: "tagRelaxing" },
    { value: "Melancólico", label: "tagMelancholic" },
    { value: "Enérgico", label: "tagEnergetic" },
    { value: "Oscuro", label: "tagDark" },
    { value: "Experimental", label: "tagExperimental" },
    { value: "Clásico", label: "tagClassic" },
    { value: "Innovador", label: "tagInnovative" },
    { value: "Nostálgico", label: "tagNostalgic" },
    { value: "Divertido", label: "tagFun" }
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
      setError(t("ratingRequired"));
      return;
    }
    if (!content.trim()) {
      setError(t("contentRequired"));
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

      if (!res.ok) {
        throw new Error(t("publishError"));
      }

      setSuccessMsg(t("published"));
      if (onSuccess) {
        onSuccess();
      }
    } catch (e: any) {
      setError(e.message || t("publishError"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className={styles.form}>
      <h3 className={styles.title}>{t("write")}</h3>
      
      <div className={styles.ratingSection}>
        <span className={styles.label}>{t("yourRating")}:</span>
        <div className={styles.desktopRating}>
          <RatingStars value={localRating} onChange={handleRatingChange} interactive={true} size={28} />
        </div>
        <div className={styles.mobileRating}>
          <SliderRating value={localRating || 0.5} onChange={handleRatingChange} size={24} />
        </div>
      </div>

      <div className={styles.tagsSection}>
        <span className={styles.label}>{t("tags")}:</span>
        <div className={styles.tagsContainer}>
          {AVAILABLE_TAGS.map(tag => (
            <div 
              key={tag.value}
              onClick={() => toggleTag(tag.value)}
              className={`${styles.tagPill} ${selectedTags.includes(tag.value) ? styles.tagPillActive : ""}`}
            >
              {t(tag.label)}
            </div>
          ))}
        </div>
      </div>

      <div className={styles.inputSection}>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder={t("contentPlaceholder")}
          rows={5}
          className={styles.textarea}
          disabled={loading}
        />
      </div>

      {error && <div className={styles.errorMsg}>{error}</div>}
      {successMsg && <div className={styles.successMsg}>{successMsg}</div>}

      <button type="submit" className="neon-btn" disabled={loading}>
        {loading ? t("publishing") : t("publish")}
      </button>
    </form>
  );
}
