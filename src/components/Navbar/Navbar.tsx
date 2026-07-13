"use client";

import { useEffect, useState, useRef } from "react";
import { Link } from "@/i18n/routing";
import { useTranslations } from "next-intl";
import styles from "./Navbar.module.css";
import Avatar from "@/components/Avatar/Avatar";
import NotificationsDropdown from "@/components/NotificationsDropdown/NotificationsDropdown";
import LanguageSelector from "@/components/LanguageSelector/LanguageSelector";

interface User {
  id: string;
  username: string;
  profileColor?: string | null;
  profileImage?: string | null;
}

export default function Navbar() {
  const t = useTranslations("Navbar");
  const [user, setUser] = useState<User | null>(null);
  const [isVisible, setIsVisible] = useState(true);
  const lastScrollY = useRef(0);

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

  useEffect(() => {
    // Set initial scroll position
    lastScrollY.current = window.scrollY;

    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      
      // If we scroll down past 50px, hide the navbar
      if (currentScrollY > lastScrollY.current && currentScrollY > 50) {
        setIsVisible(false);
      } 
      // If we scroll up, show the navbar
      else if (currentScrollY < lastScrollY.current) {
        setIsVisible(true);
      }
      
      lastScrollY.current = currentScrollY;
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
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
    <>
      <nav className={`${styles.navbar} ${isVisible ? "" : styles.navbarHidden}`}>
        <div className={styles.container}>
          <Link href="/" className={styles.logo}>
            <img src="/logo.png" alt="RTM Logo" className={styles.logoIcon} />
            <span>Ride The <span className={styles.highlight}>Music</span></span>
          </Link>

          <div className={styles.links}>
            <Link href="/explore" className={styles.link}>
              {t('explore')}
            </Link>
          </div>

          <div className={styles.auth}>
            {user ? (
              <div className={styles.userSection} style={{ display: "flex", alignItems: "center", gap: "16px" }}>
                <LanguageSelector />
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
                  {t('logout')}
                </button>
              </div>
            ) : (
              <div className={styles.authButtons}>
                <LanguageSelector />
                <Link href="/login" className={styles.loginLink}>
                  {t('login')}
                </Link>
                <Link
                  href="/register"
                  className={`neon-btn ${styles.registerBtn}`}
                >
                  {t('register')}
                </Link>
              </div>
            )}
          </div>
        </div>
      </nav>
      {/* Spacer to compensate for fixed navbar height */}
      <div style={{ height: "70px", flexShrink: 0 }} />
    </>
  );
}
