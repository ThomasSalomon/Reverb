# Estrategia de pruebas backend

## Alcance y aislamiento

`test/helpers/backend-test-context.ts` crea una base SQLite en un directorio temporal por archivo de integración. Aplica todas las migraciones versionadas en orden antes de importar módulos de producción, configura un secreto JWT exclusivo para pruebas y elimina el directorio al cerrar el contexto. Nunca usa `dev.db`, Turso, variables de producción ni la red.

Se eligió una base por archivo: Prisma/libSQL mantiene un cliente global en desarrollo y las pruebas de cada archivo ya agrupan subcasos relacionados. `scripts/run-integration-tests.ts` ejecuta cada grupo en un proceso del runner separado para que los entornos y clientes globales de los grupos históricos no se contaminen entre sí en Windows. El archivo usa fixtures de valores válidos por defecto para usuarios, ítems musicales, reviews, ratings, eventos de diario, listas y notificaciones; cada factory genera IDs propios. Los casos que requieren concurrencia comparten la misma base del archivo y usan `Promise.all` sobre handlers reales.

## Clasificación actual

| Tipo | Alcance |
| --- | --- |
| Unitario | parsers, cursores, tags, búsqueda, caché, perfiles, utilidades visuales y discografía. |
| Integración backend | `backend-integration`, auth, sesiones revocables, listen-later, ratings, diario, playlists, acciones sociales y handlers Deezer. |
| Migración/DB | historial completo, ratings, comentarios, invariantes y sesiones. |
| Comprobación estática | `a11y-theme`, `auth-session-sync`, `i18n-messages`, `motion-interactions`, `ui-foundations`. Se conservan como guardas de convenciones, no como evidencia de comportamiento backend. |
| E2E | No hay infraestructura instalada. |

## Matriz de riesgo

| Comportamiento | Riesgo | Nivel actual/recomendado | Cobertura | Prioridad |
| --- | --- | --- | --- | --- |
| Login, cookie, sesión válida/inválida y headers falsificados | acceso indebido | integración handler + DB | auth, sesiones y `backend-integration` | P0 |
| Logout, revocación y cambio de contraseña | sesión persistente | integración handler + DB | `revocable-sessions` | P0 |
| Listen-later privado e IDOR | filtración de datos | integración handler + DB | `listen-later-authorization` | P0 |
| Rating único, promedio y concurrencia | corrupción de datos | integración DB/handler concurrente | `rating-integrity`, `backend-integration` | P0 |
| Diario: múltiples escuchas, orden y propiedad | pérdida de historial | integración handler + DB | `diary-events`, `backend-integration` | P0 |
| Import de playlists: límite, deduplicación y rollback | escrituras parciales | integración transaccional | `playlist-import` | P0 |
| Follow/like/comentario idempotente y notificación única | duplicados y efectos parciales | integración transaccional/concurrente | `social-actions` | P0 |
| Constraints y migraciones | esquema incompatible | migración contra SQLite real | `database-migrations` y pruebas de migración | P0 |
| Deezer: timeout, 429, 5xx, JSON inválido | contrato de proveedor | integración de transporte con `fetch` stub | `deezer-http`, `deezer-routes` | P1 |
| Errores de validación, auth y recursos inexistentes | contrato HTTP inconsistente | integración de handler | suites anteriores | P1 |
| Sincronización visual post-login | navegación persistente desactualizada | E2E de navegador | sólo comprobación estática; pendiente | P1 |

## Comandos

- `npm run test:unit`: lógica pura, feedback rápido.
- `npm run test:static`: convenciones, catálogos y estilos; no sustituye integración.
- `npm run test:integration`: handlers/casos de uso, Prisma real, SQLite temporal y stubs de Deezer.
- `npm run db:migrate:test`: migraciones y constraints reales.
- `npm test`: suite local completa.

No existe configuración CI en este repositorio. Cuando se incorpore, debe ejecutar `npm test`, `npm run typecheck`, `npm run lint`, `npm run db:validate` y `npm run build`, sin secretos ni servicios externos.

## Gap E2E explícito

`auth-session-sync.test.ts` permanece como guarda complementaria de convenciones de navegación y cookie. No demuestra que un layout persistente de Next.js actualice Navbar/BottomNav tras un login. La prueba conductual apropiada es un único E2E: cargar como anónimo, iniciar sesión y verificar navegación autenticada sin refresh manual; el logout puede cubrirse en el mismo archivo.

No se agregó Playwright/Cypress en esta fase: el repositorio no tiene runner de navegador ni CI, y sumar una dependencia, navegador descargable y servidor de prueba cambia el costo operativo. Cuando se apruebe esa infraestructura, ese flujo será el primer E2E; no debe reemplazar las pruebas de integración backend.
