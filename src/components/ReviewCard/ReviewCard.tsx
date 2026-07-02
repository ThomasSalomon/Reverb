"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import RatingStars from "../RatingStars/RatingStars";
import styles from "./ReviewCard.module.css";
import { showToast } from "@/components/Toast/ToastListener";
import Avatar from "@/components/Avatar/Avatar";

import sharedStyles from "../SharedModal.module.css";

interface ReviewCardProps {
  review: {
    id: string;
    content: string;
    ratingValue: number;
    createdAt: string | Date;
    user: {
      id: string;
      username: string;
      profileColor?: string | null;
      profileImage?: string | null;
    };
    musicItem?: {
      id: string;
      title: string;
      artist: string;
      coverUrl: string;
      type: string;
    };
    musicItemId?: string;
    tags?: string | null;
    favoriteTrack?: string | null;
    likesCount?: number;
    commentsCount?: number;
    likedByUser?: boolean;
  };
  showMusicDetails?: boolean;
  onDeleted?: (reviewId: string) => void;
  onUpdated?: (reviewId: string, updatedData: { content: string; ratingValue: number; tags: string | null; favoriteTrack: string | null }) => void;
}

const COLOR_MAP: Record<string, string> = {
  emerald: "#10b981",
  violet: "#8b5cf6",
  cobalt: "#3b82f6",
  amber: "#f59e0b",
  rose: "#f43f5e",
  slate: "#64748b"
};

const ReviewCard = React.memo(function ReviewCard({ review, showMusicDetails = false, onDeleted, onUpdated }: ReviewCardProps) {
  // Local display states (allows real-time updates without reload)
  const [content, setContent] = useState(review.content);
  const [ratingValue, setRatingValue] = useState(review.ratingValue);
  const [tags, setTags] = useState(review.tags);
  const [favoriteTrack, setFavoriteTrack] = useState(review.favoriteTrack);

  // Sync props to state if they change
  useEffect(() => {
    setContent(review.content);
    setRatingValue(review.ratingValue);
    setTags(review.tags);
    setFavoriteTrack(review.favoriteTrack);
  }, [review]);

  // Interaction states
  const [likesCount, setLikesCount] = useState(review.likesCount || 0);
  const [liked, setLiked] = useState(review.likedByUser || false);
  const [commentsCount, setCommentsCount] = useState(review.commentsCount || 0);
  
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [comments, setComments] = useState<any[]>([]);
  const [newCommentText, setNewCommentText] = useState("");
  const [loadingComments, setLoadingComments] = useState(false);
  const [currentUser, setCurrentUser] = useState<{ userId: string; username: string } | null>(null);
  const [commentToDelete, setCommentToDelete] = useState<string | null>(null);
  const [reviewToDelete, setReviewToDelete] = useState<string | null>(null);

  // Review editing states
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(review.content);
  const [editRating, setEditRating] = useState(review.ratingValue);
  const [editTags, setEditTags] = useState<string[]>(review.tags ? review.tags.split(",") : []);
  const [editFavoriteTrack, setEditFavoriteTrack] = useState(review.favoriteTrack || "");
  const [savingEdit, setSavingEdit] = useState(false);

  const AVAILABLE_TAGS = [
    "Épico", "Relajante", "Melancólico", "Enérgico", "Oscuro",
    "Experimental", "Clásico", "Innovador", "Nostálgico", "Divertido"
  ];

  const toggleEditTag = (tag: string) => {
    setEditTags(prev => 
      prev.includes(tag) 
        ? prev.filter(t => t !== tag)
        : prev.length < 5 ? [...prev, tag] : prev
    );
  };

  // Check auth user
  useEffect(() => {
    async function checkAuth() {
      try {
        const res = await fetch("/api/auth/me", { cache: "no-store" });
        if (res.ok) {
          const data = await res.json();
          setCurrentUser({ userId: data.user.id, username: data.user.username });
        }
      } catch (err) {
        console.error("Auth check error:", err);
      }
    }
    checkAuth();
  }, []);

  const formattedDate = new Date(review.createdAt).toLocaleDateString("es-ES", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  const colorVal = review.user.profileColor && COLOR_MAP[review.user.profileColor]
    ? COLOR_MAP[review.user.profileColor]
    : undefined;

  const themeColor = colorVal || "#10b981";

  const avatarStyle = {
    backgroundColor: `${themeColor}1a`, // 10% opacity
    color: themeColor,
    borderColor: `${themeColor}33`, // 20% opacity
    boxShadow: `0 0 10px ${themeColor}0d` // 5% opacity
  };

  // Toggle Like
  const handleLikeToggle = async () => {
    if (!currentUser) {
      showToast("Inicia sesión para darle me gusta a esta reseña", "error");
      return;
    }

    try {
      const method = liked ? "DELETE" : "POST";
      const res = await fetch(`/api/reviews/${review.id}/like`, { method });
      if (res.ok) {
        setLiked(!liked);
        setLikesCount(likesCount + (liked ? -1 : 1));
      }
    } catch (error) {
      console.error("Like toggle error:", error);
    }
  };

  // Fetch comments list
  const fetchComments = useCallback(async () => {
    try {
      setLoadingComments(true);
      const res = await fetch(`/api/reviews/${review.id}/comments`, { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        setComments(data);
        setCommentsCount(data.length);
      }
    } catch (error) {
      console.error("Fetch comments error:", error);
    } finally {
      setLoadingComments(false);
    }
  }, [review.id]);

  // Open comments side tray
  const handleOpenComments = () => {
    setCommentsOpen(true);
    fetchComments();
  };

  // Submit comment
  const handlePostComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCommentText.trim()) return;

    try {
      const res = await fetch(`/api/reviews/${review.id}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: newCommentText }),
      });

      if (res.ok) {
        setNewCommentText("");
        await fetchComments();
      } else {
        const data = await res.json();
        showToast(data.error || "Error al publicar comentario", "error");
      }
    } catch (error) {
      console.error("Post comment error:", error);
    }
  };

  const handleDeleteComment = (commentId: string) => {
    setCommentToDelete(commentId);
  };

  const executeDeleteComment = async (commentId: string) => {
    try {
      const res = await fetch(`/api/comments/${commentId}`, {
        method: "DELETE",
      });

      if (res.ok) {
        showToast("Comentario eliminado", "success");
        await fetchComments();
      } else {
        const data = await res.json();
        showToast(data.error || "Error al eliminar comentario", "error");
      }
    } catch (error) {
      console.error("Delete comment error:", error);
      showToast("Error de conexión", "error");
    }
  };

  const executeDeleteReview = async () => {
    try {
      const res = await fetch(`/api/reviews/${review.id}`, {
        method: "DELETE",
      });

      if (res.ok) {
        showToast("Reseña eliminada", "success");
        if (onDeleted) {
          onDeleted(review.id);
        } else {
          window.location.reload();
        }
      } else {
        const data = await res.json();
        showToast(data.error || "Error al eliminar la reseña", "error");
      }
    } catch (error) {
      console.error("Delete review error:", error);
      showToast("Error de conexión", "error");
    }
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editRating === 0) {
      showToast("Por favor, selecciona una calificación de estrellas", "error");
      return;
    }
    if (!editContent.trim()) {
      showToast("Por favor, escribe el contenido de la reseña", "error");
      return;
    }

    setSavingEdit(true);
    try {
      const res = await fetch(`/api/reviews/${review.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          content: editContent,
          ratingValue: editRating,
          tags: editTags,
          favoriteTrack: editFavoriteTrack,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Error al actualizar la reseña");
      }

      // Update local display state
      setContent(editContent.trim());
      setRatingValue(editRating);
      setTags(editTags.join(","));
      setFavoriteTrack(editFavoriteTrack.trim() || null);

      showToast("Reseña actualizada con éxito", "success");
      setIsEditing(false);

      if (onUpdated) {
        onUpdated(review.id, {
          content: editContent.trim(),
          ratingValue: editRating,
          tags: editTags.join(","),
          favoriteTrack: editFavoriteTrack.trim() || null,
        });
      }
    } catch (err: any) {
      showToast(err.message || "Error al actualizar la reseña", "error");
    } finally {
      setSavingEdit(false);
    }
  };

  return (
    <>
      <div className={styles.card}>
        <div className={styles.header}>
          <div className={styles.userInfo}>
            <Link href={`/users/${review.user.username}`} className={styles.avatarLink}>
              <Avatar
                username={review.user.username}
                profileColor={review.user.profileColor}
                profileImage={review.user.profileImage}
                size={40}
                className={styles.avatar}
                style={{ border: "none" }}
              />
            </Link>
            <div>
              <Link href={`/users/${review.user.username}`} className={styles.usernameLink}>
                <span className={styles.username}>@{review.user.username}</span>
              </Link>
              <div className={styles.meta}>
                 <RatingStars value={ratingValue} size={14} />
                <span className={styles.dot}>•</span>
                <span className={styles.date}>{formattedDate}</span>
                {currentUser && currentUser.userId === review.user.id && (
                  <>
                    <span className={styles.dot}>•</span>
                    <button 
                      onClick={() => {
                        setEditContent(content);
                        setEditRating(ratingValue);
                        setEditTags(tags ? tags.split(",") : []);
                        setEditFavoriteTrack(favoriteTrack || "");
                        setIsEditing(true);
                      }}
                      className={styles.editReviewBtn}
                      title="Editar reseña"
                    >
                      Editar
                    </button>
                    <span className={styles.dot}>•</span>
                    <button 
                      onClick={() => setReviewToDelete(review.id)}
                      className={styles.deleteReviewBtn}
                      title="Eliminar reseña"
                      aria-label={`Eliminar reseña de ${review.musicItem ? review.musicItem.title : "este elemento"}`}
                    >
                      Eliminar
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>

          {showMusicDetails && review.musicItem && (
            <Link href={`/albums/${review.musicItem.id}`} className={styles.musicBadge}>
              <img
                src={review.musicItem.coverUrl}
                alt={review.musicItem.title}
                className={styles.miniCover}
              />
              <div className={styles.badgeInfo}>
                <span className={styles.title}>{review.musicItem.title}</span>
                <span className={styles.artist}>{review.musicItem.artist}</span>
              </div>
            </Link>
          )}
        </div>

        {favoriteTrack && (
          <div 
            className={styles.favTrackBadge}
            style={{
              borderColor: `${themeColor}33`,
              boxShadow: `0 4px 12px ${themeColor}1a`
            }}
          >
            <div className={styles.favTrackIcon} style={{ color: themeColor }}>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
              </svg>
            </div>
            <span className={styles.favLabel}>Canción favorita</span>
            <span className={styles.favTitle}>{favoriteTrack}</span>
          </div>
        )}
        
        {tags && tags.length > 0 && (
          <div className={styles.tagsContainer}>
            {tags.split(",").map(tag => (
              <span key={tag} className={styles.tagPill}>{tag}</span>
            ))}
          </div>
        )}

        <p className={styles.content}>{content}</p>

        {/* Likes and Comments tray buttons */}
        <div className={styles.actionsRow}>
          <button 
            onClick={handleLikeToggle}
            className={`${styles.actionBtn} ${liked ? styles.liked : ""}`}
            style={liked ? { "--profile-theme-color": themeColor } as React.CSSProperties : undefined}
          >
            <span>{liked ? "💚" : "🤍"}</span>
            <span>{likesCount} {likesCount === 1 ? "Me gusta" : "Me gustas"}</span>
          </button>

          <button 
            onClick={handleOpenComments}
            className={styles.actionBtn}
          >
            <span>💬</span>
            <span>{commentsCount} {commentsCount === 1 ? "Comentario" : "Comentarios"}</span>
          </button>
        </div>
      </div>

      {/* Side Tray Panel for Comments */}
      {commentsOpen && (
        <>
          <div className={styles.drawerOverlay} onClick={() => setCommentsOpen(false)} />
          <div className={styles.commentsDrawer}>
            <div className={styles.drawerHeader}>
              <span className={styles.drawerTitle}>Comentarios ({commentsCount})</span>
              <button className={styles.closeBtn} onClick={() => setCommentsOpen(false)}>
                &times;
              </button>
            </div>

            <div className={styles.commentsList}>
              {loadingComments ? (
                <div style={{ textAlign: "center", color: "var(--text-secondary)", padding: "20px" }}>
                  Cargando comentarios...
                </div>
              ) : comments.length > 0 ? (
                comments.map((comment) => {
                  const commentDateStr = new Date(comment.createdAt).toLocaleDateString("es-ES", {
                    day: "numeric",
                    month: "short",
                    year: "numeric"
                  });

                  // Allow delete if current user is comment owner or review owner (BOLA check on client side for display)
                  const canDelete = currentUser && (
                    comment.userId === currentUser.userId || 
                    review.user.id === currentUser.userId
                  );

                  return (
                    <div key={comment.id} className={styles.commentItem}>
                      <Avatar
                        username={comment.user.username}
                        profileColor={comment.user.profileColor}
                        profileImage={comment.user.profileImage}
                        size={28}
                        className={styles.commentAvatar}
                        style={{ border: "none", flexShrink: 0 }}
                      />
                      <div className={styles.commentContent}>
                        <div className={styles.commentMeta}>
                          <Link href={`/users/${comment.user.username}`} className={styles.commentUser}>
                            @{comment.user.username}
                          </Link>
                          <span className={styles.commentDate}>{commentDateStr}</span>
                        </div>
                        <p className={styles.commentText}>{comment.content}</p>
                      </div>
                      {canDelete && (
                        <button 
                          onClick={() => handleDeleteComment(comment.id)} 
                          className={styles.deleteCommentBtn}
                          title="Eliminar comentario"
                        >
                          🗑️
                        </button>
                      )}
                    </div>
                  );
                })
              ) : (
                <div style={{ textAlign: "center", color: "var(--text-muted)", padding: "40px 20px" }}>
                  Aún no hay comentarios. ¡Sé el primero en comentar!
                </div>
              )}
            </div>

            {/* Comment Form */}
            {currentUser ? (
              <form onSubmit={handlePostComment} className={styles.commentForm}>
                <textarea
                  className={styles.commentInput}
                  placeholder="Escribe un comentario..."
                  rows={2}
                  maxLength={300}
                  value={newCommentText}
                  onChange={(e) => setNewCommentText(e.target.value)}
                />
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>
                    {newCommentText.length}/300
                  </span>
                  <button type="submit" className="neon-btn" style={{ padding: "6px 16px", fontSize: "0.85rem" }}>
                    Comentar
                  </button>
                </div>
              </form>
            ) : (
              <div style={{ padding: "20px", borderTop: "1px solid var(--border)", textAlign: "center", background: "#08090d" }}>
                <Link href="/login" style={{ color: "var(--primary)", textDecoration: "none", fontSize: "0.9rem", fontWeight: 700 }}>
                  Inicia sesión para comentar
                </Link>
              </div>
            )}
          </div>
        </>
      )}

      {/* Custom Comment Delete Confirm Modal Overlay */}
      {commentToDelete && (
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
              ¿Eliminar comentario?
            </h4>
            <p style={{ fontSize: "0.85rem", color: "var(--text-secondary)", lineHeight: 1.5 }}>
              Esta acción no se puede deshacer y borrará permanentemente el comentario.
            </p>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "12px", marginTop: "8px" }}>
              <button
                onClick={() => setCommentToDelete(null)}
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
                  executeDeleteComment(commentToDelete);
                  setCommentToDelete(null);
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

      {/* Custom Review Delete Confirm Modal Overlay */}
      {reviewToDelete && (
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
              ¿Eliminar reseña?
            </h4>
            <p style={{ fontSize: "0.85rem", color: "var(--text-secondary)", lineHeight: 1.5 }}>
              Esta acción no se puede deshacer. Tu reseña, likes y comentarios serán borrados permanentemente.
            </p>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "12px", marginTop: "8px" }}>
              <button
                onClick={() => setReviewToDelete(null)}
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
                  executeDeleteReview();
                  setReviewToDelete(null);
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

      {/* Custom Review Edit Modal Overlay */}
      {isEditing && (
        <div className={sharedStyles.modalOverlay}>
          <div className={sharedStyles.modalContent} style={{ maxWidth: "500px" }}>
            <div className={sharedStyles.modalHeader}>
              <h3 className={sharedStyles.modalTitle}>Editar Reseña</h3>
              <button 
                className={sharedStyles.closeBtn} 
                onClick={() => setIsEditing(false)}
                aria-label="Cerrar modal"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className={sharedStyles.formContainer}>
              {/* Rating Section */}
              <div className={sharedStyles.formGroup}>
                <label className={sharedStyles.formLabel}>Tu Calificación:</label>
                <div style={{ display: "flex", alignItems: "center" }}>
                  <RatingStars value={editRating} onChange={setEditRating} interactive={true} size={28} />
                </div>
              </div>

              {/* Tags Section */}
              <div className={sharedStyles.formGroup}>
                <label className={sharedStyles.formLabel}>Tags / Mood (Máx 5):</label>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                  {AVAILABLE_TAGS.map(tag => {
                    const isActive = editTags.includes(tag);
                    return (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => toggleEditTag(tag)}
                        style={{
                          background: isActive ? "rgba(0, 229, 117, 0.15)" : "rgba(255, 255, 255, 0.05)",
                          border: `1px solid ${isActive ? "var(--primary)" : "var(--border)"}`,
                          color: isActive ? "var(--primary)" : "var(--text-secondary)",
                          padding: "6px 12px",
                          borderRadius: "20px",
                          fontSize: "0.8rem",
                          fontWeight: 500,
                          cursor: "pointer",
                          transition: "all 160ms ease",
                          userSelect: "none"
                        }}
                      >
                        {tag}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Content Textarea */}
              <div className={sharedStyles.formGroup}>
                <label className={sharedStyles.formLabel}>Tu Reseña:</label>
                <textarea
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  placeholder="¿Qué opinas de este álbum?..."
                  rows={5}
                  className={sharedStyles.formInput}
                  style={{ resize: "vertical", fontFamily: "inherit" }}
                  disabled={savingEdit}
                />
              </div>

              {/* Favorite Track */}
              <div className={sharedStyles.formGroup}>
                <label className={sharedStyles.formLabel}>Canción favorita (opcional):</label>
                <input
                  type="text"
                  value={editFavoriteTrack}
                  onChange={(e) => setEditFavoriteTrack(e.target.value)}
                  placeholder="Nombre de la canción..."
                  className={sharedStyles.formInput}
                  disabled={savingEdit}
                />
              </div>

              {/* Modal Footer */}
              <div className={sharedStyles.modalFooter}>
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className={sharedStyles.cancelBtn}
                  disabled={savingEdit}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className={sharedStyles.saveBtn}
                  disabled={savingEdit}
                >
                  {savingEdit ? "Guardando..." : "Guardar Cambios"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
})

export default ReviewCard;
