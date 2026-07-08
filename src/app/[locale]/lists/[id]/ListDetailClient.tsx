"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import styles from "./page.module.css";
import { useTranslations } from "next-intl";

interface ListData {
  id: string;
  title: string;
  description: string | null;
  isPublic: boolean;
  createdAt: string;
  user: {
    username: string;
    profileColor: string | null;
  };
  items: Array<{
    id: string;
    order: number;
    musicItemId: string;
    musicItem: {
      id: string;
      title: string;
      artist: string;
      coverUrl: string;
    };
  }>;
}

export default function ListDetailClient({ id }: { id: string }) {
  const [list, setList] = useState<ListData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const t = useTranslations("Navigation");

  useEffect(() => {
    async function fetchList() {
      try {
        const res = await fetch(`/api/lists/${id}`, { cache: "no-store" });
        if (!res.ok) {
          if (res.status === 404 || res.status === 403) {
            throw new Error("La lista no existe o es privada.");
          }
          throw new Error("Error al cargar la lista");
        }
        const data = await res.json();
        setList(data);
      } catch (e: any) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    }
    fetchList();
  }, [id]);

  if (loading) {
    return <div className={styles.loading}>Cargando lista...</div>;
  }

  if (error || !list) {
    return (
      <div className={styles.container}>
        <div className={styles.emptyState}>
          <h3>Oops</h3>
          <p>{error || "No se pudo encontrar la lista."}</p>
          <Link href="/explore" className="neon-btn" style={{ marginTop: "20px", display: "inline-block" }}>
            Volver a explorar
          </Link>
        </div>
      </div>
    );
  }

  // Sort items by order (if not already sorted by DB)
  const sortedItems = [...list.items].sort((a, b) => a.order - b.order);

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.title}>{list.title}</h1>
        {list.description && <p className={styles.description}>{list.description}</p>}
        
        <div className={styles.meta}>
          <span>Por</span>
          <Link href={`/users/${list.user.username}`} className={styles.author}>
            <div className={styles.avatar} style={{ backgroundColor: list.user.profileColor || "var(--primary)" }}>
              {list.user.username.charAt(0).toUpperCase()}
            </div>
            @{list.user.username}
          </Link>
          <span>•</span>
          <span>{list.items.length} álbumes</span>
          <span>•</span>
          <span>{new Date(list.createdAt).toLocaleDateString()}</span>
        </div>
      </div>

      {sortedItems.length > 0 ? (
        <div className={styles.grid}>
          {sortedItems.map((item, index) => (
            <Link key={item.id} href={`/albums/${item.musicItemId}`} className={styles.card}>
              <div className={styles.coverWrapper}>
                <div className={styles.orderBadge}>{index + 1}</div>
                <img
                  src={item.musicItem.coverUrl}
                  alt={item.musicItem.title}
                  className={styles.cover}
                  loading="lazy"
                />
              </div>
              <div className={styles.info}>
                <h3 className={styles.titleWrapper} title={item.musicItem.title}>
                  {item.musicItem.title}
                </h3>
                <p className={styles.artist} title={item.musicItem.artist}>
                  {item.musicItem.artist}
                </p>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className={styles.emptyState}>
          <p>Esta lista está vacía.</p>
        </div>
      )}
    </div>
  );
}
