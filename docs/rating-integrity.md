# Integridad del rating actual (RTM-DATA-004)

## Semántica e invariante

`Rating` representa la calificación **actual** de un usuario para un elemento musical. La base protege:

```text
Como máximo un Rating por (userId, musicItemId).
```

Esta regla no se aplica a `DiaryLog.ratingValue`, que pertenece a una escucha histórica, ni vuelve únicas las reviews. Cada `Review` conserva su propio `ratingValue`; varias reviews pueden compartir un único rating actual.

Antes de RTM-DATA-004, `POST /api/ratings` y `POST /api/reviews` ejecutaban una lectura previa seguida de `create` o `update`. Dos requests podían observar que no había fila y crear dos ratings. Las lecturas con `findFirst`, los conteos y los promedios quedaban entonces sujetos a filas arbitrarias o infladas.

## Migración y deduplicación

La migración `20260802183000_unique_current_rating`:

1. aborta antes de borrar si detecta timestamps no interpretables, valores fuera de `0.5..5` o fuera del paso `0.5`, o relaciones requeridas rotas;
2. agrupa por `(userId, musicItemId)`;
3. conserva la fila con `updatedAt` más reciente;
4. desempata por `createdAt` más reciente y luego por `id` descendente;
5. elimina solamente las filas con rango de duplicado mayor que uno;
6. reemplaza `Rating_userId_musicItemId_idx` por el índice único `Rating_userId_musicItemId_key`.

No se promedian ratings ni se genera un valor nuevo. `Review` no posee una FK a `Rating.id`, por lo que la migración no necesita transferir relaciones. Las FKs de `Rating` hacia `User` y `MusicItem` permanecen iguales.

La muestra local inspeccionada contenía 3 filas, 3 pares únicos, 0 redundantes, 0 valores inválidos y 0 huérfanos. Los fixtures de migración contienen 7 filas, 3 grupos duplicados y 3 filas redundantes; terminan en 4 filas y verifican los tres desempates.

## Diagnóstico local de sólo lectura

El comando usa exclusivamente `DATABASE_URL=file:...` y rechaza URLs remotas:

```powershell
$env:DATABASE_URL = "file:./dev.db"
npm run db:ratings:diagnose
Remove-Item Env:DATABASE_URL
```

Registra total de filas, pares únicos, filas redundantes, grupos duplicados, valores/timestamps inválidos, huérfanos e índices. En una intervención real, el operador debe guardar la salida anterior y posterior junto al registro del cambio; la diferencia de `totalRows` es la cantidad deduplicada y debe coincidir con `redundantRows` previo.

## Escritura atómica y contratos

`RatingService.setCurrent` valida el elemento y el valor y ejecuta un `upsert` mediante la clave compuesta. La política concurrente es “última escritura válida confirmada por la base”: el valor final corresponde a una de las solicitudes aceptadas y la fila mantiene su ID. Si un adaptador expone el conflicto de unicidad esperado, se hace una sola actualización acotada; otros errores se propagan.

- `POST /api/ratings`: mantiene `200` y `{ message, rating }` para creación o actualización.
- `POST /api/reviews`: crea una review y actualiza/crea el rating dentro de la misma transacción.
- `PATCH /api/reviews/:id`: actualiza la review y el rating actual en la misma transacción cuando recibe `ratingValue`.
- `DELETE /api/reviews/:id`: elimina la review y conserva el rating actual, igual que antes.

El valor debe ser un número JSON finito entre `0.5` y `5`, en pasos de `0.5`. Strings, `null`, `NaN`, infinito y pasos intermedios se rechazan en backend. El actor proviene de la cookie firmada; headers o campos de identidad enviados por el cliente no deciden el usuario.

Actualizar no aumenta el conteo. Un segundo usuario sí agrega otra fila. Los promedios existentes siguen calculándose desde `Rating`, ahora con un aporte máximo por usuario. La distribución y el recap basados en reviews no cambian.

## Aplicación segura y rollback

No usar `prisma db push` ni aplicar SQL manual sobre una base activa. Para una base existente:

1. detener escrituras y obtener un snapshot/dump restaurable;
2. probar la copia y ejecutar `integrity_check`, `foreign_key_check` y el diagnóstico;
3. abortar ante valores inválidos, huérfanos o conteos no explicados;
4. aplicar el historial versionado a la copia;
5. repetir diagnóstico, conteos, promedio, chequeo de FKs e inspección de índices;
6. registrar cantidad deduplicada, IDs ganadores y decisión de continuar.

`compensation.sql` puede quitar el índice único y restaurar el índice normal, pero **no recupera filas eliminadas**. La recuperación de duplicados depende del snapshot previo. Se consideran redundantes porque `Rating` contiene un único estado actual y no hay relaciones al ID descartado; aun así, sus valores y IDs se pierden al deduplicar.

## Verificación reproducible

```bash
npm run db:validate
npm run db:migrate:test
npm run test:ratings
npx tsc --noEmit
npm run lint
npm run build
```

Las pruebas usan SQLite/libSQL efímeras y el SQL real. Cubren migración con/sin duplicados, abort seguro, índices, FKs, identidad estable, usuarios/ítems distintos, validación, autenticación, promedio y concurrencia entre ratings, reviews y ambos flujos.
