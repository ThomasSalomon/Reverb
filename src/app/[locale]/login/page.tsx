"use client";

import { useState } from "react";
import { Link, useRouter } from "@/i18n/routing";
import { useTranslations } from "next-intl";
import styles from "./page.module.css";

export default function LoginPage() {
  const router = useRouter();
  const t = useTranslations("Auth");
  const [usernameOrEmail, setUsernameOrEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!usernameOrEmail || !password) {
      setError(t("allFieldsRequired"));
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ usernameOrEmail, password }),
      });

      if (!res.ok) {
        throw new Error(t("loginFailed"));
      }

      router.push("/");
      router.refresh();
    } catch (e: any) {
      setError(e.message || t("loginFailed"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className={styles.main}>
      <div className={`${styles.authCard} glass`}>
        <h2 className={styles.title}>{t("loginTitle")}</h2>
        <p className={styles.subtitle}>{t("loginSubtitle")}</p>

        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.inputGroup}>
            <label className={styles.label}>{t("usernameOrEmail")}</label>
            <input
              type="text"
              value={usernameOrEmail}
              onChange={(e) => setUsernameOrEmail(e.target.value)}
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
              placeholder="••••••••"
              className="input-field"
              disabled={loading}
            />
          </div>

          {error && <div className={styles.errorMsg}>{error}</div>}

          <button type="submit" className="neon-btn" disabled={loading}>
            {loading ? t("loggingIn") : t("login")}
          </button>
        </form>

        <p className={styles.footerText}>
          {t("noAccount")} <Link href="/register">{t("createFree")}</Link>
        </p>
      </div>
    </main>
  );
}
