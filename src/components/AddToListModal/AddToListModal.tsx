"use client";

import { useState, useEffect } from "react";
import { showToast } from "@/components/Toast/ToastListener";
import { useTranslations } from "next-intl";
import styles from "./AddToListModal.module.css";

interface AddToListModalProps {
  isOpen: boolean;
  onClose: () => void;
  musicItemId: string;
  username: string;
}

interface ListData {
  id: string;
  title: string;
  isPublic: boolean;
  items: any[];
}

export default function AddToListModal({ isOpen, onClose, musicItemId, username }: AddToListModalProps) {
  const t = useTranslations("Profile");
  const common = useTranslations("Common");
  const [lists, setLists] = useState<ListData[]>([]);
  const [loading, setLoading] = useState(true);
  const [addingToListId, setAddingToListId] = useState<string | null>(null);
  
  const [showCreate, setShowCreate] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    if (isOpen) {
      fetchLists();
      setShowCreate(false);
      setNewTitle("");
      setNewDesc("");
    }
  }, [isOpen, username]);

  const fetchLists = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/lists?username=${username}`);
      if (res.ok) {
        const data = await res.json();
        setLists(data);
      }
    } catch (error) {
      console.error("Error fetching lists", error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddToList = async (listId: string) => {
    setAddingToListId(listId);
    try {
      const res = await fetch(`/api/lists/${listId}/items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ musicItemId }),
      });
      
      if (res.ok) {
        showToast(t("addedToList"), "success");
        onClose();
      } else {
        await res.json();
        showToast(t("addToListError"), "error");
      }
    } catch (error) {
      showToast(common("connectionError"), "error");
    } finally {
      setAddingToListId(null);
    }
  };

  const handleCreateList = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    
    setIsCreating(true);
    try {
      // 1. Create the list
      const resList = await fetch("/api/lists", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: newTitle,
          description: newDesc,
          isPublic: true,
        }),
      });
      
      const listData = await resList.json();
      
      if (!resList.ok) {
        showToast(t("createListError"), "error");
        setIsCreating(false);
        return;
      }
      
      // 2. Add item to new list
      const resItem = await fetch(`/api/lists/${listData.id}/items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ musicItemId }),
      });
      
      if (resItem.ok) {
        showToast(t("addedToNamedList", { title: listData.title }), "success");
        onClose();
      } else {
        await resItem.json();
        showToast(t("createdButAddFailed"), "error");
        fetchLists(); // refresh so user sees the new list at least
        setShowCreate(false);
      }
    } catch (error) {
      showToast(common("connectionError"), "error");
    } finally {
      setIsCreating(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <h2 className={styles.title}>{t("addToListTitle")}</h2>
          <button className={styles.closeBtn} onClick={onClose} aria-label={common("close")}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
        
        <div className={styles.content}>
          {loading ? (
            <div className={styles.loading}>{t("loadingLists")}</div>
          ) : (
            <>
              {lists.length > 0 ? (
                <div className={styles.listsContainer}>
                  {lists.map((list) => {
                    // Check if already in list
                    const alreadyAdded = list.items?.some(
                      (item: any) => item.musicItemId === musicItemId
                    );
                    
                    return (
                      <button
                        key={list.id}
                        className={styles.listItemBtn}
                        onClick={() => handleAddToList(list.id)}
                        disabled={alreadyAdded || addingToListId === list.id}
                      >
                        <div className={styles.listInfo}>
                          <span className={styles.listName}>{list.title}</span>
                          <span className={styles.listMeta}>
                            {t("albumsCount", { count: list.items?.length || 0 })} • {list.isPublic ? t("public") : t("private")}
                          </span>
                        </div>
                        <div>
                          {alreadyAdded ? (
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="20 6 9 17 4 12"></polyline>
                            </svg>
                          ) : addingToListId === list.id ? (
                            <span style={{ fontSize: '0.8rem' }}>{t("adding")}</span>
                          ) : (
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--text-secondary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <line x1="12" y1="5" x2="12" y2="19"></line>
                              <line x1="5" y1="12" x2="19" y2="12"></line>
                            </svg>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className={styles.emptyState}>
                  {t("noOwnLists")}
                </div>
              )}
              
              <div className={styles.createListSection}>
                {!showCreate ? (
                  <button 
                    className={styles.createToggleBtn}
                    onClick={() => setShowCreate(true)}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="12" y1="5" x2="12" y2="19"></line>
                      <line x1="5" y1="12" x2="19" y2="12"></line>
                    </svg>
                    {t("createNewList")}
                  </button>
                ) : (
                  <form className={styles.createForm} onSubmit={handleCreateList}>
                    <input
                      type="text"
                      className={styles.input}
                      placeholder={t("newListTitle")}
                      value={newTitle}
                      onChange={(e) => setNewTitle(e.target.value)}
                      required
                      maxLength={100}
                      autoFocus
                    />
                    <div className={styles.actions}>
                      <button 
                        type="button" 
                        className="secondary-btn" 
                        style={{ fontSize: "0.85rem", padding: "6px 12px" }}
                        onClick={() => setShowCreate(false)}
                      >
                        {common("cancel")}
                      </button>
                      <button 
                        type="submit" 
                        className="neon-btn"
                        style={{ fontSize: "0.85rem", padding: "6px 12px" }}
                        disabled={isCreating || !newTitle.trim()}
                      >
                        {isCreating ? t("creating") : t("createAndAdd")}
                      </button>
                    </div>
                  </form>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
