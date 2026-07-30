"use client";

import { useEffect, useState } from "react";
import { Link, usePathname } from "@/i18n/routing";
import { useTranslations } from "next-intl";
import styles from "./BottomNav.module.css";
import Avatar from "@/components/Avatar/Avatar";

interface User {
  id: string;
  username: string;
  profileColor?: string | null;
  profileImage?: string | null;
}

export default function BottomNav({ initialUser }: { initialUser: User | null }) {
  const t = useTranslations("Navbar");
  const pathname = usePathname();
  const [user, setUser] = useState<User | null>(initialUser);
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

  const isActive = (path: string) => pathname === path || pathname.startsWith(path + '/');
  const isHomeActive = pathname === '/';

  return (
    <nav className={styles.bottomNav}>
      <Link href="/" className={`${styles.navItem} ${isHomeActive ? styles.active : ''}`}>
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
          <polyline points="9 22 9 12 15 12 15 22"/>
        </svg>
        <span>{t('home')}</span>
      </Link>
      
      <Link href="/explore" className={`${styles.navItem} ${isActive('/explore') ? styles.active : ''}`}>
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="8"/>
          <path d="m21 21-4.3-4.3"/>
        </svg>
        <span>{t('explore')}</span>
      </Link>

      {displayedUser ? (
        <Link href={`/users/${displayedUser.username}`} className={`${styles.navItem} ${isActive(`/users/${displayedUser.username}`) ? styles.active : ''}`}>
          <Avatar
            username={displayedUser.username}
            profileColor={displayedUser.profileColor}
            profileImage={displayedUser.profileImage}
            size={24}
            className={styles.miniAvatar}
            style={{ border: "none" }}
          />
          <span>{t('profile')}</span>
        </Link>
      ) : (
        <Link href="/login" className={`${styles.navItem} ${isActive('/login') ? styles.active : ''}`}>
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/>
            <circle cx="12" cy="7" r="4"/>
          </svg>
          <span>{t('login')}</span>
        </Link>
      )}
    </nav>
  );
}
