"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import styles from "./SpecialDayBanner.module.css";
import SpecialPlaylistModal from "../SpecialPlaylistModal/SpecialPlaylistModal";
import { useTranslations } from "next-intl";
import { MOTION_EASE, reducedMotionDuration } from "@/utils/motion";

export default function SpecialDayBanner() {
  const t = useTranslations("Home");
  const [eventData, setEventData] = useState<any>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const prefersReducedMotion = useReducedMotion();

  useEffect(() => {
    async function fetchEvent() {
      try {
        const res = await fetch("/api/events/today");
        if (res.status === 200) {
          const data = await res.json();
          setEventData(data);
        }
      } catch (err) {
        console.error("Failed to fetch special event", err);
      }
    }
    fetchEvent();
  }, []);

  if (!eventData) return null;

  return (
    <div style={{ position: "relative", zIndex: 1, display: "contents" }}>
      <motion.div
        className={styles.bannerContainer}
        onClick={() => setIsModalOpen(true)}
        initial={prefersReducedMotion ? false : { opacity: 0, y: -20, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{
          duration: reducedMotionDuration(Boolean(prefersReducedMotion), 0.5),
          ease: MOTION_EASE.expressive,
        }}
      >
        {eventData.artistPicture && (
          <img 
            src={eventData.artistPicture} 
            alt={eventData.artistName} 
            className={styles.artistBackground} 
          />
        )}
        <div className={styles.shimmer} />
        <div className={styles.content}>
          <h2 className={styles.title}>
            {t("specialDayTitle", { artist: eventData.artistName })}
          </h2>
          <p className={styles.subtitle}>
            {eventData.description || t("specialDayFallback", { artist: eventData.artistName })}
          </p>
          <button className={styles.actionButton} tabIndex={-1}>
            {t("viewTribute")}
          </button>
        </div>
      </motion.div>

      <AnimatePresence>
        {isModalOpen && (
          <SpecialPlaylistModal
            artistName={eventData.artistName}
            onClose={() => setIsModalOpen(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
