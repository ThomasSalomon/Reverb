"use client";

import React, { useState, useEffect } from "react";
import styles from "./Toast.module.css";

interface ToastMessage {
  id: string;
  message: string;
  type: "success" | "error" | "info";
}

export function showToast(message: string, type: "success" | "error" | "info" = "success") {
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent("reverb-toast", {
        detail: { message, type },
      })
    );
  }
}

export default function ToastListener() {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  useEffect(() => {
    const handleToastEvent = (e: Event) => {
      const customEvent = e as CustomEvent<{ message: string; type: "success" | "error" | "info" }>;
      const { message, type } = customEvent.detail;
      const id = Math.random().toString(36).substring(2, 9);
      
      setToasts((prev) => [...prev, { id, message, type }]);

      // Auto remove after 4 seconds
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 4000);
    };

    window.addEventListener("reverb-toast", handleToastEvent);
    return () => {
      window.removeEventListener("reverb-toast", handleToastEvent);
    };
  }, []);

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  return (
    <div className={styles.toastContainer}>
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`${styles.toast} ${styles[toast.type]} glass glass-effect`}
          onClick={() => removeToast(toast.id)}
        >
          <span className={styles.icon}>
            {toast.type === "success" && "💚"}
            {toast.type === "error" && "💔"}
            {toast.type === "info" && "ℹ️"}
          </span>
          <span className={styles.message}>{toast.message}</span>
          <button className={styles.closeBtn}>&times;</button>
        </div>
      ))}
    </div>
  );
}
