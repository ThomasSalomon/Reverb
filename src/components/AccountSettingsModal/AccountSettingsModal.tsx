"use client";

import React, { useState } from "react";
import styles from "../SharedModal.module.css";
import { showToast } from "@/components/Toast/ToastListener";
import { useRouter } from "@/i18n/routing";
import { useTranslations } from "next-intl";
import { useBodyScrollLock } from "@/hooks/useBodyScrollLock";

interface AccountSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  username: string;
}

export default function AccountSettingsModal({ isOpen, onClose, username }: AccountSettingsModalProps) {
  const router = useRouter();
  const t = useTranslations("Profile");
  const common = useTranslations("Common");
  const [activeTab, setActiveTab] = useState<"password" | "delete">("password");
  
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  useBodyScrollLock(isOpen);

  if (!isOpen) return null;

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 6) {
      showToast(t("passwordMin"), "error");
      return;
    }
    
    setIsSaving(true);
    try {
      const res = await fetch(`/api/users/${username}/password`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      
      const data = await res.json();
      if (res.ok) {
        showToast(t("passwordUpdated"), "success");
        setCurrentPassword("");
        setNewPassword("");
      } else {
        showToast(t("passwordUpdateError"), "error");
      }
    } catch (e) {
      console.error(e);
      showToast(common("connectionError"), "error");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteAccount = async () => {
    const confirmDelete = window.confirm(t("deleteAccountConfirm"));
    if (!confirmDelete) return;

    setIsSaving(true);
    try {
      const res = await fetch(`/api/users/${username}`, {
        method: "DELETE",
      });
      
      const data = await res.json();
      if (res.ok) {
        showToast(t("accountDeleted"), "success");
        // Logout user
        await fetch("/api/auth/logout", { method: "POST" });
        router.push("/");
      } else {
        showToast(t("accountDeleteError"), "error");
      }
    } catch (e) {
      console.error(e);
      showToast(common("connectionError"), "error");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h2 className={styles.modalTitle}>{t("accountSettingsTitle")}</h2>
          <button className={styles.closeBtn} onClick={onClose} aria-label={common("close")}>&times;</button>
        </div>

        <div className={styles.tabsContainer}>
          <button
            onClick={() => setActiveTab("password")}
            className={`${styles.tabBtn} ${activeTab === "password" ? styles.tabBtnActive : ""}`}
          >
            {t("password")}
          </button>
          <button
            onClick={() => setActiveTab("delete")}
            className={`${styles.tabBtn} ${styles.tabBtnDanger} ${activeTab === "delete" ? styles.tabBtnActive : ""}`}
          >
            {t("deleteAccount")}
          </button>
        </div>

        {activeTab === "password" && (
          <form className={styles.formContainer} onSubmit={handleChangePassword}>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>{t("currentPassword")}</label>
              <input
                type="password"
                className={styles.formInput}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                required
              />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>{t("newPassword")}</label>
              <input
                type="password"
                className={styles.formInput}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                minLength={6}
              />
            </div>
            <div className={styles.modalFooter}>
              <button type="button" className={styles.cancelBtn} onClick={onClose}>{common("cancel")}</button>
              <button type="submit" className={styles.saveBtn} disabled={isSaving}>
                {isSaving ? t("changingPassword") : t("changePassword")}
              </button>
            </div>
          </form>
        )}

        {activeTab === "delete" && (
          <div className={styles.formContainer}>
            <p className={styles.warningText}>
              {t("deleteAccountWarning")}
            </p>
            <div className={styles.modalFooter}>
              <button type="button" className={styles.cancelBtn} onClick={onClose}>{common("cancel")}</button>
              <button 
                type="button" 
                onClick={handleDeleteAccount}
                disabled={isSaving}
                className={styles.deleteBtn}
              >
                {isSaving ? t("deleting") : t("deletePermanently")}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
