"use client";

import { useRef, useState } from "react";
import { Link, useRouter } from "@/i18n/routing";
import { useTranslations } from "next-intl";
import styles from "../login/page.module.css";

type RegisterField = "username" | "email" | "password";

export default function RegisterPage() {
  const router = useRouter();
  const t = useTranslations("Auth");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<RegisterField, string>>>({});
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const usernameRef = useRef<HTMLInputElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);

  const clearFieldError = (field: RegisterField) => {
    if (fieldErrors[field]) setFieldErrors((current) => ({ ...current, [field]: undefined }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const nextErrors: Partial<Record<RegisterField, string>> = {};
    if (!username.trim()) nextErrors.username = t("usernameRequired");
    else if (username.length < 3) nextErrors.username = t("usernameMin");
    if (!email.trim()) nextErrors.email = t("emailRequired");
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) nextErrors.email = t("emailInvalid");
    if (!password) nextErrors.password = t("passwordRequired");
    else if (password.length < 6) nextErrors.password = t("passwordMin");

    if (Object.keys(nextErrors).length > 0) {
      setFieldErrors(nextErrors);
      setError(null);
      requestAnimationFrame(() => {
        if (nextErrors.username) usernameRef.current?.focus();
        else if (nextErrors.email) emailRef.current?.focus();
        else passwordRef.current?.focus();
      });
      return;
    }

    setLoading(true);
    setError(null);
    setFieldErrors({});

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, email, password }),
      });

      if (!res.ok) {
        setError(t("registerFailed"));
        return;
      }

      router.push("/");
      router.refresh();
    } catch {
      setError(t("registerFailed"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className={styles.main}>
      <div className={`${styles.authCard} glass`}>
        <h2 className={styles.title}>{t("registerTitle")}</h2>
        <p className={styles.subtitle}>{t("registerSubtitle")}</p>

        <form onSubmit={handleSubmit} className={styles.form} noValidate>
          <div className={styles.inputGroup}>
            <label className={styles.label} htmlFor="register-username">{t("username")}</label>
            <input ref={usernameRef} id="register-username" name="username" type="text" autoComplete="username" autoCapitalize="none" spellCheck={false} required minLength={3} value={username} onChange={(e) => { setUsername(e.target.value); clearFieldError("username"); }} placeholder={t("usernamePlaceholder")} className="input-field" disabled={loading} aria-invalid={Boolean(fieldErrors.username)} aria-describedby={fieldErrors.username ? "register-username-error" : undefined} />
            {fieldErrors.username && <p id="register-username-error" className={styles.fieldError}>{fieldErrors.username}</p>}
          </div>

          <div className={styles.inputGroup}>
            <label className={styles.label} htmlFor="register-email">{t("email")}</label>
            <input ref={emailRef} id="register-email" name="email" type="email" inputMode="email" autoComplete="email" autoCapitalize="none" spellCheck={false} required value={email} onChange={(e) => { setEmail(e.target.value); clearFieldError("email"); }} placeholder={t("emailPlaceholder")} className="input-field" disabled={loading} aria-invalid={Boolean(fieldErrors.email)} aria-describedby={fieldErrors.email ? "register-email-error" : undefined} />
            {fieldErrors.email && <p id="register-email-error" className={styles.fieldError}>{fieldErrors.email}</p>}
          </div>

          <div className={styles.inputGroup}>
            <label className={styles.label} htmlFor="register-password">{t("password")}</label>
            <input ref={passwordRef} id="register-password" name="password" type="password" autoComplete="new-password" required minLength={6} value={password} onChange={(e) => { setPassword(e.target.value); clearFieldError("password"); }} placeholder={t("passwordPlaceholder")} className="input-field" disabled={loading} aria-invalid={Boolean(fieldErrors.password)} aria-describedby={fieldErrors.password ? "register-password-error" : undefined} />
            {fieldErrors.password && <p id="register-password-error" className={styles.fieldError}>{fieldErrors.password}</p>}
          </div>

          {error && <div className={styles.errorMsg} role="alert">{error}</div>}

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
