# Diario como historial de eventos

Este documento define la corrección de RTM-FUNC-003 y el contrato observable del diario musical.

## Causa raíz y semántica

El esquema ya permitía varias filas `DiaryLog` para el mismo usuario y elemento musical, pero `POST /api/diary` buscaba la última fila, reemplazaba `listenedAt`, `notes` y `ratingValue`, e incrementaba `listenCount`. La fila combinaba así un evento histórico con un acumulador mutable.

Desde esta corrección:

- cada POST válido crea una fila nueva y devuelve `201`;
- cada fila nueva representa exactamente una escucha y nace con `listenCount = 1`;
- repetir usuario, elemento, fecha, nota o rating sigue creando otro evento;
- `ratingValue` conserva la valoración de esa escucha y no modifica `Rating` global;
- el historial se ordena por `listenedAt DESC`, `createdAt DESC`, `id DESC`;
- edición y eliminación se realizan por ID y propietario.

## Contratos HTTP

### `POST /api/diary`

Requiere una sesión JWT válida en la cookie HttpOnly. Acepta:

```json
{
  "musicItemId": "123",
  "listenedAt": "2026-08-02T18:00:00.000Z",
  "ratingValue": 4.5,
  "notes": "Volví a escucharlo completo"
}
```

`musicItemId` es obligatorio. `listenedAt`, `ratingValue` y `notes` son opcionales. Una fecha enviada debe ser ISO válida (`YYYY-MM-DD` o fecha-hora con zona); el rating debe estar entre 0.5 y 5 en pasos de 0.5; la nota debe ser string y no superar 500 caracteres. El payload completo no puede superar 16 KiB. Los tipos admitidos son `ALBUM` y `SONG`.

Respuestas principales: `201` con el evento creado, `400` para entrada inválida, `401` sin sesión, `404` si el elemento no puede resolverse y `413` para payload excesivo. El endpoint no es idempotente por usuario/elemento/fecha: dos solicitudes legítimas representan dos escuchas.

### `GET /api/diary`

Sin `username`, devuelve el diario de la sesión autenticada. Con `?username=<usuario>`, conserva la consulta pública del perfil. Devuelve todos los eventos aplicables con orden determinista y sólo los datos requeridos por el timeline.

No se agregó paginación en RTM-FUNC-003 para no mezclar la corrección histórica con RTM-PERF-009.

### `PATCH /api/diary/:id`

Permite al propietario cambiar `listenedAt`, `ratingValue` o `notes` de una entrada concreta. No permite cambiar `userId`, `musicItemId` ni `listenCount`. Una entrada ajena y una inexistente responden `404` para evitar enumeración horizontal.

### `DELETE /api/diary/:id`

Elimina únicamente la entrada identificada cuando pertenece a la sesión. Responde `204`; una entrada ajena o inexistente responde `404`.

La UI actual todavía no expone controles de edición o borrado. Los contratos backend quedan preparados para que un consumidor futuro use siempre el ID del evento.

## Estadísticas

El endpoint de estadísticas mantiene sus métricas de reseñas y ratings y añade:

- `diaryEntries`: cantidad de filas visibles del diario;
- `totalListens`: escuchas conocidas, calculadas como `SUM(listenCount)` por compatibilidad legacy;
- `uniqueListenedItems`: elementos musicales distintos;
- `latestListen`: evento más reciente según el mismo orden total del historial.

Dos filas nuevas del mismo álbum producen `diaryEntries = 2`, `totalListens = 2` y `uniqueListenedItems = 1`. El recap anual sigue definido por reseñas; no se cambió silenciosamente a un recap de escuchas.

## Datos existentes y `listenCount`

`listenCount` se conserva transitoriamente porque una fila legacy con valor mayor que 1 demuestra que hubo varias escuchas, pero no contiene las fechas, notas o ratings individuales que fueron sobrescritos. Esa información no puede reconstruirse.

Estrategia conservadora:

- no dividir una fila legacy en eventos ficticios;
- conservar su ID, fecha, nota, rating y contador conocidos;
- no volver a incrementar ese contador;
- calcular el total conocido con su valor y crear todas las escuchas futuras como filas con valor 1;
- retirar el campo en otra fase sólo después de resolver cómo presentar y conservar el agregado legacy.

La inspección de `dev.db` del 2 de agosto de 2026 encontró una fila, `listenCount = 1`, nota nula, rating válido y ninguna fila agregada. `prisma/dev.db` está vacío. No se inspeccionó ni modificó Turso; otros entornos pueden contener filas con valores mayores.

## Esquema y migración

No se necesita DDL: la baseline vigente ya contiene PK por evento, FKs, ausencia de unicidad usuario/elemento e índices por usuario/elemento y usuario/fecha. Crear una migración vacía sería engañoso. La prueba de migraciones se amplió con una fila `listenCount = 3` para demostrar que despliegue y adopción conservan su ID, nota, rating y contador sin inventar eventos.

## Concurrencia, rollback y operación

Cada escritura es un único `INSERT`; no hay lectura previa ni actualización susceptible a lost update. Dos POST concurrentes válidos deben confirmar dos filas diferentes.

No hubo backfill ni cambio de esquema. Revertir código no requiere transformar datos, y las filas nuevas siguen siendo eventos válidos. Sin embargo, volver al handler anterior reintroduciría la sobrescritura: ante un incidente se debe corregir hacia adelante o restaurar esta versión, no borrar eventos creados.

## Verificación

```bash
npm run test:diary
npm run db:migrate:test
npm run db:validate
npx tsc --noEmit
npm run build
```

La prueba focalizada usa la baseline real en libSQL efímero y cubre repetición, fechas iguales y distintas, notas, ratings, tipos admitidos, autenticación, propiedad, validación, orden, edición, eliminación, estadísticas y concurrencia. No utiliza credenciales ni conexiones remotas.
