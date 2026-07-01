"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Cover3D from "@/components/Cover3D/Cover3D";
import RatingStars from "@/components/RatingStars/RatingStars";
import ReviewCard from "@/components/ReviewCard/ReviewCard";
import styles from "./page.module.css";

interface MusicItem {
  id: string;
  title: string;
  artist: string;
  type: string;
  coverUrl: string;
  releaseYear: number;
  stats: {
    averageRating: number;
    totalRatings: number;
    totalReviews: number;
  };
}

interface Review {
  id: string;
  content: string;
  ratingValue: number;
  createdAt: string;
  user: {
    id: string;
    username: string;
    profileColor?: string | null;
  };
  musicItem: {
    id: string;
    title: string;
    artist: string;
    coverUrl: string;
    type: string;
  };
  favoriteTrack?: string | null;
  likesCount?: number;
  commentsCount?: number;
  likedByUser?: boolean;
}

export default function HomePage() {
  const [items, setItems] = useState<MusicItem[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [reviewsLoading, setReviewsLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<{ id: string; username: string } | null>(null);
  const [activeFeed, setActiveFeed] = useState<"global" | "following">("global");

  // Fetch initial music catalog and user auth status
  useEffect(() => {
    async function initData() {
      try {
        const [musicRes, meRes] = await Promise.all([
          fetch("/api/music", { cache: "no-store" }),
          fetch("/api/auth/me", { cache: "no-store" }),
        ]);
        const musicData = await musicRes.json();
        setItems(musicData);

        if (meRes.ok) {
          const meData = await meRes.json();
          setCurrentUser(meData.user);
        }
      } catch (e) {
        console.error("Initialization error:", e);
      } finally {
        setLoading(false);
      }
    }
    initData();
  }, []);

  // Fetch reviews whenever activeFeed changes
  useEffect(() => {
    async function fetchReviews() {
      setReviewsLoading(true);
      try {
        const url = activeFeed === "following" ? "/api/reviews?feed=following" : "/api/reviews";
        const res = await fetch(url, { cache: "no-store" });
        if (res.ok) {
          const data = await res.json();
          setReviews(data);
        } else {
          setReviews([]);
        }
      } catch (e) {
        console.error("Fetch reviews error:", e);
        setReviews([]);
      } finally {
        setReviewsLoading(false);
      }
    }
    fetchReviews();
  }, [activeFeed]);

  const handleSearch = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const query = e.target.value;
    setSearchQuery(query);
    try {
      const res = await fetch(`/api/music?q=${encodeURIComponent(query)}`);
      const data = await res.json();
      setItems(data);
    } catch (e) {
      console.error("Search error:", e);
    }
  };

  return (
    <main className={styles.main}>
      <section className={styles.hero}>
        <h1 className={styles.heroTitle}>
          Toma nota de cada <span>ritmo</span>.
        </h1>
        <p className={styles.heroSub}>
          Califica álbumes, escribe reseñas detalladas y lleva un registro de tu viaje musical.
        </p>
        <div className={styles.searchContainer}>
          <input
            type="text"
            value={searchQuery}
            onChange={handleSearch}
            placeholder="Buscar álbumes o artistas..."
            className="input-field"
            style={{ width: "100%", maxWidth: "500px" }}
          />
        </div>
      </section>

      <div className={styles.contentGrid}>
        <section className={styles.musicSection}>
          <h2 className={styles.sectionTitle}>Álbumes Populares</h2>
          {loading ? (
            <div className={styles.loader}>Cargando catálogo musical...</div>
          ) : items.length === 0 ? (
            <div className={styles.noResults}>No se encontraron álbumes</div>
          ) : (
            <div className={styles.albumsGrid}>
              {items.map((item) => (
                <div key={item.id} className={styles.albumCard}>
                  <Link href={`/albums/${item.id}`}>
                    <Cover3D src={item.coverUrl} alt={item.title} size="100%" />
                  </Link>
                  <div className={styles.albumMeta}>
                    <Link href={`/albums/${item.id}`} className={styles.albumTitle}>
                      {item.title}
                    </Link>
                    <span className={styles.albumArtist}>{item.artist}</span>
                    <div className={styles.ratingStats}>
                      <RatingStars value={item.stats.averageRating} size={14} />
                      <span className={styles.statsCount}>({item.stats.totalRatings})</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className={styles.reviewsSection}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>Actividad Reciente</h2>
            {currentUser && (
              <div className={styles.tabs}>
                <button
                  onClick={() => setActiveFeed("global")}
                  className={`${styles.tab} ${activeFeed === "global" ? styles.activeTab : ""}`}
                >
                  Global
                </button>
                <button
                  onClick={() => setActiveFeed("following")}
                  className={`${styles.tab} ${activeFeed === "following" ? styles.activeTab : ""}`}
                >
                  Siguiendo
                </button>
              </div>
            )}
          </div>

          {reviewsLoading ? (
            <div className={styles.loader}>Cargando reseñas...</div>
          ) : activeFeed === "following" && !currentUser ? (
            <div className={styles.loginPrompt}>
              <p>Inicia sesión para ver la actividad de las personas que sigues.</p>
              <Link href="/login" className={styles.loginPromptBtn}>
                Iniciar Sesión
              </Link>
            </div>
          ) : reviews.length === 0 ? (
            <div className={styles.noReviews}>
              {activeFeed === "following"
                ? "No hay reseñas recientes de las personas que sigues. ¡Sigue a algunos melómanos para ver su actividad!"
                : "Aún no hay reseñas escritas. ¡Sé el primero en calificar un álbum!"}
            </div>
          ) : (
            <div className={styles.reviewsList}>
              {reviews.map((review) => (
                <ReviewCard key={review.id} review={review} showMusicDetails={true} />
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
