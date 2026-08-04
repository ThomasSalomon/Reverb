# Invariantes de entrada y persistencia (RTM-DATA-008)

## Inventario confirmado

| Campo | Regla | Fuente | Capa de persistencia |
|---|---|---|---|
| `Rating.value`, `Review.ratingValue`, `DiaryLog.ratingValue` | número finito entre 0.5 y 5, en pasos de 0.5; diario permite `null` | `RatingStars`, `src/services/ratings.ts`, `src/services/diary.ts`, schema | triggers SQLite/libSQL |
| `DiaryLog.listenedAt` | ISO date o timestamp con zona; día real | `src/services/diary.ts` | aplicación; SQLite no valida esta semántica de forma fiable |
| `DiaryLog.notes` | texto opcional de hasta 500 | UI y `src/services/diary.ts` | trigger |
| `Review.content` | texto no vacío, normalizado a LF, hasta 5000 | límite nuevo de API: no existía límite de producto; UI y datos locales no definen uno menor | trigger |
| `Comment.content` | texto no vacío de hasta 500 | `src/services/social-actions.ts` | aplicación; fuera de esta migración |
| `MusicItem.type` | `ALBUM` o `SONG` | `src/services/diary.ts`, `src/services/playlist-import.ts` | trigger |
| `FavoriteAlbum.slot` | entero 1, 2 o 3 | `EditFavoritesModal` y profile API | trigger más unicidad existente |
| `MusicEvent.dateMonth/dateDay` | enteros 1–12 y 1–31 | schema y `seed-events.ts` | trigger; combinaciones calendario reales siguen fuera de la base |

`MusicEvent` no posee Route Handler mutable. No se inventa un contrato HTTP para su seed administrativa ni se cierra `eventType`: las cinco variantes presentes en la base local no constituyen una especificación completa del dominio.

## Migración y operación

`20260804123000_data_invariants` usa triggers porque SQLite/libSQL no permite añadir `CHECK` a una tabla existente sin reconstruirla. Así conserva FKs y datos válidos sin desactivar `foreign_keys`. La migración se aplica solamente después de diagnosticar una copia y seguir el runbook de [`database-migrations.md`](database-migrations.md); nunca con `db push`, sobre `dev.db` persistente ni sobre Turso desde este cambio.

El diagnóstico local de esta tarea encontró 0 ratings, reviews, diary ratings/fechas o slots incompatibles; sólo observó `MusicItem.type=ALBUM` y los cinco `MusicEvent.eventType` existentes. Eso no acredita la validez de datos remotos.
