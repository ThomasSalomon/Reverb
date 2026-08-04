-- RTM-PERF-009: índices compuestos para filtros por propietario/visibilidad y orden temporal estable.
CREATE INDEX "Review_musicItemId_createdAt_id_idx" ON "Review"("musicItemId", "createdAt", "id");
CREATE INDEX "Review_createdAt_id_idx" ON "Review"("createdAt", "id");
CREATE INDEX "List_userId_createdAt_id_idx" ON "List"("userId", "createdAt", "id");
CREATE INDEX "List_isPublic_createdAt_id_idx" ON "List"("isPublic", "createdAt", "id");
CREATE INDEX "ListItem_listId_order_id_idx" ON "ListItem"("listId", "order", "id");
DROP INDEX "Comment_reviewId_idx";
CREATE INDEX "Comment_reviewId_createdAt_id_idx" ON "Comment"("reviewId", "createdAt", "id");
CREATE INDEX "DiaryLog_userId_listenedAt_id_idx" ON "DiaryLog"("userId", "listenedAt", "id");
CREATE INDEX "ListenLater_userId_createdAt_id_idx" ON "ListenLater"("userId", "createdAt", "id");
CREATE INDEX "Notification_userId_createdAt_id_idx" ON "Notification"("userId", "createdAt", "id");
CREATE INDEX "Notification_userId_isRead_createdAt_id_idx" ON "Notification"("userId", "isRead", "createdAt", "id");
