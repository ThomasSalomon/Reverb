# Runbook de migraciones de base de datos

Este documento es el contrato operativo para evolucionar la base SQLite/libSQL de MusicBox. El historial versionado vive en `prisma/migrations`; `prisma/schema.prisma` sigue siendo el modelo de la aplicación.

## Estado y causa del incidente RTM-OPS-011

Antes de este cambio no existía `prisma/migrations`. El desarrollo usaba `prisma db push` y `scripts/push-to-turso.ts` generaba el esquema completo con `prisma migrate diff --from-empty` para ejecutarlo contra Turso. Ese flujo no distinguía una base vacía de una existente, no registraba orden ni checksum y no ofrecía adopción, estado, prueba reproducible o compensación.

El baseline `00000000000000_baseline` representa exactamente el esquema vigente al adoptar el historial: 16 tablas de aplicación, 19 índices nombrados y 23 claves foráneas. No agrega unicidad a `Rating`, no cambia la semántica de `DiaryLog` y no incorpora constraints funcionales nuevos.

La evolución posterior `20260802183000_unique_current_rating` corrige RTM-DATA-004. Deduplica el rating actual con orden `updatedAt`, `createdAt`, `id`, reemplaza el índice normal por una restricción única sobre `(userId, musicItemId)` y posee compensación de esquema. Su preflight, pérdida potencial y verificación están documentados en [`docs/rating-integrity.md`](rating-integrity.md).

## Herramientas y configuración verificadas

- Node.js usado para la verificación: 22.14.0; npm: 11.6.0.
- Prisma CLI, Prisma Client y adapter libSQL: 7.8.0.
- `@libsql/client`: 0.17.4; runtime SQLite observado: 3.45.1.
- `prisma.config.ts` apunta a `prisma/schema.prisma`, `prisma/migrations` y `DATABASE_URL`.
- Variables: `DATABASE_URL` para Prisma local; `TURSO_DATABASE_URL` y `TURSO_AUTH_TOKEN` para Turso; `MUSICBOX_MIGRATION_CONFIRM` como confirmación explícita del host remoto.

No se imprimen URLs completas ni tokens. El CLI de Turso no está incluido en el proyecto y debe instalarse y autenticarse fuera de este repositorio cuando un operador autorizado vaya a trabajar con una base remota.

## Estructura e invariantes

Cada directorio `prisma/migrations/<orden>_<nombre>/` contiene un `migration.sql` inmutable. El orden lexicográfico es el orden de aplicación. Después de publicar una migración no se modifica: una corrección se expresa como una migración posterior.

Prisma mantiene `_prisma_migrations` en SQLite local. Como Prisma Migrate no soporta el flujo remoto de Turso, `scripts/turso-migrate.ts` mantiene `_musicbox_migrations` sólo como metadato operacional remoto. Esa tabla no forma parte del modelo funcional y se excluye de la comparación estructural.

El runner Turso:

- requiere una URL `libsql://` y token por variables de entorno;
- exige que `MUSICBOX_MIGRATION_CONFIRM` coincida exactamente con el host de destino para `apply` y `adopt`;
- valida orden y SHA-256 de cada archivo;
- compara el esquema remoto con el estado anterior esperado y ejecuta `quick_check`/`foreign_key_check` antes de mutar;
- aplica SQL compatible y registra el checksum en una misma transacción;
- no vuelve a aplicar una migración ya registrada con igual checksum;
- rechaza checksums cambiados, migraciones previas faltantes y nombres remotos desconocidos;
- rechaza SQL con transacciones explícitas o `PRAGMA foreign_keys`, que requiere revisión manual.

Después del commit vuelve a verificar integridad. Un fallo posterior al commit exige compensación aunque el comando termine con error.

## Base local nueva

Configurar `DATABASE_URL="file:./dev.db"`, dejar vacías las variables Turso y ejecutar:

```bash
npm install
npm run db:validate
npm run db:migrate:local:deploy
npm run db:migrate:local:status
```

La primera aplicación ejecuta todo el historial. Repetir `db:migrate:local:deploy` debe informar que no hay migraciones pendientes.

## Base SQLite existente

El baseline no debe ejecutarse sobre tablas existentes.

1. Detener escrituras de la aplicación y copiar el archivo `.db` junto con sus archivos `-wal` y `-shm`, o realizar antes `PRAGMA wal_checkpoint(TRUNCATE)` y copiar el archivo cerrado.
2. Probar la copia, no el original: abrirla, ejecutar `PRAGMA integrity_check;` y `PRAGMA foreign_key_check;` y conservar conteos de tablas críticas.
3. Comparar estructura contra el historial en un entorno aislado. La prueba automatizada del repositorio reproduce esta ruta; contra la copia seleccionada, `npx prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --exit-code` debe terminar con código 0 y sin diferencias.
4. Sólo si la estructura es equivalente, registrar el baseline sin ejecutarlo:

```bash
npx prisma migrate resolve --applied 00000000000000_baseline
npm run db:migrate:local:status
npm run db:migrate:local:deploy
```

5. Verificar lectura/escritura con Prisma, conteos e integridad. Si `resolve` o la comparación detectan diferencias, detenerse: no usar `db push`, no editar el baseline y no marcarlo a la fuerza. Documentar el drift y crear una reconciliación específica después de revisar datos y constraints.

## Crear una evolución futura

Trabajar contra una SQLite descartable o una copia de desarrollo, nunca contra Turso:

```bash
# Generar SQL sin aplicarlo
npm run db:migrate:local:create-only -- --name nombre_descriptivo

# Revisar migration.sql, riesgos, locks y compensación; luego aplicar localmente
npm run db:migrate:local:deploy
npm run db:migrate:test
```

También puede usarse `npm run db:migrate:local:create -- --name nombre_descriptivo` para generar y aplicar en desarrollo. Antes de aceptar el SQL hay que revisar pérdida de columnas, conversiones, defaults, recreación de tablas, índices, FKs y tiempo de bloqueo. Cambios destructivos requieren una migración por etapas: expandir, backfill verificable, cambiar consumidores y contraer en una entrega posterior.

## Turso: estado y base vacía

Prisma indica generar las migraciones sobre SQLite local; Turso indica aplicar el SQL resultante con sus herramientas porque Prisma Migrate e introspección no están soportados sobre Turso.

El estado es de sólo lectura y no crea el ledger:

```bash
npm run db:migrate:remote:status
```

Para una base Turso confirmadamente vacía, después del backup o snapshot exigido por el entorno:

```bash
# PowerShell: usar sólo durante esta operación
$env:MUSICBOX_MIGRATION_CONFIRM = "base-organizacion.turso.io"
npm run db:migrate:remote:apply -- 00000000000000_baseline
Remove-Item Env:MUSICBOX_MIGRATION_CONFIRM
```

El host debe ser el de `TURSO_DATABASE_URL`, sin protocolo ni token. `apply` se niega a ejecutar el baseline si encuentra tablas funcionales.

## Turso: adopción de una base existente

Esta operación requiere autorización humana y una ventana de mantenimiento.

1. Identificar por nombre la base y confirmar que no se está usando una credencial o alias ambiguo.
2. Detener o bloquear escrituras.
3. Crear un dump fuera del repositorio y comprobar que no esté vacío:

```bash
turso db shell <nombre-base> .dump > <ruta-segura>/musicbox-pre-migration.sql
```

Como alternativa, `turso db export <nombre-base> --output-file <ruta-segura>/musicbox.db` crea un snapshot, pero Turso advierte que el export puede no incluir los cambios más recientes. Para una copia restaurable también puede crearse otra base con `turso db create <copia> --from-db <origen>`; PITR permite sumar `--timestamp <RFC3339>` según el plan contratado.

4. Ejecutar `npm run db:migrate:remote:status`. Para una base previa al historial mostrará el baseline como pendiente.
5. Confirmar el host y adoptar:

```bash
$env:MUSICBOX_MIGRATION_CONFIRM = "base-organizacion.turso.io"
npm run db:migrate:remote:adopt -- 00000000000000_baseline
Remove-Item Env:MUSICBOX_MIGRATION_CONFIRM
```

`adopt` construye localmente el estado esperado en memoria y compara tablas, columnas, tipos, nulabilidad, defaults, PK, FKs e índices. Sólo entonces crea `_musicbox_migrations` y registra el checksum; no ejecuta el baseline. Una diferencia aborta sin mutar la base.

6. Volver a consultar estado, ejecutar `PRAGMA integrity_check;` y `PRAGMA foreign_key_check;`, comprobar conteos y realizar smoke tests de lectura/escritura antes de reabrir tráfico.

## Aplicar migraciones posteriores en Turso

Aplicar una migración por vez y en orden:

```bash
npm run db:migrate:remote:status
$env:MUSICBOX_MIGRATION_CONFIRM = "base-organizacion.turso.io"
npm run db:migrate:remote:apply -- <directorio-de-migracion>
Remove-Item Env:MUSICBOX_MIGRATION_CONFIRM
npm run db:migrate:remote:status
```

Si el runner rechaza una migración por `PRAGMA foreign_keys` o control transaccional, no se eliminan esos controles automáticamente. Revisar el SQL y su compensación, aplicar el archivo autorizado con `turso db shell <nombre-base> < prisma/migrations/<migracion>/migration.sql`, validar el resultado y recién entonces usar `remote:adopt` para registrar el checksum. Esa excepción debe quedar en el registro de cambio del entorno.

## Compensación y recuperación

No existen “down migrations” automáticas. SQLite y Turso pueden volver irreversible una pérdida lógica aunque el DDL termine correctamente.

Antes de intervenir, generar el plan no mutante asociado a la migración:

```bash
npm run db:migrate:compensation-plan -- <directorio-de-migracion>
```

El comando informa checksum y si existe un `compensation.sql` revisado, pero nunca lo ejecuta. El baseline no tiene SQL descendente: en una base nueva se descarta la base fallida; en una existente nunca se ejecuta el baseline y la recuperación se apoya en la copia previa.

- Si `apply` falla antes del commit, la transacción revierte SQL y ledger; investigar antes de reintentar.
- Si la migración aplicó pero la aplicación falla y el esquema es retrocompatible, revertir primero la aplicación y preparar una migración correctiva hacia adelante.
- Si hubo corrupción o pérdida, mantener el destino afectado aislado y restaurar en otra base desde dump, copia o PITR. Turso restaura PITR creando una base nueva; hay que validar y después cambiar la URL/token de la aplicación. No borrar la base anterior hasta cerrar el incidente.
- Si sólo el ledger es incorrecto, no editarlo manualmente. Comparar historial, checksum y estructura y usar `adopt` únicamente cuando el estado funcional ya coincide.

Toda intervención remota debe registrar: base nominal, operador, instante del backup, migración/checksum, comandos aprobados, resultados de integridad, conteos, smoke test y decisión de continuar o compensar.

## Verificación automatizada

```bash
npm run db:validate
npm run db:migrate:test
```

La suite usa archivos temporales y fuerza las variables Turso a valores locales controlados. Verifica:

- despliegue desde cero, estado sin pendientes y ausencia de drift contra Prisma;
- 16 tablas, 19 índices y `foreign_key_check` limpio;
- lectura/escritura mediante Prisma;
- preservación de múltiples `Rating` y `DiaryLog` para el mismo usuario/ítem;
- adopción local con `migrate resolve` sin ejecutar el baseline;
- aplicación/adopción del runner Turso, checksum, reejecución y rechazo del baseline sobre una base poblada.

La suite no usa `dev.db`, no carga credenciales reales y no conecta con Turso.

## Referencias oficiales

- [Prisma: baselining an existing database](https://www.prisma.io/docs/orm/prisma-migrate/workflows/baselining)
- [Turso: Prisma ORM](https://docs.turso.tech/sdk/ts/orm/prisma)
- [Turso CLI: database shell y dumps](https://docs.turso.tech/cli/db/shell)
- [Turso CLI: export](https://docs.turso.tech/cli/db/export)
- [Turso: point-in-time recovery](https://docs.turso.tech/features/point-in-time-recovery)

## Límites y riesgos residuales

- SQLite local y libSQL/Turso no son idénticos en operación, latencia, replicación, backup y disponibilidad de comandos. Una prueba local no sustituye un ensayo sobre una copia remota autorizada.
- El export de Turso puede estar retrasado; un dump con escrituras activas tampoco constituye por sí solo una ventana consistente.
- La comparación estructural no demuestra equivalencia semántica de todos los datos. Los conteos, invariantes del dominio y smoke tests siguen siendo obligatorios.
- DDL que exige desactivar FKs se rechaza para evitar una falsa garantía transaccional y necesita un plan específico.
- El warning de Prisma sobre `driverAdapters` deprecado ya existía y no se modifica en este cambio para no mezclar la adopción del historial con configuración funcional.
