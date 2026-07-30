"use client";

import { useEffect, useState, useRef } from "react";
import { Link, useRouter } from "@/i18n/routing";
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

export default function Navbar({ initialUser }: { initialUser: User | null }) {
  const t = useTranslations("Navbar");
  const router = useRouter();
  const [user, setUser] = useState<User | null>(initialUser);
  const [isVisible, setIsVisible] = useState(true);
  const lastScrollY = useRef(0);
  const displayedUser = user?.id === initialUser?.id ? user : initialUser;

  useEffect(() => {
    async function checkUser() {
      try {
        const res = await fetch("/api/auth/me", { cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json();
        setUser(data.user ?? null);
      } catch (e) {
        console.error("Check user error:", e);
      }
    }
    checkUser();
  }, [initialUser?.id]);

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
      const res = await fetch("/api/auth/logout", { method: "POST" });
      if (!res.ok) return;
      setUser(null);
      router.refresh();
    } catch (e) {
      console.error("Logout error:", e);
    }
  };

  return (
    <>
      <nav className={`${styles.navbar} ${isVisible ? "" : styles.navbarHidden}`}>
        <div className={styles.container}>
          <Link href="/" className={styles.logo}>
            <img src="/logo.png" alt={t("logoAlt")} className={styles.logoIcon} />
            <span>Ride The <span className={styles.highlight}>Music</span></span>
          </Link>

          <div className={styles.links}>
            <Link href="/explore" className={styles.link}>
              {t('explore')}
            </Link>
          </div>

          <div className={styles.auth}>
            {displayedUser ? (
              <div className={styles.userSection} style={{ display: "flex", alignItems: "center", gap: "16px" }}>
                <LanguageSelector />
                <NotificationsDropdown />
                <Link href={`/users/${displayedUser.username}`} className={styles.profileLink}>
                  <Avatar
                    username={displayedUser.username}
                    profileColor={displayedUser.profileColor}
                    profileImage={displayedUser.profileImage}
                    size={30}
                    className={styles.miniAvatar}
                    style={{ border: "none", display: "inline-flex" }}
                  />
                  <span className={styles.username}>@{displayedUser.username}</span>
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
