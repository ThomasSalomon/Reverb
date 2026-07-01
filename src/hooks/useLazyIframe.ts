"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Lazy-loads an iframe src only when the element enters the viewport.
 * This prevents third-party scripts (like Deezer) from blocking the main
 * thread while the user is looking at another part of the page.
 */
export function useLazyIframe(src: string) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [activeSrc, setActiveSrc] = useState<string | null>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el || !src) return; // no src yet (album still loading)

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && !activeSrc) {
            setActiveSrc(src);
            observer.disconnect();
          }
        });
      },
      { threshold: 0.05 } // trigger when 5% visible
    );

    observer.observe(el);
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src]);

  return { containerRef, activeSrc };
}
