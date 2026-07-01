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
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        {/* Decorative aurora glow behind the card — GPU-only animation */}
        <div className={styles.auroraGlow} aria-hidden="true" />
        
        {/* Top decorative light bar */}
        <div className={styles.topLightBar} aria-hidden="true" />

        <button className={styles.closeBtn} onClick={onClose} aria-label="Cerrar">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>

        <div className={styles.content}>
          {loading && (
            <div className={styles.loaderContainer}>
              <div className={styles.loaderRing} />
              <span className={styles.loaderText}>Calculando tu año en música…</span>
            </div>
          )}
          
          {error && <div className={styles.error}>{error}</div>}

          {!loading && !error && data && (
            <>
              {data.hasData ? (
                <>
                  {/* Year badge */}
                  <div className={styles.yearBadge}>{data.year}</div>

                  <h2 className={styles.title}>Reverb Recap</h2>
                  <p className={styles.subtitle}>Tu viaje musical de este año</p>

                  <div className={styles.statGrid}>
                    {/* Reviews Card */}
                    <div className={styles.statCard}>
                      <div className={styles.cardGlow} aria-hidden="true" />
                      <div className={styles.cardHeader}>
                        <span className={styles.statLabel}>Reseñas</span>
                        <div className={styles.iconCircle}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                          </svg>
                        </div>
                      </div>
                      <span className={styles.statValue}>{data.totalReviews}</span>
                    </div>
                    
                    {/* Rating Card */}
                    <div className={styles.statCard}>
                      <div className={styles.cardGlow} aria-hidden="true" />
                      <div className={styles.cardHeader}>
                        <span className={styles.statLabel}>Nota Promedio</span>
                        <div className={`${styles.iconCircle} ${styles.iconCircleGold}`}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
                          </svg>
                        </div>
                      </div>
                      <span className={styles.statValue}>{data.avgRating}</span>
                    </div>
                    
                    {/* Mood Card — full width */}
                    <div className={`${styles.statCard} ${styles.statCardWide}`}>
                      <div className={styles.cardGlow} aria-hidden="true" />
                      <div className={styles.cardHeader}>
                        <span className={styles.statLabel}>Mood Dominante</span>
                        <div className={styles.waveContainer}>
                          <span className={styles.waveBar}></span>
                          <span className={styles.waveBar}></span>
                          <span className={styles.waveBar}></span>
                          <span className={styles.waveBar}></span>
                          <span className={styles.waveBar}></span>
                        </div>
                      </div>
                      <span className={styles.statValue}>{data.topTag}</span>
                    </div>
                  </div>

                  {/* Top Artist — Hero Card */}
                  <div className={styles.topArtist}>
                    <div className={styles.cardGlow} aria-hidden="true" />
                    <div className={styles.topArtistInner}>
                      <span className={styles.topArtistLabel}>Tu artista más escuchado</span>
                      <span className={styles.topArtistValue}>{data.topArtist}</span>
                    </div>
                    <div className={styles.topArtistDecor} aria-hidden="true">
                      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" opacity="0.15">
                        <path d="M9 18V5l12-2v13"></path>
                        <circle cx="6" cy="18" r="3"></circle>
                        <circle cx="18" cy="16" r="3"></circle>
                      </svg>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <h2 className={styles.title}>Reverb Recap</h2>
                  <p className={styles.subtitle}>Aún no tienes actividad registrada este año.</p>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
