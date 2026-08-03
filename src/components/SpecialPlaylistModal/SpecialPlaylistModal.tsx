"use client";

import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Link } from "@/i18n/routing";
import styles from "./SpecialPlaylistModal.module.css";
import Image from "next/image";
import { useTranslations } from "next-intl";
import AccessibleDialog from "@/components/AccessibleDialog/AccessibleDialog";
import { MOTION_DURATION, MOTION_EASE, reducedMotionDuration } from "@/utils/motion";
import type { DeezerTrack } from "@/services/deezer.service";

interface Props {
  artistName: string;
  onClose: () => void;
}

export default function SpecialPlaylistModal({ artistName, onClose }: Props) {
  const t = useTranslations("Home");
  const common = useTranslations("Common");
  const [tracks, setTracks] = useState<DeezerTrack[]>([]);
  const [importTicket, setImportTicket] = useState<string | null>(null);
  const [artistPic, setArtistPic] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [needsLogin, setNeedsLogin] = useState(false);
  const prefersReducedMotion = useReducedMotion();

  useEffect(() => {
    async function fetchTracks() {
      try {
        const res = await fetch("/api/events/today/tracks");
        if (res.ok) {
          const { artist, tracks, ticket } = await res.json();
          setTracks(tracks);
          setImportTicket(typeof ticket === "string" ? ticket : null);
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
          title: t("tributeListTitle", { artist: artistName }),
          description: t("tributeListDescription", { artist: artistName }),
          ticket: importTicket,
          tracks: tracks.map((track) => ({
            externalId: String(track.id),
            type: "SONG",
          })),
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
    <AccessibleDialog isOpen={true} onClose={onClose} labelledBy="special-playlist-dialog-title" className={styles.overlay}>
      <motion.div
        className={styles.modal}
        initial={prefersReducedMotion ? false : { opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={prefersReducedMotion ? undefined : { opacity: 0, scale: 0.95 }}
        transition={{
          duration: reducedMotionDuration(Boolean(prefersReducedMotion), MOTION_DURATION.slow),
          ease: MOTION_EASE.expressive,
        }}
      >
        {artistPic && (
          <img src={artistPic} alt={artistName} className={styles.artistBackground} />
        )}
        
        <div className={styles.header}>
          <h2 id="special-playlist-dialog-title">{t("tributeTitle", { artist: artistName })}</h2>
          <button type="button" data-dialog-initial-focus className={styles.closeButton} onClick={onClose} aria-label={common("close")}>
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
                  initial={prefersReducedMotion ? false : { opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{
                    delay: prefersReducedMotion ? 0 : i * 0.05,
                    duration: reducedMotionDuration(Boolean(prefersReducedMotion), MOTION_DURATION.slow),
                  }}
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

        {!loading && tracks.length > 0 && importTicket && (
          <div className={styles.footer}>
            {saved ? (
              <p className={styles.message}>{t("playlistSaved")}</p>
            ) : needsLogin ? (
              <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
                <p className={styles.trackArtist} style={{ margin: 0 }}>{t("loginToSave")}</p>
                <Link href="/login" className={styles.saveButton} onClick={onClose} style={{ textDecoration: "none" }}>
                  {t("loginBtn")}
                </Link>
              </div>
            ) : (
              <button
                className={styles.saveButton}
                onClick={handleSavePlaylist}
                disabled={saving}
              >
                {saving ? t("savingPlaylist") : t("savePlaylist")}
              </button>
            )}
          </div>
        )}
      </motion.div>
    </AccessibleDialog>
  );
}
