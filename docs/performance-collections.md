# RTM-PERF-009 — medición local reproducible

Ejecutar `npx tsx scripts/perf-collections.ts`. El script usa sólo `file::memory:?cache=shared`, crea 40 usuarios y 240 filas por colección (más una lista de 100 ítems) y no lee credenciales ni modifica `dev.db`, Turso o producción.

La medición representa las formas SQL de los flujos priorizados con una página de 20 elementos. Los milisegundos son del proceso local y sólo sirven para comparar ejecuciones equivalentes; no representan una latencia ni un objetivo de producción.

| Flujo | Antes | Después |
| --- | --- | --- |
| listas públicas | `SCAN List` + `TEMP B-TREE` | `List_isPublic_createdAt_id_idx` |
| comentarios | índice por `reviewId` + `TEMP B-TREE` | `Comment_reviewId_createdAt_id_idx` |
| diario | índice existente + `TEMP B-TREE` para el desempate | `DiaryLog_userId_listenedAt_id_idx` |
| listen-later | `SCAN` + `TEMP B-TREE` | `ListenLater_userId_createdAt_id_idx` |
| reseñas de álbum | `SCAN` + `TEMP B-TREE` | `Review_musicItemId_createdAt_id_idx` |
| notificaciones | 22 consultas (20 actores distintos + listado + contador) | 3 consultas constantes (listado, autores en lote, contador) |

En una ejecución local de referencia, el script devolvió 20 filas por flujo y tamaños entre 1.1 y 2.0 KB para las proyecciones SQL. Las duraciones oscilaron entre 0.469 y 2.064 ms y deben volver a medirse en cada entorno. El plan posterior eliminó los `TEMP B-TREE` de las seis consultas medidas.

Los índices de la migración son incrementales. En SQLite/libSQL su construcción requiere recorrer las tablas una vez; se deben aplicar con el mecanismo normal de migraciones, fuera de esta tarea y con ventana operacional si las cardinalidades reales lo requieren.

No se añadió cache: la comparación se realiza sin cache y RTM-CACHE-014 sigue siendo una dependencia independiente.
