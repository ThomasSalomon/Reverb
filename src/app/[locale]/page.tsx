"use client";

import { useEffect, useRef, useState } from "react";
import { Link } from "@/i18n/routing";
import { useTranslations } from "next-intl";
import Cover3D from "@/components/Cover3D/Cover3D";
import RatingStars from "@/components/RatingStars/RatingStars";
import ReviewCard from "@/components/ReviewCard/ReviewCard";
import SpecialDayBanner from "@/components/SpecialDayBanner/SpecialDayBanner";
import { isCurrentSearchRequest } from "@/utils/search-request";
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

interface ArtistSearchResult {
  id: string;
  name: string;
  pictureUrl: string;
}

interface SearchResponse {
  artists: ArtistSearchResult[];
  directAlbums: MusicItem[];
  featuredAlbums: MusicItem[];
  partial: boolean;
}

function AlbumGrid({ items, styles }: { items: MusicItem[]; styles: Record<string, string> }) {
  return (
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
            <Link href={`/artists/${encodeURIComponent(item.artist)}`} className={styles.albumArtist}>
              {item.artist}
            </Link>
            <div className={styles.ratingStats}>
              <RatingStars value={item.stats.averageRating} size={14} />
              <span className={styles.statsCount}>({item.stats.totalRatings})</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function HomePage() {
  const t = useTranslations("Home");
  const [items, setItems] = useState<MusicItem[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResponse, setSearchResponse] = useState<SearchResponse | null>(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState(false);
  const [searchRetryKey, setSearchRetryKey] = useState(0);
  const [loading, setLoading] = useState(true);
  const [reviewsLoading, setReviewsLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<{ id: string; username: string } | null>(null);
  const [activeFeed, setActiveFeed] = useState<"global" | "following">("global");
  const searchRequestId = useRef(0);

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

  useEffect(() => {
    const query = searchQuery.trim();
    const requestId = ++searchRequestId.current;

    if (!query) {
      setSearchResponse(null);
      setSearchLoading(false);
      setSearchError(false);
      return;
    }

    if (query.length < 2) {
      setSearchResponse({ artists: [], directAlbums: [], featuredAlbums: [], partial: false });
      setSearchLoading(false);
      setSearchError(false);
      return;
    }

    const controller = new AbortController();
    const timeoutId = window.setTimeout(async () => {
      setSearchLoading(true);
      setSearchError(false);

      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`, {
          cache: "no-store",
          signal: controller.signal,
        });
        if (!res.ok) throw new Error(`Search request failed: ${res.status}`);

        const data: SearchResponse = await res.json();
        if (isCurrentSearchRequest(requestId, searchRequestId.current)) {
          setSearchResponse(data);
        }
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
        if (isCurrentSearchRequest(requestId, searchRequestId.current)) {
          console.error("Search error:", error);
          setSearchError(true);
          setSearchResponse(null);
        }
      } finally {
        if (isCurrentSearchRequest(requestId, searchRequestId.current)) setSearchLoading(false);
      }
    }, 300);

    return () => {
      window.clearTimeout(timeoutId);
      controller.abort();
    };
  }, [searchQuery, searchRetryKey]);

  const isSearchActive = searchQuery.trim().length > 0;
  const hasSearchResults = Boolean(
    searchResponse &&
      (searchResponse.artists.length > 0 ||
        searchResponse.directAlbums.length > 0 ||
        searchResponse.featuredAlbums.length > 0)
  );

  const handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(event.target.value);
    setSearchResponse(null);
  };

  return (
    <main className={styles.main}>
      <section className={styles.hero}>
        <h1 className={styles.heroTitle}>
          {t("heroTitle1")} <span>{t("heroTitleHighlight")}</span>.
        </h1>
        <p className={styles.heroSub}>
          {t("heroSubtitle")}
        </p>
        <div className={styles.searchContainer}>
          <input
            type="text"
            value={searchQuery}
            onChange={handleSearchChange}
            placeholder={t("searchPlaceholder")}
            className="input-field"
            style={{ width: "100%", maxWidth: "500px" }}
            aria-label={t("searchPlaceholder")}
          />
        </div>
      </section>

      <div style={{ maxWidth: '1200px', margin: '0 auto', width: '100%', padding: '0 1rem' }}>
        <SpecialDayBanner />
      </div>

      <div className={styles.contentGrid}>
        <section className={styles.musicSection}>
          <h2 className={styles.sectionTitle}>{isSearchActive ? t("searchResults") : t("popularAlbums")}</h2>
          {!isSearchActive && loading ? (
            <div className={styles.loader}>{t("loadingCatalog")}</div>
          ) : !isSearchActive && items.length === 0 ? (
            <div className={styles.noResults}>{t("noAlbums")}</div>
          ) : !isSearchActive ? (
            <AlbumGrid items={items} styles={styles} />
          ) : searchQuery.trim().length < 2 ? (
            <div className={styles.noResults}>{t("searchMinChars")}</div>
          ) : searchLoading ? (
            <div className={styles.loader} aria-live="polite">{t("searching")}</div>
          ) : searchError ? (
            <div className={styles.searchStatus} role="alert">
              <span>{t("searchError")}</span>
              <button type="button" className={styles.retryButton} onClick={() => setSearchRetryKey((key) => key + 1)}>
                {t("retrySearch")}
              </button>
            </div>
          ) : !hasSearchResults ? (
            <div className={styles.noResults}>{t("noAlbums")}</div>
          ) : (
            <div className={styles.searchResults} aria-live="polite">
              {searchResponse?.partial && <p className={styles.partialNotice}>{t("partialSearch")}</p>}

              {searchResponse && searchResponse.artists.length > 0 && (
                <div className={styles.searchGroup}>
                  <h3 className={styles.searchGroupTitle}>{t("artists")}</h3>
                  <div className={styles.artistResults}>
                    {searchResponse.artists.map((artist) => (
                      <Link href={`/artists/${artist.id}`} key={artist.id} className={styles.artistResult}>
                        <img src={artist.pictureUrl} alt="" className={styles.artistResultImage} />
                        <span>{artist.name}</span>
                      </Link>
                    ))}
                  </div>
                </div>
              )}

              {searchResponse && searchResponse.directAlbums.length > 0 && (
                <div className={styles.searchGroup}>
                  <h3 className={styles.searchGroupTitle}>{t("directAlbums")}</h3>
                  <AlbumGrid items={searchResponse.directAlbums} styles={styles} />
                </div>
              )}

              {searchResponse && searchResponse.featuredAlbums.length > 0 && (
                <div className={styles.searchGroup}>
                  <h3 className={styles.searchGroupTitle}>{t("featuredAlbums")}</h3>
                  <AlbumGrid items={searchResponse.featuredAlbums} styles={styles} />
                </div>
              )}
            </div>
          )}
        </section>

        <section className={styles.reviewsSection}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>{t("recentActivity")}</h2>
            {currentUser && (
              <div className={styles.tabs}>
                <button
                  onClick={() => setActiveFeed("global")}
                  className={`${styles.tab} ${activeFeed === "global" ? styles.activeTab : ""}`}
                >
                  {t("tabGlobal")}
                </button>
                <button
                  onClick={() => setActiveFeed("following")}
                  className={`${styles.tab} ${activeFeed === "following" ? styles.activeTab : ""}`}
                >
                  {t("tabFollowing")}
                </button>
              </div>
            )}
          </div>

          {reviewsLoading ? (
            <div className={styles.loader}>{t("loadingReviews")}</div>
          ) : activeFeed === "following" && !currentUser ? (
            <div className={styles.loginPrompt}>
              <p>{t("loginPromptFollowing")}</p>
              <Link href="/login" className={styles.loginPromptBtn}>
                {t("loginBtn")}
              </Link>
            </div>
          ) : reviews.length === 0 ? (
            <div className={styles.noReviews}>
              {activeFeed === "following"
                ? t("noReviewsFollowing")
                : t("noReviewsGlobal")}
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
