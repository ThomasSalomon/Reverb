"use client";

import { useTransition } from "react";
import { useLocale } from "next-intl";
import { useRouter, usePathname } from "@/i18n/routing";
import styles from "./LanguageSelector.module.css";

export default function LanguageSelector() {
  const [isPending, startTransition] = useTransition();
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();

  const handleLanguageChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const nextLocale = e.target.value;
    startTransition(() => {
      // Replaces the current path with the new locale
      router.replace(pathname, { locale: nextLocale });
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
        aria-label="Seleccionar idioma"
      >
        <option value="es">Español</option>
        <option value="en">English</option>
        <option value="pt">Português</option>
      </select>

      {/* Selector para Móviles (Abreviado) */}
      <select 
        value={locale} 
        onChange={handleLanguageChange} 
        disabled={isPending}
        className={`${styles.select} ${styles.mobileSelect}`}
        aria-label="Seleccionar idioma"
      >
        <option value="es">ES</option>
        <option value="en">EN</option>
        <option value="pt">PT</option>
      </select>
    </div>
  );
}
