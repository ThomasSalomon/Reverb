"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Link } from "@/i18n/routing";
import styles from "./SpecialPlaylistModal.module.css";
import Image from "next/image";

interface Props {
  artistName: string;
  onClose: () => void;
}

export default function SpecialPlaylistModal({ artistName, onClose }: Props) {
  const [tracks, setTracks] = useState<any[]>([]);
  const [artistPic, setArtistPic] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [needsLogin, setNeedsLogin] = useState(false);

  useEffect(() => {
    async function fetchTracks() {
      try {
        const res = await fetch("/api/events/today/tracks");
        if (res.ok) {
          const { artist, tracks } = await res.json();
          setTracks(tracks);
          setArtistPic(artist?.picture_xl || null);
        }
      } catch (err) {
        console.error("Failed to fetch tracks", err);
      } finally {
        setLoading(false);
      }
    }
    fetchTracks();
  }, []);

  const handleSavePlaylist = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/lists/save-playlist", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: `Tributo: ${artistName}`,
          description: `Una lista generada en honor a ${artistName}.`,
          tracks,
        }),
      });

      if (res.ok) {
        setSaved(true);
      } else if (res.status === 401) {
        setNeedsLogin(true);
      }
    } catch (err) {
      console.error("Failed to save playlist", err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={styles.overlay} onClick={onClose}>
      <motion.div
        className={styles.modal}
        onClick={(e) => e.stopPropagation()}
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ duration: 0.3, ease: [0.23, 1, 0.32, 1] }}
      >
        {artistPic && (
          <img src={artistPic} alt={artistName} className={styles.artistBackground} />
        )}
        
        <div className={styles.header}>
          <h2>Tributo a {artistName}</h2>
          <button className={styles.closeButton} onClick={onClose} aria-label="Cerrar">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className={styles.content}>
          {loading ? (
            <div className={styles.loader}>
              <div className={styles.spinner} />
            </div>
          ) : (
            <div>
              {tracks.map((track, i) => (
                <motion.div
                  key={track.id}
                  className={styles.trackItem}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05, duration: 0.3 }}
                >
                  <img
                    src={track.album.cover_xl || "https://via.placeholder.com/150"}
                    alt={track.title}
                    className={styles.trackCover}
                  />
                  <div className={styles.trackInfo}>
                    <p className={styles.trackTitle}>{track.title}</p>
                    <p className={styles.trackArtist}>{track.artist.name}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>

        {!loading && tracks.length > 0 && (
          <div className={styles.footer}>
            {saved ? (
              <p className={styles.message}>¡Lista guardada en tu perfil!</p>
            ) : needsLogin ? (
              <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
                <p className={styles.trackArtist} style={{ margin: 0 }}>Debes iniciar sesión para guardar</p>
                <Link href="/login" className={styles.saveButton} onClick={onClose} style={{ textDecoration: "none" }}>
                  Iniciar Sesión
                </Link>
              </div>
            ) : (
              <button
                className={styles.saveButton}
                onClick={handleSavePlaylist}
                disabled={saving}
              >
                {saving ? "Guardando..." : "Guardar Lista"}
              </button>
            )}
          </div>
        )}
      </motion.div>
    </div>
  );
}
