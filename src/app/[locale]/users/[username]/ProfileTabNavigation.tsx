"use client";

import { KeyboardEvent, useEffect, useId, useRef } from "react";
import { motion } from "framer-motion";
import { useTranslations } from "next-intl";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";
import { MOTION_DURATION, MOTION_EASE, reducedMotionDuration } from "@/utils/motion";
import type { ProfileTab } from "@/utils/profile-tabs";
import styles from "./page.module.css";

interface ProfileTabNavigationProps {
  activeTab: ProfileTab;
  availableTabs: readonly ProfileTab[];
  onSelect: (tab: ProfileTab) => void;
}

export default function ProfileTabNavigation({
  activeTab,
  availableTabs,
  onSelect,
}: ProfileTabNavigationProps) {
  const t = useTranslations("Profile");
  const prefersReducedMotion = usePrefersReducedMotion();
  const motionId = useId();
  const tabRefs = useRef<Record<ProfileTab, HTMLButtonElement | null>>({
    reviews: null,
    lists: null,
    diary: null,
    stats: null,
    "listen-later": null,
  });

  useEffect(() => {
    tabRefs.current[activeTab]?.scrollIntoView({
      behavior: prefersReducedMotion ? "auto" : "smooth",
      block: "nearest",
      inline: "nearest",
    });
  }, [activeTab, prefersReducedMotion]);

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>, currentTab: ProfileTab) => {
    const currentIndex = availableTabs.indexOf(currentTab);
    let nextIndex = currentIndex;

    if (event.key === "ArrowRight") nextIndex = (currentIndex + 1) % availableTabs.length;
    else if (event.key === "ArrowLeft") nextIndex = (currentIndex - 1 + availableTabs.length) % availableTabs.length;
    else if (event.key === "Home") nextIndex = 0;
    else if (event.key === "End") nextIndex = availableTabs.length - 1;
    else if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onSelect(currentTab);
      return;
    } else return;

    event.preventDefault();
    tabRefs.current[availableTabs[nextIndex]]?.focus();
  };

  const labels: Record<ProfileTab, string> = {
    reviews: t("reviews"),
    lists: t("lists"),
    diary: t("diary"),
    stats: t("statistics"),
    "listen-later": t("listenLater"),
  };

  return (
    <div className={styles.tabsContainer} role="tablist" aria-label={t("profileSections")}>
      {availableTabs.map((tab) => {
        const isActive = activeTab === tab;

        return (
          <button
            key={tab}
            ref={(element) => { tabRefs.current[tab] = element; }}
            id={`profile-tab-${tab}`}
            role="tab"
            aria-selected={isActive}
            aria-controls={`profile-tab-panel-${tab}`}
            tabIndex={isActive ? 0 : -1}
            onClick={() => onSelect(tab)}
            onKeyDown={(event) => handleKeyDown(event, tab)}
            className={`${styles.tabBtn} ${isActive ? styles.tabBtnActive : ""}`}
          >
            {labels[tab]}
            {isActive && (
              <motion.span
                aria-hidden="true"
                className={styles.tabIndicator}
                layoutId={`profile-tab-indicator-${motionId}`}
                transition={{
                  duration: reducedMotionDuration(prefersReducedMotion, MOTION_DURATION.fast),
                  ease: MOTION_EASE.expressive,
                }}
              />
            )}
          </button>
        );
      })}
    </div>
  );
}
