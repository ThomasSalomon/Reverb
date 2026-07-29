"use client";

import { useRef, useState } from "react";
import { Link, useRouter } from "@/i18n/routing";
import { useTranslations } from "next-intl";
import styles from "./page.module.css";

export default function LoginPage() {
  const router = useRouter();
  const t = useTranslations("Auth");
  const [usernameOrEmail, setUsernameOrEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState<{ usernameOrEmail?: string; password?: string }>({});
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const identifierRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const nextErrors: typeof fieldErrors = {};
    if (!usernameOrEmail.trim()) nextErrors.usernameOrEmail = t("usernameOrEmailRequired");
    if (!password) nextErrors.password = t("passwordRequired");

    if (Object.keys(nextErrors).length > 0) {
      setFieldErrors(nextErrors);
      setError(null);
      requestAnimationFrame(() => (nextErrors.usernameOrEmail ? identifierRef.current : passwordRef.current)?.focus());
      return;
    }

    setLoading(true);
    setError(null);
    setFieldErrors({});

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ usernameOrEmail, password }),
      });

      if (!res.ok) {
        setError(t("loginFailed"));
        return;
      }

      router.push("/");
      router.refresh();
    } catch {
      setError(t("loginFailed"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className={styles.main}>
      <div className={`${styles.authCard} glass`}>
        <h2 className={styles.title}>{t("loginTitle")}</h2>
        <p className={styles.subtitle}>{t("loginSubtitle")}</p>

        <form onSubmit={handleSubmit} className={styles.form} noValidate>
          <div className={styles.inputGroup}>
            <label className={styles.label} htmlFor="login-identifier">{t("usernameOrEmail")}</label>
            <input
              ref={identifierRef}
              id="login-identifier"
              name="username"
              type="text"
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
              required
              value={usernameOrEmail}
              onChange={(e) => {
                setUsernameOrEmail(e.target.value);
                if (fieldErrors.usernameOrEmail) setFieldErrors((current) => ({ ...current, usernameOrEmail: undefined }));
              }}
              placeholder={t("emailPlaceholder")}
              className="input-field"
              disabled={loading}
              aria-invalid={Boolean(fieldErrors.usernameOrEmail)}
              aria-describedby={fieldErrors.usernameOrEmail ? "login-identifier-error" : undefined}
            />
            {fieldErrors.usernameOrEmail && <p id="login-identifier-error" className={styles.fieldError}>{fieldErrors.usernameOrEmail}</p>}
          </div>

          <div className={styles.inputGroup}>
            <label className={styles.label} htmlFor="login-password">{t("password")}</label>
            <input
              ref={passwordRef}
              id="login-password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (fieldErrors.password) setFieldErrors((current) => ({ ...current, password: undefined }));
              }}
              placeholder="••••••••"
              className="input-field"
              disabled={loading}
              aria-invalid={Boolean(fieldErrors.password)}
              aria-describedby={fieldErrors.password ? "login-password-error" : undefined}
            />
            {fieldErrors.password && <p id="login-password-error" className={styles.fieldError}>{fieldErrors.password}</p>}
          </div>

          {error && <div className={styles.errorMsg} role="alert">{error}</div>}

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
