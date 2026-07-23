"use client";

import { useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter, usePathname } from "@/i18n/routing";
import { useSearchParams } from "next/navigation";
import styles from "./LanguageSelector.module.css";

export default function LanguageSelector() {
  const [isPending, startTransition] = useTransition();
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const t = useTranslations("Language");

  const handleLanguageChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const nextLocale = e.target.value;
    startTransition(() => {
      const query = searchParams.toString();
      router.replace(query ? `${pathname}?${query}` : pathname, { locale: nextLocale });
    });
  };

  return (
    <div className={styles.container}>
      {/* Selector para Escritorio */}
      <select 
        value={locale} 
        onChange={handleLanguageChange} 
        disabled={isPending}
        className={`${styles.select} ${styles.desktopSelect}`}
        aria-label={t("label")}
      >
        <option value="es">{t("spanish")}</option>
        <option value="en">{t("english")}</option>
        <option value="pt">{t("portuguese")}</option>
      </select>

      {/* Selector para Móviles (Abreviado) */}
      <select 
        value={locale} 
        onChange={handleLanguageChange} 
        disabled={isPending}
        className={`${styles.select} ${styles.mobileSelect}`}
        aria-label={t("label")}
      >
        <option value="es">ES</option>
        <option value="en">EN</option>
        <option value="pt">PT</option>
      </select>
    </div>
  );
}
