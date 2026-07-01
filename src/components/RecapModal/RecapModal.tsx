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
        <button className={styles.closeBtn} onClick={onClose}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>

        <div className={styles.content}>
          {loading && <div className={styles.loader}>Calculando tu año en música...</div>}
          
          {error && <div className={styles.error}>{error}</div>}

          {!loading && !error && data && (
            <>
              {data.hasData ? (
                <>
                  <h2 className={styles.title}>Reverb Recap {data.year}</h2>
                  <p className={styles.subtitle}>Un vistazo a tu viaje musical de este año.</p>

                  <div className={styles.statGrid}>
                    <div className={styles.statCard}>
                      <span className={styles.statValue}>{data.totalReviews}</span>
                      <span className={styles.statLabel}>Reseñas</span>
                    </div>
                    <div className={styles.statCard}>
                      <span className={styles.statValue}>{data.avgRating}</span>
                      <span className={styles.statLabel}>Nota Promedio</span>
                    </div>
                    <div className={styles.statCard} style={{ gridColumn: "1 / -1" }}>
                      <span className={styles.statValue}>{data.topTag}</span>
                      <span className={styles.statLabel}>Mood Dominante</span>
                    </div>
                  </div>

                  <div className={styles.topArtist}>
                    <span className={styles.topArtistLabel}>Tu artista más escuchado</span>
                    <span className={styles.topArtistValue}>{data.topArtist}</span>
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
