"use client";

import { FormEventHandler } from "react";
import { useTranslations } from "next-intl";
import AccessibleDialog from "@/components/AccessibleDialog/AccessibleDialog";
import Button from "@/components/Button/Button";
import styles from "./page.module.css";

export interface ProfileAlbumSearchResult {
  id: string;
  title: string;
  artist: string;
  coverUrl: string;
}

interface CreateListDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: FormEventHandler<HTMLFormElement>;
  title: string;
  onTitleChange: (value: string) => void;
  description: string;
  onDescriptionChange: (value: string) => void;
  isPublic: boolean;
  onPublicChange: (value: boolean) => void;
}

export function CreateListDialog({
  isOpen,
  onClose,
  onSubmit,
  title,
  onTitleChange,
  description,
  onDescriptionChange,
  isPublic,
  onPublicChange,
}: CreateListDialogProps) {
  const t = useTranslations("Profile");
  const common = useTranslations("Common");

  return (
    <AccessibleDialog
      isOpen={isOpen}
      onClose={onClose}
      labelledBy="create-list-dialog-title"
      className={styles.modalOverlay}
    >
      <div className={styles.modalContent}>
        <div className={styles.modalHeader}>
          <h3 id="create-list-dialog-title" className={styles.modalTitle}>{t("createCollection")}</h3>
          <button type="button" data-dialog-initial-focus onClick={onClose} className={styles.closeBtn} aria-label={common("close")}>
            &times;
          </button>
        </div>

        <form onSubmit={onSubmit} className={styles.dialogForm}>
          <div className={styles.formGroup}>
            <label htmlFor="new-list-title" className={styles.formLabel}>{t("listTitle")}</label>
            <input
              id="new-list-title"
              name="title"
              type="text"
              required
              className={styles.formInput}
              value={title}
              onChange={(event) => onTitleChange(event.target.value)}
              placeholder={t("newListTitlePlaceholder")}
            />
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="new-list-description" className={styles.formLabel}>{t("listDescription")} ({common("optional")})</label>
            <textarea
              id="new-list-description"
              name="description"
              className={styles.formInput}
              rows={3}
              maxLength={500}
              value={description}
              onChange={(event) => onDescriptionChange(event.target.value)}
              placeholder={t("newListDescriptionPlaceholder")}
            />
          </div>

          <div className={styles.checkboxField}>
            <input
              type="checkbox"
              id="new-list-public"
              name="isPublic"
              checked={isPublic}
              onChange={(event) => onPublicChange(event.target.checked)}
            />
            <label htmlFor="new-list-public">{t("publicList")}</label>
          </div>

          <div className={styles.modalFooter}>
            <Button variant="secondary" onClick={onClose}>{common("cancel")}</Button>
            <Button type="submit">{t("createList")}</Button>
          </div>
        </form>
      </div>
    </AccessibleDialog>
  );
}

interface DiaryDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: FormEventHandler<HTMLFormElement>;
  selectedAlbum: ProfileAlbumSearchResult | null;
  onSelectedAlbumChange: (album: ProfileAlbumSearchResult | null) => void;
  searchQuery: string;
  onSearchQueryChange: (value: string) => void;
  searchResults: ProfileAlbumSearchResult[];
  searching: boolean;
  rating: string;
  onRatingChange: (value: string) => void;
  notes: string;
  onNotesChange: (value: string) => void;
}

export function DiaryDialog({
  isOpen,
  onClose,
  onSubmit,
  selectedAlbum,
  onSelectedAlbumChange,
  searchQuery,
  onSearchQueryChange,
  searchResults,
  searching,
  rating,
  onRatingChange,
  notes,
  onNotesChange,
}: DiaryDialogProps) {
  const t = useTranslations("Profile");
  const common = useTranslations("Common");

  return (
    <AccessibleDialog
      isOpen={isOpen}
      onClose={onClose}
      labelledBy="profile-diary-dialog-title"
      className={styles.modalOverlay}
    >
      <div className={styles.modalContent}>
        <div className={styles.modalHeader}>
          <h3 id="profile-diary-dialog-title" className={styles.modalTitle}>{t("diaryTitle")}</h3>
          <button type="button" data-dialog-initial-focus onClick={onClose} className={styles.closeBtn} aria-label={common("close")}>
            &times;
          </button>
        </div>

        <form onSubmit={onSubmit} className={styles.dialogForm}>
          <div className={`${styles.formGroup} ${styles.albumSearchField}`}>
            <label htmlFor="profile-diary-album-search" className={styles.formLabel}>{t("searchAlbum")}</label>
            {selectedAlbum ? (
              <div className={styles.selectedDiaryAlbum}>
                <img src={selectedAlbum.coverUrl} alt={selectedAlbum.title} />
                <div className={styles.selectedDiaryAlbumMeta}>
                  <strong>{selectedAlbum.title}</strong>
                  <span>{selectedAlbum.artist}</span>
                </div>
                <Button size="compact" variant="secondary" onClick={() => onSelectedAlbumChange(null)}>
                  {t("change")}
                </Button>
              </div>
            ) : (
              <>
                <input
                  id="profile-diary-album-search"
                  name="albumSearch"
                  type="text"
                  className={styles.formInput}
                  placeholder={t("albumTitlePlaceholder")}
                  value={searchQuery}
                  onChange={(event) => onSearchQueryChange(event.target.value)}
                />
                {searching && <div className={styles.searchingText}>{common("searching")}</div>}
                {searchResults.length > 0 && (
                  <div className={styles.diarySearchResultsDropdown}>
                    {searchResults.map((album) => (
                      <button
                        type="button"
                        key={album.id}
                        className={styles.searchResultItem}
                        onClick={() => onSelectedAlbumChange(album)}
                      >
                        <img src={album.coverUrl} alt={album.title} />
                        <span>
                          <strong>{album.title}</strong>
                          <small>{album.artist}</small>
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="profile-diary-rating" className={styles.formLabel}>{t("rating")}</label>
            <select
              id="profile-diary-rating"
              name="rating"
              className={styles.formInput}
              value={rating}
              onChange={(event) => onRatingChange(event.target.value)}
            >
              <option value="5">★★★★★ (5.0)</option>
              <option value="4.5">★★★★½ (4.5)</option>
              <option value="4">★★★★☆ (4.0)</option>
              <option value="3.5">★★★½☆ (3.5)</option>
              <option value="3">★★★☆☆ (3.0)</option>
              <option value="2.5">★★½☆☆ (2.5)</option>
              <option value="2">★★☆☆☆ (2.0)</option>
              <option value="1.5">★½☆☆☆ (1.5)</option>
              <option value="1">★☆☆☆☆ (1.0)</option>
              <option value="0.5">½☆☆☆☆ (0.5)</option>
            </select>
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="profile-diary-notes" className={styles.formLabel}>{t("quickNotes")} ({common("optional")})</label>
            <textarea
              id="profile-diary-notes"
              name="notes"
              className={styles.formInput}
              rows={3}
              maxLength={500}
              value={notes}
              onChange={(event) => onNotesChange(event.target.value)}
              placeholder={t("quickNotes")}
            />
          </div>

          <div className={styles.modalFooter}>
            <Button variant="secondary" onClick={onClose}>{common("cancel")}</Button>
            <Button type="submit">{common("save")}</Button>
          </div>
        </form>
      </div>
    </AccessibleDialog>
  );
}

interface DeleteListDialogProps {
  listId: string | null;
  onClose: () => void;
  onConfirm: (listId: string) => void;
}

export function DeleteListDialog({ listId, onClose, onConfirm }: DeleteListDialogProps) {
  const t = useTranslations("Profile");
  const common = useTranslations("Common");

  return (
    <AccessibleDialog
      isOpen={Boolean(listId)}
      onClose={onClose}
      labelledBy="delete-list-dialog-title"
      role="alertdialog"
      className={styles.confirmOverlay}
    >
      <div className={styles.confirmDialog}>
        <h4 id="delete-list-dialog-title">{t("deleteCollectionTitle")}</h4>
        <p>{t("deleteCollectionDescription")}</p>
        <div className={styles.confirmActions}>
          <Button data-dialog-initial-focus variant="secondary" size="compact" onClick={onClose}>
            {common("cancel")}
          </Button>
          <Button
            variant="danger"
            size="compact"
            onClick={() => {
              if (listId) onConfirm(listId);
            }}
          >
            {common("delete")}
          </Button>
        </div>
      </div>
    </AccessibleDialog>
  );
}
