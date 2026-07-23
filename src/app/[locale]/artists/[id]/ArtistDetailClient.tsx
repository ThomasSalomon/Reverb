"use client";

import { useEffect, useState } from "react";
import { Link } from "@/i18n/routing";
import { useTranslations, useLocale } from "next-intl";

import { motion, useScroll, useTransform } from "framer-motion";
import styles from "./page.module.css";
import Cover3D from "@/components/Cover3D/Cover3D";

interface ArtistData {
  artist: {
    id: string;
    name: string;
    pictureUrl: string;
    pictureXlUrl: string;
    nb_fan: number;
    nb_album: number;
  };
  topTracks: Array<{
    id: string;
    title: string;
    duration: string;
    album: { id: string; title: string };
  }>;
  albums: Array<{
    id: string;
    title: string;
    artist: string;
    coverUrl: string;
    releaseYear: number;
  }>;
  related: Array<{
    id: string;
    name: string;
    pictureUrl: string;
  }>;
}

export default function ArtistDetailClient({
  id,
  initialData,
}: {
  id: string;
  initialData: ArtistData | null;
}) {
  const t = useTranslations("Artist");
  const locale = useLocale();
  const [data, setData] = useState<ArtistData | null>(initialData);
  const [loading, setLoading] = useState(!initialData);

  const { scrollY } = useScroll();
  const y = useTransform(scrollY, [0, 500], [0, 200]);
  const opacity = useTransform(scrollY, [0, 300], [1, 0]);
  const scale = useTransform(scrollY, [0, 300], [1, 0.95]);

  useEffect(() => {
    if (!initialData) {
      const fetchArtist = async () => {
        try {
          const res = await fetch(`/api/artists/${encodeURIComponent(id)}`);
          if (res.ok) {
            const json = await res.json();
            setData(json);
          }
        } catch (error) {
          console.error("Failed to fetch artist data", error);
        } finally {
          setLoading(false);
        }
      };
      fetchArtist();
    }
  }, [id, initialData]);

  if (loading) {
    return (
      <div className={styles.container}>
        <div style={{ padding: "100px", textAlign: "center", color: "#a1a1aa" }}>
          {t("loading")}
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className={styles.container}>
        <div style={{ padding: "100px", textAlign: "center", color: "#ef4444" }}>
          {t("notFound")}
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>

      <div className={styles.hero}>
        <motion.div className={styles.heroBackground} style={{ y }}>
          <img
            src={data.artist.pictureXlUrl}
            alt={data.artist.name}
            className={styles.heroImage}
            style={{ width: "100%", height: "100%" }}
          />
        </motion.div>
        <div className={styles.heroOverlay} />
        
        <motion.div className={styles.heroContent} style={{ opacity, scale }}>
          <h1 className={styles.artistName}>{data.artist.name}</h1>
          <div className={styles.artistStats}>
            <span className={styles.fansCount}>
              {new Intl.NumberFormat(locale).format(data.artist.nb_fan)}
            </span>{" "}
            {t("fans")}
          </div>
        </motion.div>
      </div>

      <div className={styles.contentContainer}>
        <div className={styles.contentInner}>
          
          <div className={styles.topSectionGrid}>
            <div>
              <h2 className={styles.sectionTitle}>{t("topTracks")}</h2>
              <div className={styles.trackList}>
                {data.topTracks.map((track, i) => (
                  <div key={track.id} className={styles.trackItem}>
                    <span className={styles.trackNumber}>{i + 1}</span>
                    <div className={styles.trackInfo}>
                      <span className={styles.trackTitle}>{track.title}</span>
                      <span className={styles.trackAlbum}>{track.album.title}</span>
                    </div>
                    <span className={styles.trackDuration}>{track.duration}</span>
                  </div>
                ))}
                {data.topTracks.length === 0 && (
                  <p style={{ color: "var(--text-muted)" }}>{t("noTopTracks")}</p>
                )}
              </div>
            </div>

            <div>
              <h2 className={styles.sectionTitle}>{t("relatedArtists")}</h2>
              <div className={styles.relatedGrid}>
                {data.related.map((artist) => (
                  <Link href={`/artists/${artist.id}`} key={artist.id} className={styles.relatedCard}>
                    <div className={styles.relatedImageContainer}>
                      <img
                        src={artist.pictureUrl}
                        alt={artist.name}
                        className={styles.relatedImage}
                        style={{ width: "100%", height: "100%", objectFit: "cover" }}
                      />
                    </div>
                    <span className={styles.relatedName}>{artist.name}</span>
                  </Link>
                ))}
              </div>
            </div>
          </div>

          <div>
            <h2 className={styles.sectionTitle}>{t("discography")}</h2>
            <div className={styles.albumsGrid}>
              {data.albums.map((album) => (
                <div key={album.id} style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  <Link href={`/albums/${album.id}`}>
                    <Cover3D src={album.coverUrl} alt={album.title} size="100%" />
                  </Link>
                  <div style={{ display: "flex", flexDirection: "column" }}>
                    <Link href={`/albums/${album.id}`} style={{ fontWeight: 600, color: "var(--text-primary)", textDecoration: "none", fontSize: "1rem", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {album.title}
                    </Link>
                    <span style={{ fontSize: "0.85rem", color: "var(--text-secondary)" }}>{album.releaseYear}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
