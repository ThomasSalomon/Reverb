"use client";

import React, { useState } from "react";
import styles from "../SharedModal.module.css";
import { showToast } from "@/components/Toast/ToastListener";
import { useRouter } from "next/navigation";
import { useBodyScrollLock } from "@/hooks/useBodyScrollLock";

interface AccountSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  username: string;
}

export default function AccountSettingsModal({ isOpen, onClose, username }: AccountSettingsModalProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"password" | "delete">("password");
  
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  useBodyScrollLock(isOpen);

  if (!isOpen) return null;

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 6) {
      showToast("La nueva contraseña debe tener al menos 6 caracteres", "error");
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
        showToast(data.message || "Contraseña actualizada", "success");
        setCurrentPassword("");
        setNewPassword("");
      } else {
        showToast(data.error || "Error al actualizar contraseña", "error");
      }
    } catch (e) {
      console.error(e);
      showToast("Error de conexión", "error");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteAccount = async () => {
    const confirmDelete = window.confirm(
      "¿Estás seguro de que deseas eliminar tu cuenta permanentemente? Esta acción borrará todas tus reseñas, listas y comentarios, y no se puede deshacer."
    );
    if (!confirmDelete) return;

    setIsSaving(true);
    try {
      const res = await fetch(`/api/users/${username}`, {
        method: "DELETE",
      });
      
      const data = await res.json();
      if (res.ok) {
        showToast("Cuenta eliminada exitosamente", "success");
        // Logout user
        await fetch("/api/auth/logout", { method: "POST" });
        window.location.href = "/";
      } else {
        showToast(data.error || "Error al eliminar cuenta", "error");
      }
    } catch (e) {
      console.error(e);
      showToast("Error de conexión", "error");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h2 className={styles.modalTitle}>Configuración de Cuenta</h2>
          <button className={styles.closeBtn} onClick={onClose} aria-label="Cerrar modal">&times;</button>
        </div>

        <div className={styles.tabsContainer}>
          <button
            onClick={() => setActiveTab("password")}
            className={`${styles.tabBtn} ${activeTab === "password" ? styles.tabBtnActive : ""}`}
          >
            Contraseña
          </button>
          <button
            onClick={() => setActiveTab("delete")}
            className={`${styles.tabBtn} ${styles.tabBtnDanger} ${activeTab === "delete" ? styles.tabBtnActive : ""}`}
          >
            Eliminar Cuenta
          </button>
        </div>

        {activeTab === "password" && (
          <form className={styles.formContainer} onSubmit={handleChangePassword}>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Contraseña Actual</label>
              <input
                type="password"
                className={styles.formInput}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                required
              />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Nueva Contraseña</label>
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
              <button type="button" className={styles.cancelBtn} onClick={onClose}>Cancelar</button>
              <button type="submit" className={styles.saveBtn} disabled={isSaving}>
                {isSaving ? "Guardando..." : "Cambiar Contraseña"}
              </button>
            </div>
          </form>
        )}

        {activeTab === "delete" && (
          <div className={styles.formContainer}>
            <p className={styles.warningText}>
              Eliminar tu cuenta es una acción permanente y no se puede deshacer. Se borrarán todos tus datos asociados.
            </p>
            <div className={styles.modalFooter}>
              <button type="button" className={styles.cancelBtn} onClick={onClose}>Cancelar</button>
              <button 
                type="button" 
                onClick={handleDeleteAccount}
                disabled={isSaving}
                className={styles.deleteBtn}
              >
                {isSaving ? "Eliminando..." : "Eliminar Permanentemente"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
