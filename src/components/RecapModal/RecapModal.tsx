"use client";

import React, { useEffect, useState } from "react";
import styles from "./RecapModal.module.css";
import { useBodyScrollLock } from "@/hooks/useBodyScrollLock";

interface RecapModalProps {
  username: string;
  onClose: () => void;
}

export default function RecapModal({ username, onClose }: RecapModalProps) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useBodyScrollLock(true);

  useEffect(() => {
    async function fetchRecap() {
      try {
        const year = new Date().getFullYear();
        const res = await fetch(`/api/users/${username}/recap?year=${year}`);
        const json = await res.json();

        if (!res.ok) {
          throw new Error(json.error || "Error al cargar recap");
        }

        setData(json);
      } catch (err: any) {
        setError(err.message || "Error de red");
      } finally {
        setLoading(false);
      }
    }

    fetchRecap();
  }, [username]);

  return (
    <div className={styles.wrapper} onClick={onClose}>
      <div className={styles.overlay} />
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        {/* Animated Background Mesh Blobs — GPU Accelerated */}
        <div className={styles.blob1} aria-hidden="true" />
        <div className={styles.blob2} aria-hidden="true" />
        <div className={styles.blob3} aria-hidden="true" />
        
        {/* Top decorative light bar */}
        <div className={styles.topLightBar} aria-hidden="true" />

        <button className={styles.closeBtn} onClick={onClose} aria-label="Cerrar">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>

        <div className={styles.content}>
          {loading && (
            <div className={styles.loaderContainer}>
              <div className={styles.loaderRing} />
              <span className={styles.loaderText}>Sincronizando tus frecuencias…</span>
            </div>
          )}
          
          {error && <div className={styles.error}>{error}</div>}

          {!loading && !error && data && (
            <>
              {/* Giant Outline Year Background for depth */}
              <div className={styles.bgYear} aria-hidden="true">{data.year}</div>

              {/* Year badge */}
              <div className={styles.yearBadge}>RTM RECAP</div>

              <h2 className={styles.title}>Frecuencias de {data.year}</h2>
              <p className={styles.subtitle}>Tu año en música, decodificado.</p>

              <div className={styles.statGrid}>
                {/* Reviews Card */}
                <div className={styles.statCard}>
                  <div className={styles.cardGlow} aria-hidden="true" />
                  <div className={styles.cardHeader}>
                    <span className={styles.statLabel}>Reseñas</span>
                    <div className={styles.iconCircle}>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                      </svg>
                    </div>
                  </div>
                  <div className={styles.statMain}>
                    <span className={styles.statValue}>{data.totalReviews}</span>
                    {/* Decorative Mini Spark Graph */}
                    <svg className={styles.sparkGraph} viewBox="0 0 100 30" width="100%" height="24">
                      <path d="M0,25 Q15,5 30,18 T60,8 T90,20 L100,10" fill="none" stroke="hsla(186, 100%, 55%, 0.4)" strokeWidth="2" strokeLinecap="round" />
                      <circle cx="100" cy="10" r="3" fill="var(--primary, #00e575)" />
                    </svg>
                  </div>
                </div>
                
                {/* Rating Card */}
                <div className={styles.statCard}>
                  <div className={styles.cardGlow} aria-hidden="true" />
                  <div className={styles.cardHeader}>
                    <span className={styles.statLabel}>Calificación</span>
                    <div className={`${styles.iconCircle} ${styles.iconCircleGold}`}>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
                        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
                      </svg>
                    </div>
                  </div>
                  <div className={styles.statMain}>
                    <span className={styles.statValue}>{data.avgRating}</span>
                    <div className={styles.ratingStarsContainer}>
                      {"★".repeat(Math.round(data.avgRating || 0))}
                      {"☆".repeat(5 - Math.round(data.avgRating || 0))}
                    </div>
                  </div>
                </div>
                
                {/* Mood Card — full width */}
                <div className={`${styles.statCard} ${styles.statCardWide}`}>
                  <div className={styles.cardGlow} aria-hidden="true" />
                  <div className={styles.cardHeader}>
                    <span className={styles.statLabel}>Vibe Dominante</span>
                    <div className={styles.waveContainer}>
                      <span className={styles.waveBar}></span>
                      <span className={styles.waveBar}></span>
                      <span className={styles.waveBar}></span>
                      <span className={styles.waveBar}></span>
                      <span className={styles.waveBar}></span>
                    </div>
                  </div>
                  <div className={styles.moodValueContainer}>
                    <span className={styles.statValue}>{data.topTag || "Sin Datos"}</span>
                  </div>
                </div>
              </div>

              {/* Top Artist — Hero Card with spinning Vinyl */}
              <div className={styles.topArtist}>
                <div className={styles.cardGlow} aria-hidden="true" />
                <div className={styles.topArtistInner}>
                  <span className={styles.topArtistLabel}>Tu artista supremo</span>
                  <span className={styles.topArtistValue}>{data.topArtist || "Ninguno"}</span>
                </div>
                
                {/* Premium Spinning Vinyl Disc SVG */}
                <div className={styles.vinylContainer} aria-hidden="true">
                  <svg className={styles.vinylDisc} viewBox="0 0 100 100" width="120" height="120">
                    <circle cx="50" cy="50" r="48" fill="#111" stroke="#222" strokeWidth="1" />
                    {/* Vinyl Grooves */}
                    <circle cx="50" cy="50" r="42" fill="none" stroke="#222" strokeWidth="0.5" strokeDasharray="3,1" />
                    <circle cx="50" cy="50" r="36" fill="none" stroke="#222" strokeWidth="0.5" />
                    <circle cx="50" cy="50" r="30" fill="none" stroke="#222" strokeWidth="0.5" strokeDasharray="5,2" />
                    <circle cx="50" cy="50" r="24" fill="none" stroke="#222" strokeWidth="0.5" />
                    <circle cx="50" cy="50" r="18" fill="none" stroke="#222" strokeWidth="0.5" />
                    {/* Vinyl Center Label */}
                    <circle cx="50" cy="50" r="14" fill="hsla(186, 100%, 55%, 0.25)" stroke="hsla(186, 100%, 55%, 0.4)" strokeWidth="0.8" />
                    <circle cx="50" cy="50" r="5" fill="#08080a" />
                  </svg>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
