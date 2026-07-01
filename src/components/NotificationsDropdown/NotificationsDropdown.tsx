"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import styles from "./NotificationsDropdown.module.css";
import Avatar from "@/components/Avatar/Avatar";

function timeAgo(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffInSeconds < 60) return `Hace ${diffInSeconds} segundos`;
  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60) return `Hace ${diffInMinutes} minuto${diffInMinutes > 1 ? 's' : ''}`;
  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) return `Hace ${diffInHours} hora${diffInHours > 1 ? 's' : ''}`;
  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays < 30) return `Hace ${diffInDays} día${diffInDays > 1 ? 's' : ''}`;
  const diffInMonths = Math.floor(diffInDays / 30);
  return `Hace ${diffInMonths} mes${diffInMonths > 1 ? 'es' : ''}`;
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

export default function NotificationsDropdown() {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
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
      const res = await fetch("/api/notifications");
      if (res.ok) {
        const data = await res.json();
        setNotifications(data.notifications || []);
        setUnreadCount(data.unreadCount || 0);
      }
    } catch (e) {
      console.error("Failed to fetch notifications", e);
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

  const toggleDropdown = () => {
    setIsOpen(!isOpen);
    if (!isOpen && unreadCount > 0) {
      // Opt: Mark all as read when opened or leave it manual?
      // I'll leave it manual so they can click individual ones
    }
  };

  return (
    <div className={styles.container} ref={dropdownRef}>
      <button className={styles.bellBtn} onClick={toggleDropdown} title="Notificaciones">
        🔔
        {unreadCount > 0 && (
          <span className={styles.badge}>{unreadCount > 9 ? "9+" : unreadCount}</span>
        )}
      </button>

      {isOpen && (
        <div className={styles.dropdown}>
          <div className={styles.header}>
            <h3 className={styles.title}>Notificaciones</h3>
            {unreadCount > 0 && (
              <button onClick={markAllAsRead} className={styles.markAllBtn}>
                Marcar todas leídas
              </button>
            )}
          </div>

          <ul className={styles.list}>
            {notifications.length === 0 ? (
              <li className={styles.emptyState}>No tienes notificaciones</li>
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
                      <p className={styles.message}>{n.message}</p>
                      <p className={styles.time}>
                        {timeAgo(n.createdAt)}
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
