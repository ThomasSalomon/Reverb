"use client";

import { useState } from "react";
import { Link, useRouter } from "@/i18n/routing";
import { useTranslations } from "next-intl";
import styles from "../login/page.module.css";

export default function RegisterPage() {
  const router = useRouter();
  const t = useTranslations("Auth");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !email || !password) {
      setError(t("allFieldsRequired"));
      return;
    }

    if (username.length < 3) {
      setError(t("usernameMin"));
      return;
    }

    if (password.length < 6) {
      setError(t("passwordMin"));
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, email, password }),
      });

      if (!res.ok) {
        throw new Error(t("registerFailed"));
      }

      router.push("/");
      router.refresh();
    } catch (e: any) {
      setError(e.message || t("registerFailed"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className={styles.main}>
      <div className={`${styles.authCard} glass`}>
        <h2 className={styles.title}>{t("registerTitle")}</h2>
        <p className={styles.subtitle}>{t("registerSubtitle")}</p>

        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.inputGroup}>
            <label className={styles.label}>{t("username")}</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder={t("usernamePlaceholder")}
              className="input-field"
              disabled={loading}
            />
          </div>

          <div className={styles.inputGroup}>
            <label className={styles.label}>{t("email")}</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t("emailPlaceholder")}
              className="input-field"
              disabled={loading}
            />
          </div>

          <div className={styles.inputGroup}>
            <label className={styles.label}>{t("password")}</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={t("passwordPlaceholder")}
              className="input-field"
              disabled={loading}
            />
          </div>

          {error && <div className={styles.errorMsg}>{error}</div>}

          <button type="submit" className="neon-btn" disabled={loading}>
            {loading ? t("registering") : t("register")}
          </button>
        </form>

        <p className={styles.footerText}>
          {t("hasAccount")} <Link href="/login">{t("signIn")}</Link>
        </p>
      </div>
    </main>
  );
}
