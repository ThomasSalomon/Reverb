"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import styles from "./page.module.css";
import Avatar from "@/components/Avatar/Avatar";
import Cover3D from "@/components/Cover3D/Cover3D";

type Tab = "albums" | "artists" | "users";

export default function ExploreTabs() {
  const [activeTab, setActiveTab] = useState<Tab>("artists");
  const [searchQuery, setSearchQuery] = useState("");
  
  const [users, setUsers] = useState<any[]>([]);
  const [albums, setAlbums] = useState<any[]>([]);
  const [artists, setArtists] = useState<any[]>([]);
  
  const [loading, setLoading] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);

  useEffect(() => {
    setPage(0);
    const timer = setTimeout(() => {
      fetchData(activeTab, searchQuery, 0);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, activeTab]);

  const fetchData = async (tab: Tab, query: string, pageIndex: number) => {
    try {
      setLoading(true);
      const isQueryEmpty = query.trim().length === 0;
      setIsSearching(!isQueryEmpty);

      const limit = 50;
      const index = pageIndex * limit;
      const queryParams = `index=${index}&limit=${limit}`;

      if (tab === "users") {
        const url = `/api/users/search?q=${encodeURIComponent(query)}&${queryParams}`;
        const res = await fetch(url, { cache: "no-store" });
        if (res.ok) {
          const data = await res.json();
          setUsers(pageIndex === 0 ? data : (prev) => [...prev, ...data]);
          setHasMore(data.length === limit);
        }
      } else if (tab === "albums") {
        const url = isQueryEmpty ? `/api/music?${queryParams}` : `/api/music?q=${encodeURIComponent(query)}&${queryParams}`;
        const res = await fetch(url, { cache: "no-store" });
        if (res.ok) {
          const data = await res.json();
          setAlbums(pageIndex === 0 ? data : (prev) => [...prev, ...data]);
          setHasMore(data.length === limit);
        }
      } else if (tab === "artists") {
        const url = isQueryEmpty ? `/api/artists/search?${queryParams}` : `/api/artists/search?q=${encodeURIComponent(query)}&${queryParams}`;
        const res = await fetch(url, { cache: "no-store" });
        if (res.ok) {
          const data = await res.json();
          setArtists(pageIndex === 0 ? data : (prev) => [...prev, ...data]);
          setHasMore(data.length === limit);
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const loadMore = () => {
    const nextPage = page + 1;
    setPage(nextPage);
    fetchData(activeTab, searchQuery, nextPage);
  };

  const renderPlaceholder = () => {
    if (activeTab === "albums") return "Buscar álbumes...";
    if (activeTab === "artists") return "Buscar artistas...";
    return "Buscar usuarios...";
  };

  const renderSectionTitle = () => {
    if (isSearching) return "Resultados de búsqueda";
    if (activeTab === "albums") return "Álbumes Populares";
    if (activeTab === "artists") return "Artistas Populares";
    return "Usuarios Populares";
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.title}>Explorar</h1>
        <p className={styles.subtitle}>Descubre nuevos artistas, álbumes y usuarios.</p>
      </div>

      <div className={styles.tabsContainer}>
        <div className={styles.tabs}>
          <button
            className={`${styles.tab} ${activeTab === "albums" ? styles.activeTab : ""}`}
            onClick={() => setActiveTab("albums")}
          >
            Álbumes
          </button>
          <button
            className={`${styles.tab} ${activeTab === "artists" ? styles.activeTab : ""}`}
            onClick={() => setActiveTab("artists")}
          >
            Artistas
          </button>
          <button
            className={`${styles.tab} ${activeTab === "users" ? styles.activeTab : ""}`}
            onClick={() => setActiveTab("users")}
          >
            Usuarios
          </button>
        </div>
      </div>

      <div className={styles.searchSection}>
        <input
          type="text"
          placeholder={renderPlaceholder()}
          className={styles.searchInput}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      <div>
        <h2 className={styles.sectionTitle}>{renderSectionTitle()}</h2>
        
        {loading ? (
          <div className="loader" style={{ margin: "40px auto" }}>Cargando...</div>
        ) : (
          <>
            {activeTab === "users" && users.length === 0 && (
              <div style={{ color: "var(--text-secondary)", marginTop: "20px" }}>No se encontraron usuarios.</div>
            )}
            {activeTab === "users" && users.length > 0 && (
              <div className={styles.usersGrid}>
                {users.map((user) => (
                  <Link href={`/users/${user.username}`} key={user.id} className={styles.userCard}>
                    <Avatar
                      username={user.username}
                      profileColor={user.profileColor}
                      profileImage={user.profileImage}
                      size={80}
                      style={{ boxShadow: "0 4px 10px rgba(0,0,0,0.3)" }}
                    />
                    <h3 className={styles.username}>@{user.username}</h3>
                    <div className={styles.userStats}>
                      <div className={styles.stat}>
                        <span className={styles.statValue}>{user._count?.followers || 0}</span>
                        <span>Seguidores</span>
                      </div>
                      <div className={styles.stat}>
                        <span className={styles.statValue}>{user._count?.reviews || 0}</span>
                        <span>Reseñas</span>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}

            {activeTab === "albums" && albums.length === 0 && (
              <div style={{ color: "var(--text-secondary)", marginTop: "20px" }}>No se encontraron álbumes.</div>
            )}
            {activeTab === "albums" && albums.length > 0 && (
              <div className={styles.albumsGrid}>
                {albums.map((item) => (
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
                    </div>
                  </div>
                ))}
              </div>
            )}

            {activeTab === "artists" && artists.length === 0 && (
              <div style={{ color: "var(--text-secondary)", marginTop: "20px" }}>No se encontraron artistas.</div>
            )}
            {activeTab === "artists" && artists.length > 0 && (
              <div className={styles.artistsGrid}>
                {artists.map((artist) => (
                  <Link href={`/artists/${artist.id}`} key={artist.id} className={styles.artistCard}>
                    <div className={styles.artistImageContainer}>
                      <img
                        src={artist.pictureUrl}
                        alt={artist.name}
                        className={styles.artistImage}
                      />
                    </div>
                    <span className={styles.artistName}>{artist.name}</span>
                  </Link>
                ))}
              </div>
            )}
            {hasMore && (
              <div style={{ display: "flex", justifyContent: "center", marginTop: "40px", marginBottom: "20px" }}>
                <button 
                  onClick={loadMore}
                  disabled={loading}
                  style={{
                    background: "var(--primary)",
                    color: "#000",
                    border: "none",
                    borderRadius: "24px",
                    padding: "12px 24px",
                    fontWeight: 600,
                    cursor: loading ? "not-allowed" : "pointer",
                    opacity: loading ? 0.7 : 1,
                    transition: "opacity 0.2s"
                  }}
                >
                  {loading ? "Cargando..." : "Cargar Más"}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
