"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { Link } from "@/i18n/routing";
import RatingStars from "../RatingStars/RatingStars";
import styles from "./ReviewCard.module.css";
import { showToast } from "@/components/Toast/ToastListener";
import Avatar from "@/components/Avatar/Avatar";
import { useLocale, useTranslations } from "next-intl";

import sharedStyles from "../SharedModal.module.css";
import AccessibleDialog from "@/components/AccessibleDialog/AccessibleDialog";
import Button from "@/components/Button/Button";
import {
  CANONICAL_REVIEW_TAGS,
  getReviewTagTranslationKey,
  normalizeReviewTagValues,
} from "@/utils/review-tags";

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
  const t = useTranslations("Review");
  const common = useTranslations("Common");
  const locale = useLocale();
  const editContentId = React.useId();
  // Local display states (allows real-time updates without reload)
  const [content, setContent] = useState(review.content);
  const [ratingValue, setRatingValue] = useState(review.ratingValue);
  const [tags, setTags] = useState(review.tags);
  const [favoriteTrack, setFavoriteTrack] = useState<string | null>(review.favoriteTrack ?? null);

  // Sync props to state if they change
  useEffect(() => {
    setContent(review.content);
    setRatingValue(review.ratingValue);
    setTags(review.tags);
    setFavoriteTrack(review.favoriteTrack ?? null);
  }, [review]);

  // Interaction states
  const [likesCount, setLikesCount] = useState(review.likesCount || 0);
  const [liked, setLiked] = useState(review.likedByUser || false);
  const [likePending, setLikePending] = useState(false);
  const [commentsCount, setCommentsCount] = useState(review.commentsCount || 0);
  
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [comments, setComments] = useState<any[]>([]);
  const [newCommentText, setNewCommentText] = useState("");
  const [postingComment, setPostingComment] = useState(false);
  const commentRequestInFlightRef = useRef(false);
  const pendingCommentOperationRef = useRef<{ id: string; content: string } | null>(null);
  const [loadingComments, setLoadingComments] = useState(false);
  const [commentsNextCursor, setCommentsNextCursor] = useState<string | null>(null);
  const [hasMoreComments, setHasMoreComments] = useState(false);
  const [currentUser, setCurrentUser] = useState<{ userId: string; username: string } | null>(null);
  const [commentToDelete, setCommentToDelete] = useState<string | null>(null);
  const [reviewToDelete, setReviewToDelete] = useState<string | null>(null);

  // Review editing states
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(review.content);
  const [editRating, setEditRating] = useState(review.ratingValue);
  const [editTags, setEditTags] = useState<string[]>(normalizeReviewTagValues(review.tags ? review.tags.split(",") : [], Infinity));
  const [editFavoriteTrack, setEditFavoriteTrack] = useState(review.favoriteTrack || "");
  const [editTracks, setEditTracks] = useState<string[] | null>(null);
  const [tracksLoading, setTracksLoading] = useState(false);
  const [tracklistUnavailable, setTracklistUnavailable] = useState(false);
  const [favoriteTrackTouched, setFavoriteTrackTouched] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);
  const favoriteTrackId = React.useId();

  const toggleEditTag = (tag: string) => {
    setEditTags(prev => 
      prev.includes(tag) 
        ? prev.filter(t => t !== tag)
        : prev.length < 5 ? [...prev, tag] : prev
    );
  };

  const loadEditTracks = async () => {
    const musicItemId = review.musicItem?.id ?? review.musicItemId;
    if (!musicItemId) {
      setEditTracks([]);
      setTracklistUnavailable(true);
      return;
    }

    setTracksLoading(true);
    setTracklistUnavailable(false);
    try {
      const response = await fetch(`/api/music/${encodeURIComponent(musicItemId)}`, { cache: "no-store" });
      if (!response.ok) throw new Error("Unable to load album tracks");
      const data: unknown = await response.json();
      const tracks = typeof data === "object" && data !== null && "tracks" in data && Array.isArray(data.tracks)
        ? data.tracks.flatMap((track) => (
          typeof track === "object" && track !== null && "title" in track && typeof track.title === "string" && track.title.trim()
            ? [track.title.trim()]
            : []
        ))
        : [];
      setEditTracks(tracks);
      setTracklistUnavailable(tracks.length === 0);
    } catch {
      setEditTracks([]);
      setTracklistUnavailable(true);
    } finally {
      setTracksLoading(false);
    }
  };

  // Check auth user
  useEffect(() => {
    async function checkAuth() {
      try {
        const res = await fetch("/api/auth/me", { cache: "no-store" });
        if (res.ok) {
          const data = await res.json();
          if (data.user) {
            setCurrentUser({ userId: data.user.id, username: data.user.username });
          }
        }
      } catch (err) {
        console.error("Auth check error:", err);
      }
    }
    checkAuth();
  }, []);

  const formattedDate = new Date(review.createdAt).toLocaleDateString(locale, {
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
      showToast(t("loginToLike"), "error");
      return;
    }

    if (likePending) return;
    setLikePending(true);
    try {
      const method = liked ? "DELETE" : "POST";
      const res = await fetch(`/api/reviews/${review.id}/like`, { method });
      if (res.ok) {
        const data = await res.json();
        setLiked(data.liked);
        setLikesCount(data.likesCount);
      }
    } catch (error) {
      console.error("Like toggle error:", error);
    } finally {
      setLikePending(false);
    }
  };

  // Fetch comments list
  const fetchComments = useCallback(async (cursor?: string | null, append = false) => {
    try {
      setLoadingComments(true);
      const query = cursor ? `?cursor=${encodeURIComponent(cursor)}` : "";
      const res = await fetch(`/api/reviews/${review.id}/comments${query}`, { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        setComments((previous) => append ? [...previous, ...data.items] : data.items);
        setCommentsNextCursor(data.nextCursor);
        setHasMoreComments(data.hasNextPage);
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
    fetchComments(null, false);
  };

  // Submit comment
  const handlePostComment = async (e: React.FormEvent) => {
    e.preventDefault();
    const content = newCommentText.trim();
    if (!content || commentRequestInFlightRef.current) return;

    if (!pendingCommentOperationRef.current?.id || pendingCommentOperationRef.current.content !== content) {
      pendingCommentOperationRef.current = {
        id: crypto.randomUUID(),
        content,
      };
    }
    const operationId = pendingCommentOperationRef.current.id;
    commentRequestInFlightRef.current = true;
    setPostingComment(true);

    try {
      const res = await fetch(`/api/reviews/${review.id}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content, operationId }),
      });

      if (res.ok) {
        const data = await res.json();
        pendingCommentOperationRef.current = null;
        setNewCommentText("");
        setCommentsCount(data.commentsCount);
        await fetchComments();
      } else {
        if (res.status < 500) pendingCommentOperationRef.current = null;
        showToast(t("postCommentError"), "error");
      }
    } catch (error) {
      console.error("Post comment error:", error);
      showToast(t("postCommentError"), "error");
    } finally {
      commentRequestInFlightRef.current = false;
      setPostingComment(false);
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
        showToast(t("commentDeleted"), "success");
        await fetchComments();
      } else {
        const data = await res.json();
        showToast(t("commentDeleteError"), "error");
      }
    } catch (error) {
      console.error("Delete comment error:", error);
      showToast(common("connectionError"), "error");
    }
  };

  const executeDeleteReview = async () => {
    try {
      const res = await fetch(`/api/reviews/${review.id}`, {
        method: "DELETE",
      });

      if (res.ok) {
        showToast(t("reviewDeleted"), "success");
        if (onDeleted) {
          onDeleted(review.id);
        } else {
          window.location.reload();
        }
      } else {
        const data = await res.json();
        showToast(t("reviewDeleteError"), "error");
      }
    } catch (error) {
      console.error("Delete review error:", error);
      showToast(common("connectionError"), "error");
    }
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editRating === 0) {
      showToast(t("ratingRequired"), "error");
      return;
    }
    if (!editContent.trim()) {
      showToast(t("contentRequired"), "error");
      return;
    }

    setSavingEdit(true);
    try {
      const body = {
        content: editContent,
        ratingValue: editRating,
        tags: editTags,
        ...(favoriteTrackTouched ? { favoriteTrack: editFavoriteTrack } : {}),
      };
      const res = await fetch(`/api/reviews/${review.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(t("reviewUpdateError"));
      }

      // Update local display state
      setContent(editContent.trim());
      setRatingValue(editRating);
      setTags(editTags.join(","));
      if (favoriteTrackTouched) {
        setFavoriteTrack(editFavoriteTrack.trim() || null);
      }

      showToast(t("reviewUpdated"), "success");
      setIsEditing(false);

      if (onUpdated) {
        onUpdated(review.id, {
          content: editContent.trim(),
          ratingValue: editRating,
          tags: editTags.join(","),
          favoriteTrack: favoriteTrackTouched ? editFavoriteTrack.trim() || null : favoriteTrack,
        });
      }
    } catch (err: any) {
      showToast(err.message || t("reviewUpdateError"), "error");
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
                        setEditTags(normalizeReviewTagValues(tags ? tags.split(",") : [], Infinity));
                        setEditFavoriteTrack(favoriteTrack || "");
                        setEditTracks(null);
                        setTracklistUnavailable(false);
                        setFavoriteTrackTouched(false);
                        setIsEditing(true);
                        void loadEditTracks();
                      }}
                      className={styles.editReviewBtn}
                      title={t("edit")}
                    >
                      {t("edit")}
                    </button>
                    <span className={styles.dot}>•</span>
                    <button 
                      onClick={() => setReviewToDelete(review.id)}
                      className={styles.deleteReviewBtn}
                      title={t("delete")}
                      aria-label={t("deleteReviewLabel", { item: review.musicItem?.title || t("unknownItem") })}
                    >
                      {t("delete")}
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
            <span className={styles.favLabel}>{t("favoriteTrack")}</span>
            <span className={styles.favTitle}>{favoriteTrack}</span>
          </div>
        )}
        
        {tags && tags.length > 0 && (
          <div className={styles.tagsContainer}>
            {tags.split(",").map(tag => {
              const translationKey = getReviewTagTranslationKey(tag);
              return <span key={tag} className={styles.tagPill}>{translationKey ? t(translationKey) : tag}</span>;
            })}
          </div>
        )}

        <p className={styles.content}>{content}</p>

        {/* Likes and Comments tray buttons */}
        <div className={styles.actionsRow}>
          <button 
            onClick={handleLikeToggle}
            disabled={likePending}
            className={`${styles.actionBtn} ${liked ? styles.liked : ""}`}
            style={liked ? { "--profile-theme-color": themeColor } as React.CSSProperties : undefined}
          >
            <span>{liked ? "💚" : "🤍"}</span>
            <span>{t("likesCount", { count: likesCount })}</span>
          </button>

          <button 
            onClick={handleOpenComments}
            className={styles.actionBtn}
          >
            <span>💬</span>
            <span>{t("commentsCount", { count: commentsCount })}</span>
          </button>
        </div>
      </div>

      {/* Side Tray Panel for Comments */}
      {commentsOpen && (
        <AccessibleDialog
          isOpen={commentsOpen}
          onClose={() => setCommentsOpen(false)}
          labelledBy="comments-drawer-title"
          className={styles.drawerOverlay}
        >
          <div className={styles.commentsDrawer}>
            <div className={styles.drawerHeader}>
              <span id="comments-drawer-title" className={styles.drawerTitle}>{t("comments")} ({commentsCount})</span>
              <button type="button" data-dialog-initial-focus className={styles.closeBtn} onClick={() => setCommentsOpen(false)} aria-label={common("close")}>
                &times;
              </button>
            </div>

            <div className={styles.commentsList}>
              {loadingComments ? (
                <div style={{ textAlign: "center", color: "var(--text-secondary)", padding: "20px" }}>
                  {t("commentsLoading")}
                </div>
              ) : comments.length > 0 ? (
                comments.map((comment) => {
                  const commentDateStr = new Date(comment.createdAt).toLocaleDateString(locale, {
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
                          title={t("deleteComment")}
                        >
                          🗑️
                        </button>
                      )}
                    </div>
                  );
                })
              ) : (
                <div style={{ textAlign: "center", color: "var(--text-muted)", padding: "40px 20px" }}>
                  {t("commentsEmpty")}
                </div>
              )}
              {hasMoreComments && (
                <button type="button" className={styles.actionBtn} onClick={() => fetchComments(commentsNextCursor, true)} disabled={loadingComments}>
                  Cargar más comentarios
                </button>
              )}
            </div>

            {/* Comment Form */}
            {currentUser ? (
              <form onSubmit={handlePostComment} className={styles.commentForm}>
                <textarea
                  className={styles.commentInput}
                  placeholder={t("writeComment")}
                  rows={2}
                  maxLength={300}
                  value={newCommentText}
                  onChange={(e) => setNewCommentText(e.target.value)}
                />
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>
                    {newCommentText.length}/300
                  </span>
                  <Button type="submit" variant="neon" size="compact" disabled={postingComment}>
                    {t("postComment")}
                  </Button>
                </div>
              </form>
            ) : (
              <div style={{ padding: "20px", borderTop: "1px solid var(--border)", textAlign: "center", background: "#08090d" }}>
                <Link href="/login" style={{ color: "var(--primary)", textDecoration: "none", fontSize: "0.9rem", fontWeight: 700 }}>
                  {t("loginToComment")}
                </Link>
              </div>
            )}
          </div>
        </AccessibleDialog>
      )}

      {/* Custom Comment Delete Confirm Modal Overlay */}
      {commentToDelete && (
        <AccessibleDialog
          isOpen={Boolean(commentToDelete)}
          onClose={() => setCommentToDelete(null)}
          labelledBy="delete-comment-dialog-title"
          role="alertdialog"
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
            <h4 id="delete-comment-dialog-title" style={{ fontSize: "1.1rem", fontWeight: 700, color: "var(--text-primary)", fontFamily: "var(--font-display)" }}>
              {t("deleteCommentTitle")}
            </h4>
            <p style={{ fontSize: "0.85rem", color: "var(--text-secondary)", lineHeight: 1.5 }}>
              {t("deleteCommentDescription")}
            </p>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "12px", marginTop: "8px" }}>
              <button
                type="button"
                data-dialog-initial-focus
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
                {common("cancel")}
              </button>
              <button
                type="button"
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
                {common("delete")}
              </button>
            </div>
          </div>
        </AccessibleDialog>
      )}

      {/* Custom Review Delete Confirm Modal Overlay */}
      {reviewToDelete && (
        <AccessibleDialog
          isOpen={Boolean(reviewToDelete)}
          onClose={() => setReviewToDelete(null)}
          labelledBy="delete-review-dialog-title"
          role="alertdialog"
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
            <h4 id="delete-review-dialog-title" style={{ fontSize: "1.1rem", fontWeight: 700, color: "var(--text-primary)", fontFamily: "var(--font-display)" }}>
              {t("deleteReviewTitle")}
            </h4>
            <p style={{ fontSize: "0.85rem", color: "var(--text-secondary)", lineHeight: 1.5 }}>
              {t("deleteReviewDescription")}
            </p>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "12px", marginTop: "8px" }}>
              <button
                type="button"
                data-dialog-initial-focus
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
                {common("cancel")}
              </button>
              <button
                type="button"
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
                {common("delete")}
              </button>
            </div>
          </div>
        </AccessibleDialog>
      )}

      {/* Custom Review Edit Modal Overlay */}
      {isEditing && (
        <AccessibleDialog isOpen={isEditing} onClose={() => setIsEditing(false)} labelledBy="edit-review-dialog-title" className={sharedStyles.modalOverlay}>
          <div className={sharedStyles.modalContent} style={{ maxWidth: "500px" }}>
            <div className={sharedStyles.modalHeader}>
              <h3 id="edit-review-dialog-title" className={sharedStyles.modalTitle}>{t("edit")}</h3>
              <button 
                type="button"
                data-dialog-initial-focus
                className={sharedStyles.closeBtn} 
                onClick={() => setIsEditing(false)}
                aria-label={t("closeModal")}
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
                <span className={sharedStyles.formLabel}>{t("yourRating")}:</span>
                <div style={{ display: "flex", alignItems: "center" }}>
                  <RatingStars value={editRating} onChange={setEditRating} interactive={true} size={28} label={t("yourRating")} disabled={savingEdit} />
                </div>
              </div>

              {/* Tags Section */}
              <div className={sharedStyles.formGroup}>
                <span className={sharedStyles.formLabel}>{t("tags")}:</span>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                  {CANONICAL_REVIEW_TAGS.map(tag => {
                    const isActive = editTags.includes(tag.key);
                    return (
                      <button
                      key={tag.key}
                        type="button"
                      aria-pressed={isActive}
                      onClick={() => toggleEditTag(tag.key)}
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
                        {t(tag.translationKey)}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Content Textarea */}
              <div className={sharedStyles.formGroup}>
                <label htmlFor={editContentId} className={sharedStyles.formLabel}>{t("yourReview")}:</label>
                <textarea
                  id={editContentId}
                  name="content"
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  placeholder={t("editContentPlaceholder")}
                  rows={5}
                  className={sharedStyles.formInput}
                  style={{ resize: "vertical", fontFamily: "inherit" }}
                  disabled={savingEdit}
                />
              </div>

              {/* Favorite Track */}
              <div className={sharedStyles.formGroup}>
                <label htmlFor={favoriteTrackId} className={sharedStyles.formLabel}>{t("favoriteTrack")} ({common("optional")}):</label>
                <select
                  id={favoriteTrackId}
                  value={editFavoriteTrack}
                  onChange={(e) => {
                    setEditFavoriteTrack(e.target.value);
                    setFavoriteTrackTouched(true);
                  }}
                  className={sharedStyles.formInput}
                  disabled={savingEdit || tracksLoading || tracklistUnavailable}
                  aria-describedby={tracklistUnavailable ? `${favoriteTrackId}-help` : undefined}
                >
                  <option value="">
                    {tracksLoading ? t("loadingTracks") : tracklistUnavailable ? t("tracklistUnavailable") : t("noFavoriteTrack")}
                  </option>
                  {editTracks?.map((track, index) => (
                    <option key={`${track}-${index}`} value={track}>{track}</option>
                  ))}
                </select>
                {tracklistUnavailable && <p id={`${favoriteTrackId}-help`} className={sharedStyles.formLabel}>{t("tracklistUnavailableHelp")}</p>}
              </div>

              {/* Modal Footer */}
              <div className={sharedStyles.modalFooter}>
                <Button
                  variant="secondary"
                  onClick={() => setIsEditing(false)}
                  disabled={savingEdit}
                >
                  {common("cancel")}
                </Button>
                <Button
                  type="submit"
                  isLoading={savingEdit}
                  loadingLabel={t("saving")}
                >
                  {t("saveChanges")}
                </Button>
              </div>
            </form>
          </div>
        </AccessibleDialog>
      )}
    </>
  );
})

export default ReviewCard;
