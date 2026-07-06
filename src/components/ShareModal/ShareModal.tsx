"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./ShareModal.module.css";

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  album: {
    title: string;
    artist: string;
    releaseYear: number;
    coverUrl: string;
  };
  shareUrl: string;
}

interface SocialNetwork {
  name: string;
  color: string;
  getUrl: (url: string, text: string) => string;
  icon: JSX.Element;
}

const SOCIAL_NETWORKS: SocialNetwork[] = [
  {
    name: "WhatsApp",
    color: "#25D366",
    getUrl: (url, text) =>
      `https://wa.me/?text=${encodeURIComponent(`${text} ${url}`)}`,
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" width="22" height="22">
        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" />
        <path d="M12 0C5.373 0 0 5.373 0 12c0 2.135.563 4.14 1.54 5.876L0 24l6.29-1.51A11.934 11.934 0 0 0 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.882a9.867 9.867 0 0 1-5.032-1.377l-.36-.214-3.733.896.938-3.627-.235-.373A9.867 9.867 0 0 1 2.118 12c0-5.449 4.433-9.882 9.882-9.882 5.45 0 9.882 4.433 9.882 9.882 0 5.449-4.432 9.882-9.882 9.882z" />
      </svg>
    ),
  },
  {
    name: "Twitter / X",
    color: "#1DA1F2",
    getUrl: (url, text) =>
      `https://x.com/intent/tweet?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`,
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" width="22" height="22">
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
      </svg>
    ),
  },
  {
    name: "Facebook",
    color: "#1877F2",
    getUrl: (url) =>
      `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`,
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" width="22" height="22">
        <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
      </svg>
    ),
  },
  {
    name: "Telegram",
    color: "#2AABEE",
    getUrl: (url, text) =>
      `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`,
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" width="22" height="22">
        <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
      </svg>
    ),
  },
  {
    name: "Reddit",
    color: "#FF4500",
    getUrl: (url, text) =>
      `https://www.reddit.com/submit?url=${encodeURIComponent(url)}&title=${encodeURIComponent(text)}`,
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" width="22" height="22">
        <path d="M12 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0zm5.01 4.744c.688 0 1.25.561 1.25 1.249a1.25 1.25 0 0 1-2.498.056l-2.597-.547-.8 3.747c1.824.07 3.48.632 4.674 1.488.308-.309.73-.491 1.207-.491.968 0 1.754.786 1.754 1.754 0 .716-.435 1.333-1.01 1.614a3.111 3.111 0 0 1 .042.52c0 2.694-3.13 4.87-7.004 4.87-3.874 0-7.004-2.176-7.004-4.87 0-.183.015-.366.043-.534A1.748 1.748 0 0 1 4.028 12c0-.968.786-1.754 1.754-1.754.463 0 .898.196 1.207.49 1.207-.883 2.878-1.43 4.744-1.487l.885-4.182a.342.342 0 0 1 .14-.197.35.35 0 0 1 .238-.042l2.906.617a1.214 1.214 0 0 1 1.108-.701zM9.25 12C8.561 12 8 12.562 8 13.25c0 .687.561 1.248 1.25 1.248.687 0 1.248-.561 1.248-1.249 0-.688-.561-1.249-1.249-1.249zm5.5 0c-.687 0-1.248.561-1.248 1.25 0 .687.561 1.248 1.249 1.248.688 0 1.249-.561 1.249-1.249 0-.687-.562-1.249-1.25-1.249zm-5.466 3.99a.327.327 0 0 0-.231.094.33.33 0 0 0 0 .463c.842.842 2.484.913 2.961.913.477 0 2.105-.056 2.961-.913a.361.361 0 0 0 .029-.463.33.33 0 0 0-.464 0c-.547.533-1.684.73-2.512.73-.828 0-1.979-.196-2.512-.73a.326.326 0 0 0-.232-.095z" />
      </svg>
    ),
  },
];

// Extract dominant color from an image via canvas (client-side only)
function extractDominantColor(
  imgSrc: string,
  callback: (color: string) => void
): void {
  try {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = 64;
        canvas.height = 64;
        const ctx = canvas.getContext("2d");
        if (!ctx) return callback("#1a1a2e");
        ctx.drawImage(img, 0, 0, 64, 64);
        const data = ctx.getImageData(0, 0, 64, 64).data;

        let r = 0, g = 0, b = 0, count = 0;
        // Sample every 4th pixel, skipping near-black and near-white
        for (let i = 0; i < data.length; i += 16) {
          const pr = data[i], pg = data[i + 1], pb = data[i + 2];
          const brightness = (pr + pg + pb) / 3;
          if (brightness < 30 || brightness > 220) continue;
          r += pr; g += pg; b += pb; count++;
        }
        if (count === 0) return callback("#1a1a2e");
        r = Math.floor(r / count);
        g = Math.floor(g / count);
        b = Math.floor(b / count);
        // Darken the color to keep text readable
        r = Math.floor(r * 0.55);
        g = Math.floor(g * 0.55);
        b = Math.floor(b * 0.55);
        callback(`rgb(${r},${g},${b})`);
      } catch {
        callback("#1a1a2e");
      }
    };
    img.onerror = () => callback("#1a1a2e");
    img.src = imgSrc;
  } catch {
    callback("#1a1a2e");
  }
}

export default function ShareModal({
  isOpen,
  onClose,
  album,
  shareUrl,
}: ShareModalProps) {
  const [copied, setCopied] = useState(false);
  const [ambientColor, setAmbientColor] = useState<string>("#1a1a2e");
  const [visible, setVisible] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Animate in/out
  useEffect(() => {
    if (isOpen) {
      // Tiny delay so CSS transition fires after mount
      requestAnimationFrame(() => setVisible(true));
      document.body.style.overflow = "hidden";
    } else {
      setVisible(false);
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  // Extract ambient color from cover
  useEffect(() => {
    if (isOpen && album.coverUrl) {
      extractDominantColor(album.coverUrl, setAmbientColor);
    }
  }, [isOpen, album.coverUrl]);

  const handleCopy = () => {
    navigator.clipboard.writeText(shareUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) onClose();
  };

  const shareText = `Escucha "${album.title}" de ${album.artist} en ReVerb`;

  if (!isOpen) return null;

  return (
    <div
      className={`${styles.backdrop} ${visible ? styles.backdropVisible : ""}`}
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-label={`Compartir ${album.title}`}
    >
      <div
        className={`${styles.modal} ${visible ? styles.modalVisible : ""}`}
        style={{
          background: `linear-gradient(160deg, ${ambientColor} 0%, #0d0d12 65%)`,
        }}
      >
        {/* Close button */}
        <button
          className={styles.closeBtn}
          onClick={onClose}
          aria-label="Cerrar modal"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>

        {/* Album preview */}
        <div className={styles.albumPreview}>
          <div className={styles.coverWrapper}>
            <img
              src={album.coverUrl}
              alt={`Portada de ${album.title}`}
              className={styles.cover}
            />
            <div className={styles.coverGlow} style={{ background: ambientColor }} />
          </div>
          <div className={styles.albumInfo}>
            <span className={styles.albumLabel}>Compartiendo álbum</span>
            <h2 className={styles.albumTitle}>{album.title}</h2>
            <p className={styles.albumArtist}>
              {album.artist} <span className={styles.dot}>·</span> {album.releaseYear}
            </p>
          </div>
        </div>

        {/* Divider */}
        <div className={styles.divider} />

        {/* Social network buttons */}
        <div className={styles.socialSection}>
          <p className={styles.sectionLabel}>Compartir en</p>
          <div className={styles.socialGrid}>
            {SOCIAL_NETWORKS.map((network) => (
              <a
                key={network.name}
                href={network.getUrl(shareUrl, shareText)}
                target="_blank"
                rel="noopener noreferrer"
                className={styles.socialBtn}
                title={`Compartir en ${network.name}`}
                style={{ "--network-color": network.color } as React.CSSProperties}
              >
                <span className={styles.socialIcon}>
                  {network.icon}
                </span>
                <span className={styles.socialName}>{network.name}</span>
              </a>
            ))}
          </div>
        </div>

        {/* Divider */}
        <div className={styles.divider} />

        {/* Copy link */}
        <div className={styles.copySection}>
          <p className={styles.sectionLabel}>O copia el enlace</p>
          <div className={styles.copyRow}>
            <input
              ref={inputRef}
              type="text"
              readOnly
              value={shareUrl}
              className={styles.urlInput}
              onFocus={() => inputRef.current?.select()}
              aria-label="URL del álbum"
            />
            <button
              className={`${styles.copyBtn} ${copied ? styles.copyBtnCopied : ""}`}
              onClick={handleCopy}
            >
              {copied ? (
                <>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  Copiado
                </>
              ) : (
                <>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                  </svg>
                  Copiar
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
