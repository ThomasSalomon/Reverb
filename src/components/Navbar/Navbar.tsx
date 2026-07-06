"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import styles from "./Navbar.module.css";
import Avatar from "@/components/Avatar/Avatar";
import NotificationsDropdown from "@/components/NotificationsDropdown/NotificationsDropdown";

interface User {
  id: string;
  username: string;
  profileColor?: string | null;
  profileImage?: string | null;
}

export default function Navbar() {
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    async function checkUser() {
      try {
        const res = await fetch("/api/auth/me");
        const data = await res.json();
        if (data.user) {
          setUser(data.user);
        }
      } catch (e) {
        console.error("Check user error:", e);
      }
    }
    checkUser();
  }, []);

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      setUser(null);
      window.location.reload();
    } catch (e) {
      console.error("Logout error:", e);
    }
  };

  return (
    <nav className={styles.navbar}>
      <div className={styles.container}>
        <Link href="/" className={styles.logo}>
          <img src="/logo.png" alt="Reverb Logo" className={styles.logoIcon} />
          Re<span>verb</span>
        </Link>

        <div className={styles.links}>
          <Link href="/explore" className={styles.link}>
            Explorar
          </Link>
        </div>

        <div className={styles.auth}>
          {user ? (
            <div className={styles.userSection} style={{ display: "flex", alignItems: "center", gap: "16px" }}>
              <NotificationsDropdown />
              <Link href={`/users/${user.username}`} className={styles.profileLink}>
                <Avatar
                  username={user.username}
                  profileColor={user.profileColor}
                  profileImage={user.profileImage}
                  size={30}
                  className={styles.miniAvatar}
                  style={{ border: "none", display: "inline-flex" }}
                />
                <span className={styles.username}>@{user.username}</span>
              </Link>
              <button onClick={handleLogout} className={styles.logoutBtn}>
                Salir
              </button>
            </div>
          ) : (
            <div className={styles.authButtons}>
              <Link href="/login" className={styles.loginLink}>
                Entrar
              </Link>
              <Link
                href="/register"
                className={`neon-btn ${styles.registerBtn}`}
              >
                Crear Cuenta
              </Link>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}
