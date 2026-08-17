# RTM-CACHE-014 — política de frescura de datos derivados

## Cachés de datos de usuario

| Dato | Key | Tag | TTL | Política |
| --- | --- | --- | --- | --- |
| Estadísticas de reseñas y ratings | `user-stats`, `userId` | `rtm:user-derived:stats:<userId>` | 3600 s | Invalidación inmediata tras una escritura confirmada que altera reseñas o ratings. El TTL limita la degradación si la infraestructura de invalidación falla. |
| Recap anual de reseñas | `user-recap`, `userId`, `year` | `rtm:user-derived:recap:<userId>:<year>` | 3600 s | Invalidación inmediata sólo para el año de creación de la reseña afectada. El TTL protege una consulta de agregado histórico. |

Las keys y tags se basan en el identificador interno estable del usuario. El
recap añade el año, que también participa en la consulta. No hay tags globales
para datos derivados de usuarios.

El endpoint de estadísticas compone además las métricas del diario mediante una
lectura directa de `DiaryService.getStats`; esas métricas no pertenecen a la
caché de reseñas/ratings. El recap actual se define exclusivamente por reviews.

## Matriz de dependencias

| Mutación | Datos derivados afectados | Invalidación |
| --- | --- | --- |
| Crear o actualizar rating | promedio y total de ratings de stats | stats del usuario |
| Crear review | distribución, artistas, ratings de stats; recap del año creado | stats del usuario y recap de ese año |
| Editar `ratingValue` de una review | distribución y ratings de stats; recap del año creado | stats del usuario y recap de ese año |
| Editar tags de una review | tag dominante de recap | recap del año creado |
| Eliminar review | distribución y artistas de stats; recap del año creado | stats del usuario y recap de ese año |
| Crear, editar o eliminar una escucha del diario | sólo la sección de diario de stats, que se lee sin caché | ninguna |
| Editar sólo contenido o favorite track de una review | ninguno de estos agregados | ninguna |
| Follow, like, comentario, listas, listen-later o perfil | ninguno de estos agregados | ninguna |

La invalidación se solicita fuera de las transacciones y sólo después de que la
escritura termina correctamente. Si el runtime de cache falla después del
commit, la mutación conserva su respuesta exitosa y se registra el fallo; no se
intenta un rollback que ya no sería real. En ese caso, el TTL de una hora es el
límite de frescura de respaldo, no la política normal.

## Verificación local

`test/user-derived-cache.test.ts` ejecuta `unstable_cache` y `revalidateTag`
con un Data Cache efímero: demuestra lectura caliente, purga por tag, siguiente
lectura fresca, aislamiento entre usuarios, create/update/delete de review,
rating, fallo previo a commit y dos ratings concurrentes. Los tiempos de ese
test y cualquier medición local no son una estimación de producción.

Ejecutar `npm run perf:user-derived-cache` para medir por separado la primera
lectura, la lectura caliente y la primera lectura posterior a una invalidación.
El script usa una base SQLite efímera y un Data Cache local; no lee `.env`, no
modifica `dev.db`, Turso ni producción.
