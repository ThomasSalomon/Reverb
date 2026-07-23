"use client";

import React, { useState, useEffect, useRef } from "react";
import { Link } from "@/i18n/routing";
import { useTranslations } from "next-intl";
import styles from "./NotificationsDropdown.module.css";
import Avatar from "@/components/Avatar/Avatar";

function timeAgo(dateString: string, t: ReturnType<typeof useTranslations>): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffInSeconds < 10) return t("justNow");
  if (diffInSeconds < 60) return t("secondsAgo", {count: diffInSeconds});
  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60) return t("minutesAgo", {count: diffInMinutes});
  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) return t("hoursAgo", {count: diffInHours});
  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays < 30) return t("daysAgo", {count: diffInDays});
  const diffInMonths = Math.floor(diffInDays / 30);
  return t("monthsAgo", {count: diffInMonths});
}

interface Notification {
  id: string;
  type: string;
  message: string;
  isRead: boolean;
  createdAt: string;
  link?: string;
  sourceUser?: {
    username: string;
    profileImage: string | null;
    profileColor: string | null;
  } | null;
}

function notificationMessage(notification: Notification, t: ReturnType<typeof useTranslations>) {
  const actor = notification.sourceUser?.username;
  if (notification.type === "NEW_FOLLOWER") return actor ? t("newFollower", { actor }) : notification.message;
  if (notification.type === "NEW_LIKE") return actor ? t("newLike", { actor }) : notification.message;
  if (notification.type === "NEW_COMMENT") return actor ? t("newComment", { actor }) : notification.message;
  if (notification.type === "NEW_BADGE") return t("newBadge");
  return t("unknown");
}

export default function NotificationsDropdown() {
  const t = useTranslations("Notifications");
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);



  useEffect(() => {
    fetchNotifications();

    // Check for new notifications every minute
    const interval = setInterval(fetchNotifications, 60000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    // Close dropdown on outside click
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const fetchNotifications = async () => {
    try {
      setError(false);
      const res = await fetch("/api/notifications");
      if (res.ok) {
        const data = await res.json();
        setNotifications(data.notifications || []);
        setUnreadCount(data.unreadCount || 0);
      } else setError(true);
    } catch (e) {
      console.error("Failed to fetch notifications", e);
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = async (id: string, currentReadStatus: boolean) => {
    if (currentReadStatus) return; // already read
    
    try {
      await fetch(`/api/notifications/${id}/read`, { method: "PUT" });
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n));
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (e) {
      console.error("Failed to mark as read", e);
    }
  };

  const markAllAsRead = async () => {
    try {
      await fetch("/api/notifications/all/read", { method: "PUT" });
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
      setUnreadCount(0);
    } catch (e) {
      console.error("Failed to mark all as read", e);
    }
  };

  const clearAllNotifications = async () => {
    try {
      await fetch("/api/notifications", { method: "DELETE" });
      setNotifications([]);
      setUnreadCount(0);
    } catch (e) {
      console.error("Failed to clear notifications", e);
    }
  };

  const toggleDropdown = () => {
    setIsOpen(!isOpen);
    if (!isOpen && unreadCount > 0) {
      // Opt: Mark all as read when opened or leave it manual?
      // I'll leave it manual so they can click individual ones
    }
  };

  return (
    <div className={styles.container} ref={dropdownRef}>
      <button className={styles.bellBtn} onClick={toggleDropdown} title={t("bellLabel")} aria-label={t("bellLabel")}>
        🔔
        {unreadCount > 0 && (
          <span className={styles.badge}>{unreadCount > 9 ? "9+" : unreadCount}</span>
        )}
      </button>

      {isOpen && (
        <div className={styles.dropdown}>
          <div className={styles.header}>
            <h3 className={styles.title}>{t("title")}</h3>
            <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
              {unreadCount > 0 && (
                <button onClick={markAllAsRead} className={styles.markAllBtn}>
                  {t("markAllRead")}
                </button>
              )}
              {notifications.length > 0 && (
                <button 
                  onClick={clearAllNotifications} 
                  className={styles.markAllBtn} 
                  style={{ color: "var(--text-secondary)", background: "transparent", padding: "0", fontWeight: "normal" }}
                >
                  {t("clearAll")}
                </button>
              )}
            </div>
          </div>

          <ul className={styles.list}>
            {loading ? <li className={styles.emptyState}>{t("loading")}</li> : error ? <li className={styles.emptyState} role="alert">{t("error")}</li> : notifications.length === 0 ? (
              <li className={styles.emptyState}>{t("empty")}</li>
            ) : (
              notifications.map((n) => {
                const innerContent = (
                  <>
                    {n.sourceUser && (
                      <div className={styles.iconWrap}>
                        <Avatar
                          username={n.sourceUser.username}
                          profileColor={n.sourceUser.profileColor}
                          profileImage={n.sourceUser.profileImage}
                          size={32}
                          style={{ border: "none" }}
                        />
                      </div>
                    )}
                    <div className={styles.content}>
                      <p className={styles.message}>{notificationMessage(n, t)}</p>
                      <p className={styles.time}>
                        {timeAgo(n.createdAt, t)}
                      </p>
                    </div>
                    {!n.isRead && <div className={styles.dot}></div>}
                  </>
                );

                return (
                  <li key={n.id}>
                    {n.link ? (
                      <Link
                        href={n.link}
                        className={`${styles.notificationItem} ${!n.isRead ? styles.unread : ""}`}
                        onClick={() => markAsRead(n.id, n.isRead)}
                      >
                        {innerContent}
                      </Link>
                    ) : (
                      <div
                        className={`${styles.notificationItem} ${!n.isRead ? styles.unread : ""}`}
                        onClick={() => markAsRead(n.id, n.isRead)}
                        style={{ cursor: "pointer" }}
                      >
                        {innerContent}
                      </div>
                    )}
                  </li>
                );
              })
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
