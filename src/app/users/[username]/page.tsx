"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import ReviewCard from "@/components/ReviewCard/ReviewCard";
import RatingStars from "@/components/RatingStars/RatingStars";
import styles from "./page.module.css";
import { showToast } from "@/components/Toast/ToastListener";
import EditProfileModal from "@/components/EditProfileModal/EditProfileModal";
import EditFavoritesModal from "@/components/EditFavoritesModal/EditFavoritesModal";
import AccountSettingsModal from "@/components/AccountSettingsModal/AccountSettingsModal";
import Avatar from "@/components/Avatar/Avatar";
import RecapModal from "@/components/RecapModal/RecapModal";

interface FavoriteAlbumRelation {
  slot: number;
  musicItem: {
    id: string;
    title: string;
    artist: string;
    coverUrl: string;
    type: string;
  };
}

interface UserProfile {
  username: string;
  bio: string | null;
  favoriteGenre: string | null;
  profileColor: string | null;
  profileImage: string | null;
  createdAt: string;
  favoriteAlbums?: FavoriteAlbumRelation[];
  earnedBadges?: { badgeId: string; createdAt: string }[];
}

interface ProfileStats {
  reviewsCount: number;
  followersCount: number;
  followingCount: number;
}

interface DeezerSearchResult {
  id: string;
  title: string;
  artist: string;
  coverUrl: string;
}

const COLOR_MAP: Record<string, { bg: string; text: string; shadow: string; border: string; value: string }> = {
  emerald: { bg: "rgba(16, 185, 129, 0.1)", text: "rgb(16, 185, 129)", shadow: "rgba(16, 185, 129, 0.2)", border: "rgba(16, 185, 129, 0.3)", value: "#10b981" },
  violet: { bg: "rgba(139, 92, 246, 0.1)", text: "rgb(139, 92, 246)", shadow: "rgba(139, 92, 246, 0.2)", border: "rgba(139, 92, 246, 0.3)", value: "#8b5cf6" },
  cobalt: { bg: "rgba(59, 130, 246, 0.1)", text: "rgb(59, 130, 246)", shadow: "rgba(59, 130, 246, 0.2)", border: "rgba(59, 130, 246, 0.3)", value: "#3b82f6" },
  amber: { bg: "rgba(245, 158, 11, 0.1)", text: "rgb(245, 158, 11)", shadow: "rgba(245, 158, 11, 0.2)", border: "rgba(245, 158, 11, 0.3)", value: "#f59e0b" },
  rose: { bg: "rgba(244, 63, 94, 0.1)", text: "rgb(244, 63, 94)", shadow: "rgba(244, 63, 94, 0.2)", border: "rgba(244, 63, 94, 0.3)", value: "#f43f5e" },
  slate: { bg: "rgba(100, 116, 139, 0.1)", text: "rgb(100, 116, 139)", shadow: "rgba(100, 116, 139, 0.2)", border: "rgba(100, 116, 139, 0.3)", value: "#64748b" }
};

export default function UserProfilePage() {
  const { username } = useParams() as { username: string };
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Profile data state
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [stats, setStats] = useState<ProfileStats | null>(null);
  const [isFollowing, setIsFollowing] = useState(false);
  const [reviews, setReviews] = useState<any[]>([]);

  // Auth state
  const [currentUser, setCurrentUser] = useState<{ username: string } | null>(null);
  const [isOwnProfile, setIsOwnProfile] = useState(false);

  // Edit Modal state
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isFavoritesOpen, setIsFavoritesOpen] = useState(false);
  const [isAccountSettingsOpen, setIsAccountSettingsOpen] = useState(false);
  const [isRecapOpen, setIsRecapOpen] = useState(false);

  // Tab states
  const [activeTab, setActiveTab] = useState<"reviews" | "lists" | "diary" | "stats" | "listen-later">("reviews");
  const [lists, setLists] = useState<any[]>([]);
  const [diaryLogs, setDiaryLogs] = useState<any[]>([]);
  const [statsData, setStatsData] = useState<any | null>(null);
  const [listenLaterItems, setListenLaterItems] = useState<any[]>([]);
  const [loadingTab, setLoadingTab] = useState(false);

  // List Detail State
  const [selectedList, setSelectedList] = useState<any | null>(null);
  const [listToDelete, setListToDelete] = useState<string | null>(null);
  const [isEditingList, setIsEditingList] = useState(false);
  const [editListTitle, setEditListTitle] = useState("");
  const [editListDesc, setEditListDesc] = useState("");
  const [editListPublic, setEditListPublic] = useState(true);

  // Create List Modal State
  const [isCreateListOpen, setIsCreateListOpen] = useState(false);
  const [newListTitle, setNewListTitle] = useState("");
  const [newListDesc, setNewListDesc] = useState("");
  const [newListPublic, setNewListPublic] = useState(true);

  // Add Item to List state
  const [listItemQuery, setListItemQuery] = useState("");
  const [listSearchResults, setListSearchResults] = useState<DeezerSearchResult[]>([]);
  const [listSearching, setListSearching] = useState(false);

  // Add Diary Entry Modal State
  const [isDiaryModalOpen, setIsDiaryModalOpen] = useState(false);
  const [diaryNotes, setDiaryNotes] = useState("");
  const [diaryRating, setDiaryRating] = useState("5");
  const [diarySearchQuery, setDiarySearchQuery] = useState("");
  const [diarySearchResults, setDiarySearchResults] = useState<DeezerSearchResult[]>([]);
  const [diarySearching, setDiarySearching] = useState(false);
  const [diarySelectedAlbum, setDiarySelectedAlbum] = useState<DeezerSearchResult | null>(null);

  const fetchLists = useCallback(async () => {
    try {
      const res = await fetch(`/api/lists?username=${username}`, { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        setLists(data);
      }
    } catch (e) {
      console.error(e);
    }
  }, [username]);

  const fetchDiary = useCallback(async () => {
    try {
      const res = await fetch(`/api/diary?username=${username}`, { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        setDiaryLogs(data);
      }
    } catch (e) {
      console.error(e);
    }
  }, [username]);

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch(`/api/users/${username}/stats`, { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        setStatsData(data);
      }
    } catch (e) {
      console.error(e);
    }
  }, [username]);

  const fetchListenLater = useCallback(async () => {
    try {
      const res = await fetch(`/api/listen-later?username=${username}`, { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        setListenLaterItems(data);
      }
    } catch (e) {
      console.error(e);
    }
  }, [username]);

  useEffect(() => {
    async function loadTabData() {
      if (activeTab === "lists") {
        setLoadingTab(true);
        await fetchLists();
        setLoadingTab(false);
      } else if (activeTab === "diary") {
        setLoadingTab(true);
        await fetchDiary();
        setLoadingTab(false);
      } else if (activeTab === "stats") {
        setLoadingTab(true);
        await fetchStats();
        setLoadingTab(false);
      } else if (activeTab === "listen-later") {
        setLoadingTab(true);
        await fetchListenLater();
        setLoadingTab(false);
      }
    }
    loadTabData();
  }, [activeTab, fetchLists, fetchDiary, fetchStats, fetchListenLater]);

  const handleCreateList = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch("/api/lists", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: newListTitle,
          description: newListDesc,
          isPublic: newListPublic,
        }),
      });
      if (res.ok) {
        setIsCreateListOpen(false);
        setNewListTitle("");
        setNewListDesc("");
        setNewListPublic(true);
        await fetchLists();
      } else {
        const data = await res.json();
        showToast(data.error || "Error al crear lista", "error");
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleSelectList = useCallback(async (listId: string) => {
    try {
      setLoadingTab(true);
      const res = await fetch(`/api/lists/${listId}`, { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        setSelectedList(data);
        setIsEditingList(false);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingTab(false);
    }
  }, []);

  const handleEditListSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedList) return;
    try {
      const res = await fetch(`/api/lists/${selectedList.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: editListTitle,
          description: editListDesc,
          isPublic: editListPublic,
        }),
      });
      if (res.ok) {
        setIsEditingList(false);
        showToast("Lista actualizada correctamente", "success");
        await handleSelectList(selectedList.id);
        await fetchLists();
      } else {
        const data = await res.json();
        showToast(data.error || "Error al actualizar lista", "error");
      }
    } catch (error) {
      console.error(error);
      showToast("Error de conexión", "error");
    }
  };

  const handleDeleteList = useCallback((listId: string) => {
    setListToDelete(listId);
  }, []);

  const executeDeleteList = useCallback(async (listId: string) => {
    try {
      const res = await fetch(`/api/lists/${listId}`, { method: "DELETE" });
      if (res.ok) {
        showToast("Colección eliminada con éxito", "success");
        setSelectedList(null);
        await fetchLists();
      } else {
        const data = await res.json();
        showToast(data.error || "Error al eliminar lista", "error");
      }
    } catch (e) {
      console.error(e);
      showToast("Error de conexión", "error");
    }
  }, [fetchLists]);

  const handleAddItemToList = useCallback(async (album: DeezerSearchResult) => {
    if (!selectedList) return;
    try {
      const res = await fetch(`/api/lists/${selectedList.id}/items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ musicItemId: album.id }),
      });
      if (res.ok) {
        showToast("Álbum añadido a la lista", "success");
        setListItemQuery("");
        setListSearchResults([]);
        await handleSelectList(selectedList.id);
        await fetchLists();
      } else {
        const data = await res.json();
        showToast(data.error || "Error al añadir ítem", "error");
      }
    } catch (e) {
      console.error(e);
    }
  }, [selectedList, fetchLists, handleSelectList]);

  const handleRemoveItemFromList = useCallback(async (musicItemId: string) => {
    if (!selectedList) return;
    try {
      const res = await fetch(`/api/lists/${selectedList.id}/items/${musicItemId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        showToast("Álbum removido de la lista", "success");
        await handleSelectList(selectedList.id);
        await fetchLists();
      }
    } catch (e) {
      console.error(e);
    }
  }, [selectedList, fetchLists, handleSelectList]);

  const handleCreateDiaryLog = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!diarySelectedAlbum) {
      showToast("Selecciona un álbum primero", "error");
      return;
    }
    try {
      const res = await fetch("/api/diary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          musicItemId: diarySelectedAlbum.id,
          ratingValue: parseFloat(diaryRating),
          notes: diaryNotes,
        }),
      });
      if (res.ok) {
        showToast("Escucha registrada en tu bitácora", "success");
        setIsDiaryModalOpen(false);
        setDiaryNotes("");
        setDiaryRating("5");
        setDiarySelectedAlbum(null);
        setDiarySearchQuery("");
        setDiarySearchResults([]);
        await fetchDiary();
      } else {
        const data = await res.json();
        showToast(data.error || "Error al guardar bitácora", "error");
      }
    } catch (e) {
      console.error(e);
    }
  };

  // List Search album trigger
  useEffect(() => {
    if (!listItemQuery || listItemQuery.trim() === "") {
      setListSearchResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      setListSearching(true);
      try {
        const res = await fetch(`/api/music?q=${encodeURIComponent(listItemQuery)}`);
        if (res.ok) {
          const data = await res.json();
          setListSearchResults(data.slice(0, 5));
        }
      } catch (e) {
        console.error(e);
      } finally {
        setListSearching(false);
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [listItemQuery]);

  // Diary Search album trigger
  useEffect(() => {
    if (!diarySearchQuery || diarySearchQuery.trim() === "") {
      setDiarySearchResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      setDiarySearching(true);
      try {
        const res = await fetch(`/api/music?q=${encodeURIComponent(diarySearchQuery)}`);
        if (res.ok) {
          const data = await res.json();
          setDiarySearchResults(data.slice(0, 5));
        }
      } catch (e) {
        console.error(e);
      } finally {
        setDiarySearching(false);
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [diarySearchQuery]);

  const fetchProfileData = useCallback(async () => {
    try {
      // 1. Fetch profile information
      const profileRes = await fetch(`/api/users/${username}`, { cache: "no-store" });
      if (!profileRes.ok) {
        if (profileRes.status === 404) {
          throw new Error("Usuario no encontrado");
        }
        throw new Error("Error al obtener la información del perfil");
      }
      const profileData = await profileRes.json();
      setProfile(profileData.profile);
      setStats(profileData.stats);
      setIsFollowing(profileData.isFollowing);

      // 2. Fetch user's reviews
      const reviewsRes = await fetch(`/api/reviews?username=${username}`, { cache: "no-store" });
      if (reviewsRes.ok) {
        const reviewsData = await reviewsRes.json();
        setReviews(reviewsData);
      }
    } catch (e: any) {
      setError(e.message || "Ocurrió un error");
    }
  }, [username]);

  useEffect(() => {
    async function init() {
      setLoading(true);
      setError(null);

      try {
        // Fetch current user auth status
        const meRes = await fetch("/api/auth/me", { cache: "no-store" });
        if (meRes.ok) {
          const meData = await meRes.json();
          setCurrentUser(meData.user);
          setIsOwnProfile(meData.user?.username === username);
        }

        await fetchProfileData();
      } catch (e: any) {
        setError(e.message || "Error de red");
      } finally {
        setLoading(false);
      }
    }
    init();
  }, [username, fetchProfileData]);

  // Initializing edit state when modal opens
  const openEditModal = () => {
    setIsEditOpen(true);
  };

  // Follow/Unfollow action
  const handleFollowToggle = async () => {
    if (!currentUser) {
      router.push("/login");
      return;
    }

    try {
      const method = isFollowing ? "DELETE" : "POST";
      const res = await fetch(`/api/users/${username}/follow`, { method });
      if (res.ok) {
        setIsFollowing(!isFollowing);
        // Optimistic stats update
        setStats((prev) => {
          if (!prev) return null;
          return {
            ...prev,
            followersCount: prev.followersCount + (isFollowing ? -1 : 1)
          };
        });
      }
    } catch (e) {
      console.error("Follow error:", e);
    }
  };



  if (loading) {
    return (
      <div className="container" style={{ textAlign: "center", padding: "100px 0" }}>
        <div className="loader">Cargando perfil...</div>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className={styles.profilePage}>
        <div className="card" style={{ padding: "40px", textAlign: "center" }}>
          <h2 style={{ marginBottom: "16px", color: "var(--text-primary)" }}>
            {error || "Usuario no encontrado"}
          </h2>
          <p style={{ color: "--text-secondary", marginBottom: "24px" }}>
            El perfil que buscas no existe o ha ocurrido un problema.
          </p>
          <Link href="/" className="neon-btn" style={{ display: "inline-block" }}>
            Volver al Inicio
          </Link>
        </div>
      </div>
    );
  }

  const theme = COLOR_MAP[profile.profileColor || "emerald"] || COLOR_MAP.emerald;
  const joinYear = new Date(profile.createdAt).getFullYear();

  return (
    <div
      className={styles.profilePage}
      style={
        {
          "--profile-theme-color": theme.value,
          "--profile-theme-bg": theme.bg,
          "--profile-theme-border": theme.border,
          "--profile-theme-shadow": theme.shadow
        } as React.CSSProperties
      }
    >
      <div className={`${styles.mainContentWrapper} ${isEditOpen || isFavoritesOpen || isCreateListOpen || isDiaryModalOpen || !!listToDelete || isRecapOpen || isAccountSettingsOpen ? styles.blurredBackground : ""}`}>
      {/* Header card */}
      <header className={styles.profileHeader}>
        <div className={styles.headerMain}>
          <div className={styles.userInfo}>
            <Avatar
              username={profile.username}
              profileColor={profile.profileColor}
              profileImage={profile.profileImage}
              size={80}
              className={styles.avatar}
              style={{ border: "none" }}
            />
            <div className={styles.userMeta}>
              <h1 className={styles.username}>@{profile.username}</h1>
              <div style={{ display: "flex", gap: "8px", alignItems: "center", marginTop: "4px", flexWrap: "wrap" }}>
                <span className={styles.joinDate}>Miembro desde {joinYear}</span>
                {profile.favoriteGenre && (
                  <span className={styles.genreTag}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M9 18V5l12-2v13"></path>
                      <circle cx="6" cy="18" r="3"></circle>
                      <circle cx="18" cy="16" r="3"></circle>
                    </svg>
                    {profile.favoriteGenre}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div>
            {isOwnProfile ? (
              <div style={{ display: "flex", gap: "10px" }}>
                <button 
                  onClick={() => setIsAccountSettingsOpen(true)} 
                  className={styles.iconBtn}
                  aria-label="Configuración de Cuenta"
                  title="Configuración de Cuenta"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="3"></circle>
                    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
                  </svg>
                </button>
                <button onClick={openEditModal} className={`${styles.actionBtn} ${styles.editBtn}`}>
                  Editar Perfil
                </button>
              </div>
            ) : (
              <button
                onClick={handleFollowToggle}
                className={`${styles.actionBtn} ${
                  isFollowing ? styles.unfollowBtn : styles.followBtn
                }`}
              >
                {isFollowing ? "Siguiendo" : "Seguir"}
              </button>
            )}
          </div>
        </div>

        {/* Bio */}
        <div className={styles.bioSection}>
          <h4 className={styles.bioTitle}>Biografía</h4>
          {profile.bio ? (
            <p className={styles.bioText}>{profile.bio}</p>
          ) : (
            <p className={styles.bioPlaceholder}>
              {isOwnProfile
                ? "Aún no has agregado una biografía. Presiona Editar Perfil para contarle a la comunidad sobre ti."
                : "Este usuario no ha agregado una biografía."}
            </p>
          )}
        </div>

        {/* Stats */}
        <div className={styles.statsRow}>
          <div className={styles.statItem}>
            <span className={styles.statVal}>{stats?.reviewsCount || 0}</span>
            <span className={styles.statLabel}>Reseñas</span>
          </div>
          <div className={styles.statItem}>
            <span className={styles.statVal}>{stats?.followersCount || 0}</span>
            <span className={styles.statLabel}>Seguidores</span>
          </div>
          <div className={styles.statItem}>
            <span className={styles.statVal}>{stats?.followingCount || 0}</span>
            <span className={styles.statLabel}>Siguiendo</span>
          </div>
        </div>

        {/* Badges */}
        {profile.earnedBadges && profile.earnedBadges.length > 0 && (
          <div className={styles.badgesSection} style={{ marginTop: "20px", display: "flex", gap: "12px", flexWrap: "wrap", justifyContent: "center" }}>
            {profile.earnedBadges.map(badge => (
              <div 
                key={badge.badgeId} 
                className={styles.badgeCard}
                title={`Obtenido el ${new Date(badge.createdAt).toLocaleDateString()}`}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  background: "var(--profile-theme-bg, rgba(255,255,255,0.05))",
                  border: "1px solid var(--profile-theme-border, var(--border))",
                  padding: "6px 12px",
                  borderRadius: "20px",
                  fontSize: "0.85rem",
                  fontWeight: 600,
                  color: "var(--text-primary)"
                }}
              >
                <span style={{ fontSize: "1.1rem" }}>
                  {badge.badgeId === "FIRST_REVIEW" && "🏆"}
                  {/* Add more badge mappings here later */}
                </span>
                <span>
                  {badge.badgeId === "FIRST_REVIEW" && "Crítico en Ascenso"}
                </span>
              </div>
            ))}
          </div>
        )}

        <div className={styles.recapBtnContainer}>
          <button 
            onClick={() => setIsRecapOpen(true)}
            className={styles.recapBtn}
          >
            <svg className={styles.recapBtnIcon} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <circle cx="12" cy="12" r="3" />
            </svg>
            Reverb Recap {new Date().getFullYear()}
          </button>
        </div>
      </header>

      {/* Tab Selector */}
      <div className={styles.tabsContainer}>
        <button
          onClick={() => { setActiveTab("reviews"); setSelectedList(null); }}
          className={`${styles.tabBtn} ${activeTab === "reviews" ? styles.tabBtnActive : ""}`}
        >
          Reseñas
        </button>
        <button
          onClick={() => { setActiveTab("lists"); setSelectedList(null); }}
          className={`${styles.tabBtn} ${activeTab === "lists" ? styles.tabBtnActive : ""}`}
        >
          Listas
        </button>
        <button
          onClick={() => { setActiveTab("diary"); setSelectedList(null); }}
          className={`${styles.tabBtn} ${activeTab === "diary" ? styles.tabBtnActive : ""}`}
        >
          Bitácora
        </button>
        <button
          onClick={() => { setActiveTab("stats"); setSelectedList(null); }}
          className={`${styles.tabBtn} ${activeTab === "stats" ? styles.tabBtnActive : ""}`}
        >
          Estadísticas
        </button>
        {isOwnProfile && (
          <button
            onClick={() => { setActiveTab("listen-later"); setSelectedList(null); }}
            className={`${styles.tabBtn} ${activeTab === "listen-later" ? styles.tabBtnActive : ""}`}
          >
            Escuchar Después
          </button>
        )}
      </div>

      {loadingTab ? (
        <div style={{ textAlign: "center", padding: "40px 0", color: "var(--text-secondary)" }}>
          Cargando datos de pestaña...
        </div>
      ) : (
        <>
          {activeTab === "reviews" && (
            <main className={styles.profileContent}>
              {/* Left Side: Reviews */}
              <div>
                <h3 className={styles.sectionTitle}>Reseñas Recientes</h3>
                <div className={styles.reviewsList}>
                  {reviews.length > 0 ? (
                    reviews.map((review) => (
                      <ReviewCard key={review.id} review={review} showMusicDetails={true} />
                    ))
                  ) : (
                    <div className={styles.noReviews}>
                      {isOwnProfile
                        ? "Aún no has escrito ninguna reseña. ¡Busca un álbum en la página de inicio y comparte tu calificación!"
                        : "Este usuario aún no ha publicado ninguna reseña."}
                    </div>
                  )}
                </div>
              </div>

              {/* Right Side: Favorite Album Slots */}
              <aside>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                  <h3 className={styles.sectionTitle} style={{ margin: 0 }}>Álbumes Favoritos</h3>
                  {isOwnProfile && (
                    <button 
                      onClick={() => setIsFavoritesOpen(true)}
                      style={{ 
                        background: "var(--profile-theme-bg, rgba(16, 185, 129, 0.15))", 
                        border: "1px solid var(--profile-theme-border, rgba(16, 185, 129, 0.3))", 
                        color: "var(--profile-theme-color, #10b981)", 
                        cursor: "pointer", 
                        fontSize: "0.75rem", 
                        fontWeight: 600,
                        display: "flex",
                        alignItems: "center",
                        gap: "6px",
                        padding: "4px 10px",
                        borderRadius: "12px",
                        transition: "all 0.2s ease"
                      }}
                      onMouseOver={(e) => {
                        e.currentTarget.style.background = "var(--profile-theme-color, #10b981)";
                        e.currentTarget.style.color = "#08080a";
                        e.currentTarget.style.borderColor = "var(--profile-theme-color, #10b981)";
                        e.currentTarget.style.transform = "translateY(-1px)";
                      }}
                      onMouseOut={(e) => {
                        e.currentTarget.style.background = "var(--profile-theme-bg, rgba(16, 185, 129, 0.15))";
                        e.currentTarget.style.color = "var(--profile-theme-color, #10b981)";
                        e.currentTarget.style.borderColor = "var(--profile-theme-border, rgba(16, 185, 129, 0.3))";
                        e.currentTarget.style.transform = "translateY(0)";
                      }}
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                        <path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4Z"></path>
                      </svg>
                      Editar
                    </button>
                  )}
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                  {[1, 2, 3].map((slot) => {
                    const fav = profile.favoriteAlbums?.find(f => f.slot === slot);
                    return (
                      <div key={slot} className={`${styles.favoriteCard} glass`} style={{ display: "flex", alignItems: "center", gap: "12px", padding: "12px" }}>
                        <span style={{ fontSize: "0.8rem", fontWeight: 700, color: "var(--text-secondary)", width: "20px" }}>#{slot}</span>
                        {fav ? (
                          <>
                            <div className={styles.favCoverWrapper} style={{ width: "50px", height: "50px", margin: 0, flexShrink: 0, position: "relative" }}>
                              <Link href={`/albums/${fav.musicItem.id}`}>
                                <img
                                  src={fav.musicItem.coverUrl || "/covers/placeholder.png"}
                                  alt={fav.musicItem.title}
                                  style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "4px" }}
                                />
                              </Link>
                              {isOwnProfile && (
                                <button
                                  onClick={async (e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    try {
                                      const res = await fetch(`/api/users/${username}`, {
                                        method: "PUT",
                                        headers: { "Content-Type": "application/json" },
                                        body: JSON.stringify({
                                          favoriteAlbums: [
                                            { slot: fav.slot, musicItemId: null }
                                          ]
                                        })
                                      });
                                      if (res.ok) {
                                        showToast("Álbum removido de favoritos", "success");
                                        await fetchProfileData();
                                      } else {
                                        showToast("Error al remover álbum", "error");
                                      }
                                    } catch (err) {
                                      showToast("Error de conexión", "error");
                                    }
                                  }}
                                  className={styles.deleteOverlay}
                                  title="Quitar de favoritos"
                                >
                                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#f43f5e" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ transition: "transform 0.2s" }} onMouseOver={(e) => e.currentTarget.style.transform = "scale(1.15)"} onMouseOut={(e) => e.currentTarget.style.transform = "scale(1)"}>
                                    <line x1="18" y1="6" x2="6" y2="18"></line>
                                    <line x1="6" y1="6" x2="18" y2="18"></line>
                                  </svg>
                                </button>
                              )}
                            </div>
                            <div style={{ flexGrow: 1, minWidth: 0 }}>
                              <h4 className={styles.favAlbumTitle} style={{ fontSize: "0.85rem", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                <Link href={`/albums/${fav.musicItem.id}`}>
                                  {fav.musicItem.title}
                                </Link>
                              </h4>
                              <span className={styles.favAlbumArtist} style={{ fontSize: "0.7rem", marginTop: "2px", display: "block" }}>{fav.musicItem.artist}</span>
                            </div>
                          </>
                        ) : isOwnProfile ? (
                          <button
                            onClick={() => setIsFavoritesOpen(true)}
                            style={{
                              flexGrow: 1,
                              height: "50px",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              gap: "6px",
                              border: "1px dashed var(--theme-border)",
                              borderRadius: "8px",
                              color: "var(--theme-color)",
                              background: "var(--theme-glow)",
                              fontSize: "0.75rem",
                              fontWeight: "600",
                              cursor: "pointer",
                              transition: "all 0.2s ease"
                            }}
                            onMouseOver={(e) => {
                              e.currentTarget.style.borderColor = "var(--theme-color)";
                              e.currentTarget.style.transform = "scale(1.02)";
                            }}
                            onMouseOut={(e) => {
                              e.currentTarget.style.borderColor = "var(--theme-border)";
                              e.currentTarget.style.transform = "scale(1)";
                            }}
                          >
                            <span style={{ fontSize: "1rem", fontWeight: "bold" }}>+</span> Añadir favorito
                          </button>
                        ) : (
                          <div style={{ flexGrow: 1, height: "50px", display: "flex", alignItems: "center", justifyContent: "center", border: "1px dashed var(--border)", borderRadius: "8px", color: "var(--text-muted)", fontSize: "0.75rem" }}>
                             Ranura vacía
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </aside>
            </main>
          )}

          {activeTab === "lists" && (
            <div style={{ width: "100%" }}>
              {selectedList ? (
                /* Detail list view */
                <div className="card glass" style={{ padding: "24px", marginBottom: "24px" }}>
                  {isEditingList ? (
                    <form onSubmit={handleEditListSubmit} style={{ display: "flex", flexDirection: "column", gap: "16px", marginBottom: "16px" }}>
                      <div className={styles.formGroup}>
                        <label className={styles.formLabel}>Título de la Lista</label>
                        <input
                          type="text"
                          className={styles.formInput}
                          value={editListTitle}
                          onChange={(e) => setEditListTitle(e.target.value)}
                          required
                          maxLength={100}
                        />
                      </div>
                      <div className={styles.formGroup}>
                        <label className={styles.formLabel}>Descripción (opcional)</label>
                        <textarea
                          className={styles.formInput}
                          value={editListDesc}
                          onChange={(e) => setEditListDesc(e.target.value)}
                          rows={3}
                          maxLength={500}
                        />
                      </div>
                      <div className={styles.checkboxGroup}>
                        <input
                          type="checkbox"
                          id="edit-list-public"
                          checked={editListPublic}
                          onChange={(e) => setEditListPublic(e.target.checked)}
                          className={styles.checkbox}
                        />
                        <label htmlFor="edit-list-public" className={styles.checkboxLabel}>Hacer esta lista pública</label>
                      </div>
                      <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end" }}>
                        <button type="button" onClick={() => setIsEditingList(false)} className="secondary-btn">Cancelar</button>
                        <button type="submit" className="neon-btn">Guardar Cambios</button>
                      </div>
                    </form>
                  ) : (
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "16px", flexWrap: "wrap", gap: "16px" }}>
                      <div>
                        <button onClick={() => setSelectedList(null)} className="secondary-btn" style={{ marginBottom: "12px", display: "inline-block", fontSize: "0.85rem", padding: "6px 12px" }}>
                          ← Volver a listas
                        </button>
                        <h2 className={styles.listTitle} style={{ fontSize: "2rem" }}>{selectedList.title}</h2>
                        {selectedList.description && (
                          <p style={{ color: "var(--text-secondary)", marginTop: "8px", fontSize: "0.95rem" }}>{selectedList.description}</p>
                        )}
                        <span className={styles.listMeta}>Creada por @{selectedList.user.username} • {selectedList.items.length} álbumes • {selectedList.isPublic ? "Pública" : "Privada"}</span>
                      </div>
                      {isOwnProfile && (
                        <div style={{ display: "flex", gap: "10px" }}>
                          <button 
                            onClick={() => {
                              setEditListTitle(selectedList.title);
                              setEditListDesc(selectedList.description || "");
                              setEditListPublic(selectedList.isPublic);
                              setIsEditingList(true);
                            }} 
                            className="secondary-btn"
                          >
                            Editar Info
                          </button>
                          <button onClick={() => handleDeleteList(selectedList.id)} className="secondary-btn" style={{ borderColor: "rgba(244, 63, 94, 0.4)", color: "#f43f5e" }}>
                            Eliminar Lista
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Add Album Input */}
                  {isOwnProfile && (
                    <div style={{ margin: "24px 0", borderTop: "1px solid var(--border)", paddingTop: "20px" }}>
                      <h4 style={{ color: "var(--text-primary)", marginBottom: "10px", fontSize: "0.95rem" }}>Añadir Álbum a esta lista:</h4>
                      <div className={styles.formGroup} style={{ position: "relative" }}>
                        <input
                          type="text"
                          className={styles.formInput}
                          placeholder="Buscar álbum para añadir..."
                          value={listItemQuery}
                          onChange={(e) => setListItemQuery(e.target.value)}
                        />
                        {listSearching && <div className={styles.searchingText} style={{ position: "absolute", right: "12px", top: "12px" }}>Buscando...</div>}
                        
                        {listSearchResults.length > 0 && (
                          <div className={styles.searchResultsDropdown} style={{ position: "absolute", width: "100%", zIndex: 10, background: "#0c0d12", border: "1px solid var(--border)", borderRadius: "8px", marginTop: "4px" }}>
                            {listSearchResults.map((albumItem) => (
                              <div
                                key={albumItem.id}
                                className={styles.searchResultItem}
                                onClick={() => handleAddItemToList(albumItem)}
                                style={{ display: "flex", alignItems: "center", gap: "10px", padding: "10px", cursor: "pointer", borderBottom: "1px solid rgba(255,255,255,0.05)" }}
                              >
                                <img src={albumItem.coverUrl} alt={albumItem.title} style={{ width: "36px", height: "36px", borderRadius: "4px" }} />
                                <div>
                                  <div style={{ fontWeight: 600, color: "var(--text-primary)", fontSize: "0.85rem" }}>{albumItem.title}</div>
                                  <div style={{ color: "var(--text-secondary)", fontSize: "0.75rem" }}>{albumItem.artist}</div>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* List Items Grid */}
                  <div className={styles.listsGrid} style={{ marginTop: "20px" }}>
                    {selectedList.items.length > 0 ? (
                      selectedList.items.map((item: any) => (
                        <div key={item.id} className="card glass" style={{ padding: "16px", display: "flex", gap: "12px", alignItems: "center", position: "relative" }}>
                          <img src={item.musicItem.coverUrl} alt={item.musicItem.title} style={{ width: "60px", height: "60px", borderRadius: "6px", objectFit: "cover" }} />
                          <div style={{ flexGrow: 1 }}>
                            <h4 style={{ fontSize: "0.95rem", fontWeight: 700, color: "var(--text-primary)" }}>
                              <Link href={`/albums/${item.musicItem.id}`} style={{ color: "inherit", textDecoration: "none" }}>
                                {item.musicItem.title}
                              </Link>
                            </h4>
                            <p style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>{item.musicItem.artist}</p>
                          </div>
                          {isOwnProfile && (
                            <button
                              onClick={() => handleRemoveItemFromList(item.musicItemId)}
                              className="secondary-btn"
                              style={{ padding: "4px 8px", fontSize: "0.75rem", borderColor: "rgba(255, 255, 255, 0.1)" }}
                              title="Remover de la lista"
                            >
                              &times;
                            </button>
                          )}
                        </div>
                      ))
                    ) : (
                      <p style={{ color: "var(--text-muted)", gridColumn: "1/-1", textAlign: "center", padding: "20px" }}>Esta lista está vacía.</p>
                    )}
                  </div>
                </div>
              ) : (
                /* Grid view of user's lists */
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
                    <h3 className={styles.sectionTitle}>Colecciones de listas</h3>
                    {isOwnProfile && (
                      <button onClick={() => setIsCreateListOpen(true)} className="neon-btn">
                        Crear Nueva Lista
                      </button>
                    )}
                  </div>

                  {lists.length > 0 ? (
                    <div className={styles.listsGrid}>
                      {lists.map((list) => (
                        <div
                          key={list.id}
                          onClick={() => handleSelectList(list.id)}
                          className={`${styles.listCard} card glass`}
                          style={{ cursor: "pointer" }}
                        >
                          <div>
                            <h4 className={styles.listTitle}>{list.title}</h4>
                            <p className={styles.listMeta} style={{ marginTop: "4px" }}>
                              {list.isPublic ? "Publica" : "Privada"} • {list.items?.length || 0} álbumes
                            </p>
                          </div>
                          <div className={styles.coversStack}>
                            {list.items && list.items.length > 0 ? (
                              list.items.map((item: any, idx: number) => (
                                <img
                                  key={idx}
                                  src={item.musicItem.coverUrl}
                                  alt="Cover"
                                  className={styles.stackCover}
                                  style={{ transform: `translateX(-${idx * 10}px)` }}
                                />
                              ))
                            ) : (
                              <span style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>Lista vacía</span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className={styles.noReviews} style={{ textAlign: "center", padding: "40px" }}>
                      No hay listas creadas por este usuario aún.
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {activeTab === "diary" && (
            <div style={{ width: "100%" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
                <h3 className={styles.sectionTitle}>Diario de Escucha</h3>
                {isOwnProfile && (
                  <button onClick={() => setIsDiaryModalOpen(true)} className="neon-btn">
                    Registrar en Bitácora
                  </button>
                )}
              </div>

              {diaryLogs.length > 0 ? (
                <div className={styles.diaryTimeline}>
                  {diaryLogs.map((log) => {
                    const formattedLogDate = new Date(log.listenedAt).toLocaleDateString("es-ES", {
                      day: "numeric",
                      month: "short",
                      year: "numeric"
                    });
                    return (
                      <div key={log.id} className={`${styles.diaryRow} card glass`}>
                        <div className={styles.diaryInfo}>
                          <img src={log.musicItem.coverUrl} alt={log.musicItem.title} className={styles.diaryCover} />
                          <div className={styles.diaryTextInfo}>
                            <Link href={`/albums/${log.musicItem.id}`} className={styles.diaryAlbumLink}>
                              {log.musicItem.title}
                            </Link>
                            <span className={styles.diaryArtist}>{log.musicItem.artist}</span>
                            {log.notes && (
                              <p style={{ fontSize: "0.85rem", color: "var(--text-secondary)", marginTop: "4px", fontStyle: "italic" }}>
                                &ldquo;{log.notes}&rdquo;
                              </p>
                            )}
                          </div>
                        </div>
                        <div className={styles.diaryMeta}>
                          {log.ratingValue && (
                            <RatingStars value={log.ratingValue} size={12} />
                          )}
                          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                            {log.listenCount > 1 && (
                              <span className={styles.listenCountBadge} title={`Escuchado ${log.listenCount} veces`}>
                                🎧 ×{log.listenCount}
                              </span>
                            )}
                            <span className={styles.diaryDate}>{formattedLogDate}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className={styles.noReviews} style={{ textAlign: "center", padding: "40px" }}>
                  Aún no se han registrado escuchas en la bitácora.
                </div>
              )}
            </div>
          )}

          {activeTab === "stats" && (
            <div style={{ width: "100%" }}>
              <h3 className={styles.sectionTitle} style={{ marginBottom: "20px" }}>Métricas y Estadísticas</h3>
              
              {statsData ? (
                <div className={styles.statsDashboard}>
                  {/* Rating Distribution Histogram */}
                  <div className={`${styles.chartCard} card glass`}>
                    <h4 style={{ fontSize: "1.1rem", fontWeight: 700, color: "var(--text-primary)" }}>Distribución de Puntuaciones</h4>
                    <span style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>Promedio: {statsData.averageRating.toFixed(2)} ★ ({statsData.totalRatings} valoraciones)</span>
                    
                    <div className={styles.distributionChart}>
                      {Object.entries(statsData.ratingDistribution)
                        .reverse()
                        .map(([rating, count]) => {
                          const maxCount = Math.max(...Object.values(statsData.ratingDistribution) as number[]) || 1;
                          const pct = ((count as number) / maxCount) * 100;
                          return (
                            <div key={rating} className={styles.barRow}>
                              <span className={styles.ratingLabel}>{parseFloat(rating).toFixed(1)} ★</span>
                              <div className={styles.barWrapper}>
                                <div className={styles.barFill} style={{ transform: `scaleX(${pct / 100})` }} />
                              </div>
                              <span className={styles.barCount}>{count as number}</span>
                            </div>
                          );
                        })}
                    </div>
                  </div>

                  {/* Top Artists list */}
                  <div className={`${styles.artistsCard} card glass`}>
                    <h4 style={{ fontSize: "1.1rem", fontWeight: 700, color: "var(--text-primary)" }}>Artistas más Reseñados</h4>
                    <span style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>Tus mayores reseñas por creador</span>
                    
                    <div className={styles.artistList}>
                      {statsData.topArtists.length > 0 ? (
                        statsData.topArtists.map((artist: any, idx: number) => (
                          <div key={idx} className={styles.artistRow}>
                            <span className={styles.artistName}>{idx + 1}. {artist.name}</span>
                            <span className={styles.artistReviewsCount}>
                              <span>{artist.count}</span> {artist.count === 1 ? "reseña" : "reseñas"}
                            </span>
                          </div>
                        ))
                      ) : (
                        <p style={{ color: "var(--text-muted)", fontSize: "0.9rem", textAlign: "center", padding: "20px" }}>No hay suficientes datos.</p>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <div style={{ textAlign: "center", padding: "20px" }}>No hay estadísticas disponibles.</div>
              )}
            </div>
          )}
        </>
      )}
      </div>

      {/* Edit Profile Modal */}
      {profile && (
        <EditProfileModal
          isOpen={isEditOpen}
          onClose={() => setIsEditOpen(false)}
          profile={profile}
          onSave={fetchProfileData}
        />
      )}

      {/* Edit Favorites Modal */}
      {profile && (
        <EditFavoritesModal
          isOpen={isFavoritesOpen}
          onClose={() => setIsFavoritesOpen(false)}
          profile={profile}
          onSave={fetchProfileData}
        />
      )}

      {/* Create List Modal */}
      {isCreateListOpen && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalContent}>
            <div className={styles.modalHeader}>
              <h3 className={styles.modalTitle}>Crear Nueva Colección</h3>
              <button onClick={() => setIsCreateListOpen(false)} className={styles.closeBtn}>
                &times;
              </button>
            </div>

            <form onSubmit={handleCreateList} style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Título de la Lista</label>
                <input
                  type="text"
                  required
                  className={styles.formInput}
                  value={newListTitle}
                  onChange={(e) => setNewListTitle(e.target.value)}
                  placeholder="Ej: Favoritos de Jazz, Joyas Ocultas..."
                />
              </div>

              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Descripción (Opcional)</label>
                <textarea
                  className={styles.formInput}
                  rows={3}
                  maxLength={500}
                  value={newListDesc}
                  onChange={(e) => setNewListDesc(e.target.value)}
                  placeholder="Describe de qué trata esta lista musical..."
                  style={{ resize: "none" }}
                />
              </div>

              <div className={styles.formGroup} style={{ flexDirection: "row", gap: "10px", alignItems: "center" }}>
                <input
                  type="checkbox"
                  id="newListPublic"
                  checked={newListPublic}
                  onChange={(e) => setNewListPublic(e.target.checked)}
                  style={{ width: "auto", cursor: "pointer" }}
                />
                <label htmlFor="newListPublic" style={{ cursor: "pointer", fontSize: "0.9rem", color: "var(--text-primary)" }}>
                  Hacer esta lista pública en mi perfil
                </label>
              </div>

              <div className={styles.modalFooter}>
                <button type="button" onClick={() => setIsCreateListOpen(false)} className={styles.cancelBtn}>
                  Cancelar
                </button>
                <button type="submit" className={styles.saveBtn}>
                  Crear Lista
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Register Diary Entry Modal */}
      {isDiaryModalOpen && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalContent}>
            <div className={styles.modalHeader}>
              <h3 className={styles.modalTitle}>Registrar en Bitácora</h3>
              <button onClick={() => setIsDiaryModalOpen(false)} className={styles.closeBtn}>
                &times;
              </button>
            </div>

            <form onSubmit={handleCreateDiaryLog} style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
              {/* Search Album to Add */}
              <div className={styles.formGroup} style={{ position: "relative" }}>
                <label className={styles.formLabel}>Buscar Álbum</label>
                {diarySelectedAlbum ? (
                  <div style={{ display: "flex", alignItems: "center", gap: "10px", padding: "10px", background: "rgba(255,255,255,0.03)", borderRadius: "6px", border: "1px solid var(--border)" }}>
                    <img src={diarySelectedAlbum.coverUrl} alt={diarySelectedAlbum.title} style={{ width: "40px", height: "40px", borderRadius: "4px" }} />
                    <div style={{ flexGrow: 1 }}>
                      <div style={{ fontWeight: 600, color: "var(--text-primary)", fontSize: "0.85rem" }}>{diarySelectedAlbum.title}</div>
                      <div style={{ color: "var(--text-secondary)", fontSize: "0.75rem" }}>{diarySelectedAlbum.artist}</div>
                    </div>
                    <button type="button" onClick={() => setDiarySelectedAlbum(null)} className="secondary-btn" style={{ padding: "2px 6px", fontSize: "0.75rem" }}>
                      Cambiar
                    </button>
                  </div>
                ) : (
                  <>
                    <input
                      type="text"
                      className={styles.formInput}
                      placeholder="Escribe título del álbum..."
                      value={diarySearchQuery}
                      onChange={(e) => setDiarySearchQuery(e.target.value)}
                    />
                    {diarySearching && <div className={styles.searchingText} style={{ position: "absolute", right: "12px", top: "36px" }}>Buscando...</div>}
                    
                    {diarySearchResults.length > 0 && (
                      <div className={styles.searchResultsDropdown} style={{ position: "absolute", width: "100%", zIndex: 10, background: "#0c0d12", border: "1px solid var(--border)", borderRadius: "8px", marginTop: "4px", top: "68px" }}>
                        {diarySearchResults.map((albumItem) => (
                          <div
                            key={albumItem.id}
                            className={styles.searchResultItem}
                            onClick={() => setDiarySelectedAlbum(albumItem)}
                            style={{ display: "flex", alignItems: "center", gap: "10px", padding: "10px", cursor: "pointer", borderBottom: "1px solid rgba(255,255,255,0.05)" }}
                          >
                            <img src={albumItem.coverUrl} alt={albumItem.title} style={{ width: "36px", height: "36px", borderRadius: "4px" }} />
                            <div>
                              <div style={{ fontWeight: 600, color: "var(--text-primary)", fontSize: "0.85rem" }}>{albumItem.title}</div>
                              <div style={{ color: "var(--text-secondary)", fontSize: "0.75rem" }}>{albumItem.artist}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Rating */}
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Calificación (Estrellas)</label>
                <select
                  className={styles.formInput}
                  value={diaryRating}
                  onChange={(e) => setDiaryRating(e.target.value)}
                >
                  <option value="5">★★★★★ (5.0)</option>
                  <option value="4.5">★★★★½ (4.5)</option>
                  <option value="4">★★★★☆ (4.0)</option>
                  <option value="3.5">★★★½☆ (3.5)</option>
                  <option value="3">★★★☆☆ (3.0)</option>
                  <option value="2.5">★★½☆☆ (2.5)</option>
                  <option value="2">★★☆☆☆ (2.0)</option>
                  <option value="1.5">★½☆☆☆ (1.5)</option>
                  <option value="1">★☆☆☆☆ (1.0)</option>
                  <option value="0.5">½☆☆☆☆ (0.5)</option>
                </select>
              </div>

              {/* Quick Notes */}
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Notas rápidas / Comentarios (Opcional)</label>
                <textarea
                  className={styles.formInput}
                  rows={3}
                  maxLength={500}
                  value={diaryNotes}
                  onChange={(e) => setDiaryNotes(e.target.value)}
                  placeholder="Apuntes rápidos sobre esta escucha..."
                  style={{ resize: "none" }}
                />
              </div>

              <div className={styles.modalFooter}>
                <button type="button" onClick={() => setIsDiaryModalOpen(false)} className={styles.cancelBtn}>
                  Cancelar
                </button>
                <button type="submit" className={styles.saveBtn}>
                  Registrar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Custom List Delete Confirm Modal Overlay */}
      {listToDelete && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0, 0, 0, 0.7)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
            padding: "20px"
          }}
        >
          <div
            className="card glass"
            style={{
              width: "100%",
              maxWidth: "340px",
              padding: "24px",
              display: "flex",
              flexDirection: "column",
              gap: "16px"
            }}
          >
            <h4 style={{ fontSize: "1.1rem", fontWeight: 700, color: "var(--text-primary)", fontFamily: "var(--font-display)" }}>
              ¿Eliminar colección?
            </h4>
            <p style={{ fontSize: "0.85rem", color: "var(--text-secondary)", lineHeight: 1.5 }}>
              Esta acción borrará permanentemente la lista y todos sus elementos vinculados.
            </p>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "12px", marginTop: "8px" }}>
              <button
                onClick={() => setListToDelete(null)}
                style={{
                  background: "transparent",
                  border: "1px solid var(--border)",
                  color: "var(--text-secondary)",
                  padding: "8px 16px",
                  borderRadius: "8px",
                  cursor: "pointer",
                  fontWeight: 600,
                  fontSize: "0.85rem"
                }}
              >
                Cancelar
              </button>
              <button
                onClick={() => {
                  executeDeleteList(listToDelete);
                  setListToDelete(null);
                }}
                style={{
                  background: "rgba(244, 63, 94, 0.1)",
                  color: "#f43f5e",
                  border: "1px solid rgba(244, 63, 94, 0.3)",
                  padding: "8px 16px",
                  borderRadius: "8px",
                  cursor: "pointer",
                  fontWeight: 600,
                  fontSize: "0.85rem"
                }}
              >
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Account Settings Modal */}
      {isAccountSettingsOpen && (
        <AccountSettingsModal
          isOpen={isAccountSettingsOpen}
          onClose={() => setIsAccountSettingsOpen(false)}
          username={profile.username}
        />
      )}

      {/* Recap Modal */}
      {isRecapOpen && (
        <RecapModal
          username={profile.username}
          onClose={() => setIsRecapOpen(false)}
        />
      )}
    </div>
  );
}
