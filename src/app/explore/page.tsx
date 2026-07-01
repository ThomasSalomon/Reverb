"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import styles from "./page.module.css";
import Avatar from "@/components/Avatar/Avatar";
import { useDebounce } from "@/hooks/useDebounce"; // Ensure this exists or I will just write inline timeout

export default function ExplorePage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [isSearching, setIsSearching] = useState(false);

  // Simple debounce logic
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchUsers(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const fetchUsers = async (query: string) => {
    try {
      setLoading(true);
      const res = await fetch(`/api/users/search?q=${encodeURIComponent(query)}`);
      if (res.ok) {
        const data = await res.json();
        setUsers(data);
      }
      setIsSearching(query.trim().length > 0);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main>
      <div className={styles.container}>
        <div className={styles.header}>
          <h1 className={styles.title}>Explorar</h1>
          <p className={styles.subtitle}>Encuentra nuevos usuarios y descubre más música.</p>
        </div>

        <div className={styles.searchSection}>
          <input
            type="text"
            placeholder="Buscar usuarios por nombre..."
            className={styles.searchInput}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div>
          <h2 className={styles.sectionTitle}>
            {isSearching ? "Resultados de búsqueda" : "Usuarios Populares"}
          </h2>
          
          {loading ? (
            <div className="loader" style={{ margin: "40px auto" }}>Cargando...</div>
          ) : users.length === 0 ? (
            <div style={{ color: "var(--text-secondary)", marginTop: "20px" }}>No se encontraron usuarios.</div>
          ) : (
            <div className={styles.usersGrid}>
              {users.map((user) => (
                <Link href={`/users/${user.username}`} key={user.id} className={styles.userCard}>
                  <Avatar
                    username={user.username}
                    profileColor={user.profileColor}
                    profileImage={user.profileImage}
                    size={80}
                    style={{ border: "4px solid var(--surface-light)", boxShadow: "0 4px 10px rgba(0,0,0,0.3)" }}
                  />
                  <h3 className={styles.username}>@{user.username}</h3>
                  <div className={styles.userStats}>
                    <div className={styles.stat}>
                      <span className={styles.statValue}>{user._count?.followers || 0}</span>
                      <span>Seguidores</span>
                    </div>
                    <div className={styles.stat}>
                      <span className={styles.statValue}>{user._count?.reviews || 0}</span>
                      <span>Reseñas</span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
