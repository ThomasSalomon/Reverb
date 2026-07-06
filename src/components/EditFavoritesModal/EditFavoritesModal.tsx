"use client";

import React, { useState, useEffect } from "react";
import styles from "../SharedModal.module.css";
import localStyles from "../../app/[locale]/users/[username]/page.module.css";
import { showToast } from "@/components/Toast/ToastListener";
import { useBodyScrollLock } from "@/hooks/useBodyScrollLock";

interface DeezerSearchResult {
  id: string;
  title: string;
  artist: string;
  coverUrl: string;
}

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
  createdAt: string;
  favoriteAlbums?: FavoriteAlbumRelation[];
}

interface EditFavoritesModalProps {
  isOpen: boolean;
  onClose: () => void;
  profile: UserProfile;
  onSave: () => Promise<void>;
}

export default function EditFavoritesModal({ isOpen, onClose, profile, onSave }: EditFavoritesModalProps) {
  const [selectedAlbums, setSelectedAlbums] = useState<{ [slot: number]: any }>({ 1: null, 2: null, 3: null });
  const [albumQueries, setAlbumQueries] = useState<{ [slot: number]: string }>({ 1: "", 2: "", 3: "" });
  const [slotSearchResults, setSlotSearchResults] = useState<{ [slot: number]: DeezerSearchResult[] }>({ 1: [], 2: [], 3: [] });
  const [slotSearching, setSlotSearching] = useState<{ [slot: number]: boolean }>({ 1: false, 2: false, 3: false });
  const [saving, setSaving] = useState(false);

  // Initialize selected albums from profile when modal opens
  useEffect(() => {
    if (isOpen && profile) {
      const initialAlbums: { [slot: number]: any } = { 1: null, 2: null, 3: null };
      if (profile.favoriteAlbums) {
        profile.favoriteAlbums.forEach(fav => {
          initialAlbums[fav.slot] = fav.musicItem;
        });
      }
      setSelectedAlbums(initialAlbums);
      setAlbumQueries({ 1: "", 2: "", 3: "" });
      setSlotSearchResults({ 1: [], 2: [], 3: [] });
    }
  }, [isOpen, profile]);

  // Live Deezer searches for each slot
  useEffect(() => {
    const query = albumQueries[1];
    if (!query || query.trim() === "") {
      setSlotSearchResults(prev => ({ ...prev, 1: [] }));
      return;
    }
    const timer = setTimeout(async () => {
      setSlotSearching(prev => ({ ...prev, 1: true }));
      try {
        const res = await fetch(`/api/music?q=${encodeURIComponent(query)}`);
        if (res.ok) {
          const data = await res.json();
          setSlotSearchResults(prev => ({ ...prev, 1: data.slice(0, 20) }));
        }
      } catch (e) {
        console.error(e);
      } finally {
        setSlotSearching(prev => ({ ...prev, 1: false }));
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [albumQueries[1]]);

  useEffect(() => {
    const query = albumQueries[2];
    if (!query || query.trim() === "") {
      setSlotSearchResults(prev => ({ ...prev, 2: [] }));
      return;
    }
    const timer = setTimeout(async () => {
      setSlotSearching(prev => ({ ...prev, 2: true }));
      try {
        const res = await fetch(`/api/music?q=${encodeURIComponent(query)}`);
        if (res.ok) {
          const data = await res.json();
          setSlotSearchResults(prev => ({ ...prev, 2: data.slice(0, 20) }));
        }
      } catch (e) {
        console.error(e);
      } finally {
        setSlotSearching(prev => ({ ...prev, 2: false }));
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [albumQueries[2]]);

  useEffect(() => {
    const query = albumQueries[3];
    if (!query || query.trim() === "") {
      setSlotSearchResults(prev => ({ ...prev, 3: [] }));
      return;
    }
    const timer = setTimeout(async () => {
      setSlotSearching(prev => ({ ...prev, 3: true }));
      try {
        const res = await fetch(`/api/music?q=${encodeURIComponent(query)}`);
        if (res.ok) {
          const data = await res.json();
          setSlotSearchResults(prev => ({ ...prev, 3: data.slice(0, 20) }));
        }
      } catch (e) {
        console.error(e);
      } finally {
        setSlotSearching(prev => ({ ...prev, 3: false }));
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [albumQueries[3]]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch(`/api/users/${profile.username}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          favoriteAlbums: [
            { slot: 1, musicItemId: selectedAlbums[1]?.id || null },
            { slot: 2, musicItemId: selectedAlbums[2]?.id || null },
            { slot: 3, musicItemId: selectedAlbums[3]?.id || null },
          ]
        })
      });

      const data = await res.json();
      if (!res.ok) {
        showToast(data.error || "Error al actualizar favoritos", "error");
        return;
      }

      showToast("Álbumes favoritos actualizados", "success");
      await onSave();
      onClose();
    } catch (e) {
      console.error("Save favorites error:", e);
      showToast("Error de conexión", "error");
    } finally {
      setSaving(false);
    }
  };

  useBodyScrollLock(isOpen);
  if (!isOpen) return null;

  return (
    <div className={styles.modalOverlay}>
      <div className={styles.modalContent} style={{ maxWidth: "480px" }}>
        <div className={styles.modalHeader}>
          <h3 className={styles.modalTitle}>Álbumes Favoritos</h3>
          <button onClick={onClose} className={styles.closeBtn}>
            &times;
          </button>
        </div>

        <form onSubmit={handleSubmit} className={styles.formContainer}>
          <span style={{ fontSize: "0.85rem", color: "var(--text-secondary)" }}>
            Elige hasta 3 álbumes para destacar en tu perfil.
          </span>

          <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            {[1, 2, 3].map((slot) => {
              const selectedAlbum = selectedAlbums[slot];
              const albumQuery = albumQueries[slot] || "";
              const searching = slotSearching[slot] || false;
              const searchResults = slotSearchResults[slot] || [];
              
              return (
                <div key={slot} style={{ padding: "12px", background: "rgba(255,255,255,0.02)", borderRadius: "8px", border: "1px solid var(--border)" }}>
                  <span style={{ fontSize: "0.8rem", fontWeight: 700, color: "var(--text-secondary)", display: "block", marginBottom: "6px" }}>Puesto #{slot}</span>
                  
                  {selectedAlbum ? (
                    <div className={localStyles.selectedAlbumDisplay} style={{ margin: 0 }}>
                      <div className={localStyles.selectedAlbumInfo}>
                        <img
                          src={selectedAlbum.coverUrl}
                          alt={selectedAlbum.title}
                          style={{ width: "32px", height: "32px", borderRadius: "4px" }}
                        />
                        <div style={{ display: "flex", flexDirection: "column" }}>
                          <span style={{ fontSize: "0.85rem", fontWeight: "600" }}>
                            {selectedAlbum.title}
                          </span>
                          <span style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>
                            {selectedAlbum.artist}
                          </span>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedAlbums(prev => ({ ...prev, [slot]: null }));
                        }}
                        className={localStyles.removeAlbumBtn}
                      >
                        Remover
                      </button>
                    </div>
                  ) : (
                    <div className={localStyles.searchContainer} style={{ position: "relative" }}>
                      <input
                        type="text"
                        className={styles.formInput}
                        placeholder="Buscar álbum (ej: The Dark Side of the Moon)"
                        value={albumQuery}
                        onChange={(e) => setAlbumQueries(prev => ({ ...prev, [slot]: e.target.value }))}
                        style={{ width: "100%", paddingRight: "30px" }}
                      />
                      {searching && (
                        <div style={{ position: "absolute", right: "12px", top: "14px" }}>
                          <div className={localStyles.spinner} style={{ width: "16px", height: "16px" }}></div>
                        </div>
                      )}
                      
                      {searchResults.length > 0 && (
                        <div className={localStyles.searchResults} style={{ top: "42px" }}>
                          {searchResults.map(item => (
                            <div
                              key={item.id}
                              className={localStyles.searchItem}
                              onClick={() => {
                                setSelectedAlbums(prev => ({ ...prev, [slot]: item }));
                                setAlbumQueries(prev => ({ ...prev, [slot]: "" }));
                                setSlotSearchResults(prev => ({ ...prev, [slot]: [] }));
                              }}
                            >
                              <img
                                src={item.coverUrl}
                                alt={item.title}
                                className={localStyles.searchItemCover}
                              />
                              <div className={localStyles.searchItemInfo}>
                                <span className={localStyles.searchItemTitle}>{item.title}</span>
                                <span className={localStyles.searchItemArtist}>{item.artist}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className={styles.modalFooter}>
            <button type="button" onClick={onClose} className={styles.cancelBtn} disabled={saving}>
              Cancelar
            </button>
            <button type="submit" className={styles.saveBtn} disabled={saving}>
              {saving ? "Guardando..." : "Guardar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
