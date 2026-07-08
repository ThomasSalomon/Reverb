"use client";

import React from "react";
import styles from "./Footer.module.css";

export default function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className={styles.footer}>
      <div className={styles.content}>
        <div className={styles.copy}>
          © {currentYear} Ride The Music. Todos los derechos reservados.
        </div>
        <div className={styles.attribution}>
          <span>Metadata y catálogo musical provistos por</span>
          <a href="https://developers.deezer.com/" target="_blank" rel="noopener noreferrer" aria-label="Deezer Developers">
            {/* Using a simple text for Deezer or a logo if we had one. Since we don't have the official svg file locally, we can use their text styling or load it from a reliable source. For now, text is safe, but we can also use an img tag pointing to their brand assets if needed. We'll stick to text + stylized for now to ensure no broken images. */}
            Deezer API
          </a>
        </div>
      </div>
    </footer>
  );
}
