# Auditoría integral del backend — Ride The Music

## Hallazgos P0 y P1

No se identificaron hallazgos confirmados P0 dentro del alcance revisado. Esto no garantiza ausencia de vulnerabilidades críticas.

### RTM-SEC-001 — Next.js vulnerable permite omitir middleware y falsificar identidad

- **Severidad:** P1 — Alta
- **Categoría:** Vulnerabilidad confirmada
- **Confianza:** Alta
- **Ubicación:** `package.json:21`, `src/middleware.ts:55`, `src/app/api/reviews/route.ts:159`, `src/app/api/ratings/route.ts:4`
- **Evidencia:** Se usa Next.js `14.2.3`, afectado por el bypass de middleware [GHSA-f82v-jwr5-mffw](https://github.com/advisories/GHSA-f82v-jwr5-mffw). El middleware elimina `x-user-id` sólo cuando se ejecuta y luego lo inyecta desde el JWT. Los handlers de reseñas y ratings confían exclusivamente en ese header.
- **Comportamiento actual:** La autenticación de estos dos POST depende del middleware y no se vuelve a verificar dentro del handler.
- **Escenario de abuso:** Una petición que active el bypass conocido y envíe un `x-user-id` elegido puede crear reseñas o ratings como otro usuario. Los IDs se exponen en endpoints públicos de búsquedas y reseñas.
- **Impacto:** Suplantación en contenido, modificación de ratings ajenos, contaminación de datos y abuso de almacenamiento. No se confirmó acceso a contraseña o toma total de cuenta.
- **Causa probable:** Dependencia vulnerable más confianza implícita en headers internos.
- **Recomendación:** Actualizar primero a una versión corregida compatible —`npm audit` propone al menos `14.2.35`— y hacer que cada operación protegida valide la cookie/JWT mediante un helper común, sin usar un header como autoridad final.
- **Alcance estimado:** Medio.
- **Riesgo de corrección:** Medio por actualización de framework; bajo para la defensa adicional en handlers.
- **Pruebas requeridas:** Integración con middleware normal y omitido; header falsificado; token ausente, inválido y válido; verificación de que el actor persistido coincide con el JWT.
- **Dependencias:** Debe resolverse antes de confiar en otras pruebas de autorización.

### RTM-SEC-002 — La lista privada “escuchar después” es legible por cualquier usuario

- **Severidad:** P1 — Alta
- **Categoría:** Vulnerabilidad confirmada
- **Confianza:** Alta
- **Ubicación:** `src/app/api/listen-later/route.ts:68`, `src/utils/profile-tabs.ts:14`, `test/profile-tabs.test.ts:14`
- **Evidencia:** `GET /api/listen-later?username=...` sustituye el usuario autenticado por cualquier usuario encontrado y no comprueba propiedad. El código y el test de navegación denominan explícitamente privada a esta pestaña.
- **Comportamiento actual:** Una petición anónima con un username válido recibe toda la lista y los objetos musicales relacionados.
- **Escenario de abuso:** Enumerar usernames públicos y consultar sus preferencias privadas.
- **Impacto:** Divulgación horizontal de datos personales de uso.
- **Causa probable:** La restricción se implementó solamente en la UI.
- **Recomendación:** Exigir sesión y coincidencia entre `authUser.userId` y el usuario solicitado; considerar eliminar el parámetro `username` y usar siempre el sujeto autenticado.
- **Alcance estimado:** Pequeño.
- **Riesgo de corrección:** Bajo, salvo consumidores externos no documentados.
- **Pruebas requeridas:** Propietario permitido; anónimo y otro usuario rechazados; username inexistente; token expirado.
- **Dependencias:** RTM-TEST-012.

### RTM-FUNC-003 — El diario sobrescribe la escucha anterior

- **Severidad:** P1 — Alta
- **Categoría:** Defecto confirmado
- **Confianza:** Alta
- **Ubicación:** `src/app/api/diary/route.ts:47`, `README.md:13`, `implementation_plan.md:12`
- **Evidencia:** El requisito permite múltiples registros del mismo álbum. El POST busca la última fila y la actualiza, reemplazando fecha, nota y rating, mientras sólo incrementa `listenCount`.
- **Comportamiento actual:** Registrar una segunda escucha elimina el detalle histórico de la primera.
- **Escenario de fallo:** Un usuario escucha el mismo álbum en dos fechas con notas diferentes; sólo conserva la última.
- **Impacto:** Pérdida funcional de la característica central de diario.
- **Causa probable:** Se mezclaron dos conceptos: evento de escucha e historial agregado.
- **Recomendación:** Crear una fila por escucha. Si se necesita un contador agregado, calcularlo o mantenerlo como proyección separada.
- **Alcance estimado:** Medio; afecta endpoint, UI, estadísticas y posibles datos existentes.
- **Riesgo de corrección:** Medio por cambio semántico y posible backfill.
- **Pruebas requeridas:** Dos escuchas del mismo álbum producen dos entradas ordenadas; notas y fechas se preservan; concurrencia; fechas inválidas.
- **Dependencias:** RTM-DATA-008 y RTM-OPS-011.

### RTM-DATA-004 — Ratings duplicables por carrera de concurrencia

- **Severidad:** P1 — Alta
- **Categoría:** Defecto confirmado de integridad
- **Confianza:** Alta
- **Ubicación:** `prisma/schema.prisma:74`, `src/app/api/ratings/route.ts:43`, `src/app/api/reviews/route.ts:223`
- **Evidencia:** Existe un índice normal, no `UNIQUE`, sobre `(userId, musicItemId)`. Ambos flujos hacen `findFirst` seguido de `create`. Dos peticiones concurrentes pueden no encontrar fila y crear dos.
- **Comportamiento actual:** El sistema presupone un rating actual por usuario/ítem, pero la base no protege esa invariante.
- **Escenario de fallo:** Dos tabs o reintentos simultáneos registran el mismo rating.
- **Impacto:** Promedios inflados, valor “actual” ambiguo y actualizaciones sobre una fila arbitraria.
- **Causa probable:** Se usó un índice de rendimiento donde correspondía una restricción de identidad.
- **Recomendación:** Auditar y deduplicar datos, agregar `@@unique([userId, musicItemId])` y usar `upsert` o una escritura atómica.
- **Alcance estimado:** Medio, con migración y backfill.
- **Riesgo de corrección:** Medio-alto si producción ya contiene duplicados.
- **Pruebas requeridas:** Inserciones concurrentes, migración con duplicados, un único rating final y promedio correcto.
- **Dependencias:** RTM-OPS-011. La base local pequeña no contiene duplicados actualmente.

## Resumen ejecutivo

El backend tiene buenos controles locales, pero no está listo para considerarse endurecido para producción debido a cuatro hallazgos P1: bypass de autenticación, exposición de una lista privada, pérdida del historial del diario y una invariante de ratings no protegida.

| Severidad | Cantidad |
|---|---:|
| P0 | 0 |
| P1 | 4 |
| P2 | 10 |
| P3 | 2 |

### Principales fortalezas

- Cookies JWT `HttpOnly`, `Secure` en producción, `SameSite=Strict` y expiración.
- Controles de propiedad correctos en perfiles, listas, comentarios y notificaciones.
- Selecciones explícitas que evitan devolver contraseña/email en perfiles públicos.
- Claves foráneas y cascadas presentes; constraints útiles en follows, likes, listas, favoritos y listen-later.
- Cliente Prisma reutilizado globalmente.
- TypeScript estricto, lint operativo y una suite rápida determinista.
- `.env` y bases locales no están versionados.

Los cinco riesgos principales son RTM-SEC-001, RTM-SEC-002, RTM-FUNC-003, RTM-DATA-004 y la ingesta no acotada/no atómica de playlists.

### Evaluación general

- **Mantenibilidad:** Media-baja; handlers extensos, 28 módulos con Prisma directo y autenticación duplicada en 14 handlers.
- **Seguridad:** Insuficiente para producción hasta resolver los P1 y actualizar Next.js.
- **Datos:** Buen uso parcial de FKs/uniqueness, pero faltan invariantes, migraciones y unidades transaccionales.
- **Rendimiento:** Adecuado para los datos locales actuales; existen lecturas sin cota, N+1 y planes con ordenamiento temporal.
- **Pruebas:** Buenas para utilidades/UI, insuficientes para backend, seguridad, persistencia y concurrencia.

## Mapa del backend

- **Superficie:** 34 archivos `route.ts` y 48 métodos HTTP. No se encontraron Server Actions, workers, colas ni cron.
- **Autenticación:** JWT HS256 en cookie; middleware inyecta headers para parte de las escrituras y otros handlers releen la cookie.
- **Dominios:** auth, usuarios/perfiles, reviews/ratings, diario, follows, comentarios/likes, listas, listen-later, notificaciones, catálogo musical, artistas y eventos.
- **Datos:** Prisma 7.8 + adaptador libSQL; SQLite local y configuración para Turso. No hay migraciones versionadas.
- **Integraciones:** Dos implementaciones separadas para Deezer, con políticas de cache y errores diferentes.
- **Límites de confianza:** navegador → Route Handler → Prisma/Turso; navegador → endpoints públicos → Deezer.
- **Errores:** mayormente `try/catch` local con JSON ad hoc; el modelo `AppError` sólo se usa en eventos.
- **Cache:** LRU en memoria para home search; `unstable_cache` por una hora para stats/recap; abundante `no-store`.
- **Observabilidad:** `console.error`/`console.log`; sin correlación, métricas estructuradas ni trazas.
- **Pruebas:** 36 tests Node/TS; predominan utilidades y comprobaciones estáticas de archivos.

### Investigación del síntoma de sesión

La causa histórica quedó confirmada por el commit `ecaaa87`: Navbar y BottomNav consultaban `/api/auth/me` una sola vez al montarse; al persistir el layout durante la navegación, el estado anónimo podía sobrevivir al login.

El código actual añadió:

- sesión leída en el layout;
- `router.replace("/")` seguido de `router.refresh()`;
- `/api/auth/me` con `no-store`;
- props `initialUser`.

Esto es una corrección razonable, pero no está verificada conductualmente. El test sólo busca cadenas mediante regex. Además, `replace()` y `refresh()` se despachan sin esperar una navegación observable, y `/api/auth/me` convierte cualquier error interno en `{user:null}`. Por tanto, la causa original está documentada, pero no puede confirmarse que el síntoma esté cerrado en runtime.

## Hallazgos P2

### RTM-SEC-005 — Las sesiones no pueden revocarse

- **Severidad:** P2
- **Categoría:** Riesgo potencial
- **Confianza:** Alta sobre el control ausente; media sobre explotación
- **Ubicación:** `src/utils/auth.ts:15`, `src/app/api/auth/logout/route.ts:3`, `src/app/api/users/[username]/password/route.ts:57`
- **Evidencia:** JWT válido por siete días; logout sólo borra la cookie local; cambiar contraseña no invalida tokens emitidos.
- **Comportamiento actual:** Un token copiado sigue vigente tras logout o cambio de contraseña.
- **Escenario:** Robo previo de cookie/token.
- **Impacto:** Persistencia de acceso no deseado durante hasta siete días.
- **Causa:** Sesión completamente stateless sin versión ni registro revocable.
- **Recomendación:** Incorporar versión de sesión/credenciales o sesiones persistentes revocables, con rotación al cambiar contraseña.
- **Alcance:** Medio.
- **Riesgo de corrección:** Medio; afecta todos los tokens existentes.
- **Pruebas:** Revocación, expiración, cambio de contraseña, logout en varias sesiones.
- **Dependencias:** Requiere decisión de producto sobre sesiones múltiples.

### RTM-DATA-006 — Guardar playlists acepta carga no acotada y deja estados parciales

- **Severidad:** P2
- **Categoría:** Riesgo potencial y defecto de atomicidad
- **Confianza:** Alta
- **Ubicación:** `src/app/api/lists/save-playlist/route.ts:27`
- **Evidencia:** No limita `tracks`, confía en objetos del cliente, crea primero la lista, hace upserts secuenciales y finalmente `createMany`. Evita además el límite de 100 ítems del endpoint ordinario.
- **Comportamiento actual:** Un error intermedio deja lista o MusicItems persistidos; un usuario puede enviar arreglos muy grandes.
- **Escenario:** IDs repetidos, elemento malformado o miles de tracks.
- **Impacto:** Respuestas 500 con escritura parcial, listas vacías y consumo de DB/CPU.
- **Causa:** Se trata un payload cliente como DTO de Deezer confiable y no se define una transacción.
- **Recomendación:** Esquema estricto, máximo de 100 elementos, deduplicación y transacción única compatible con libSQL.
- **Alcance:** Medio.
- **Riesgo:** Medio por duración de la transacción.
- **Pruebas:** Payload malformado/grande, duplicados, rollback y límite concurrente.
- **Dependencias:** RTM-OPS-011.

### RTM-FUNC-007 — Acciones sociales no son idempotentes ni atómicas

- **Severidad:** P2
- **Categoría:** Defecto confirmado
- **Confianza:** Alta
- **Ubicación:** `src/app/api/users/[username]/follow/route.ts:53`, `src/app/api/reviews/[id]/like/route.ts:43`, `src/app/api/reviews/[id]/comments/route.ts:40`
- **Evidencia:** `follow.upsert()` siempre devuelve una fila, por lo que cada repetición crea una notificación. Likes y comentarios se escriben antes de su notificación y fuera de una transacción.
- **Comportamiento actual:** Reintentos pueden duplicar notificaciones o devolver 500 aunque la acción principal haya sido aplicada.
- **Escenario:** Doble clic, retry del cliente o fallo al insertar la notificación.
- **Impacto:** Spam, experiencia inconsistente y resultados inciertos.
- **Causa:** El evento “transición nueva” no está modelado separadamente del estado final.
- **Recomendación:** Transacción; notificar sólo cuando se creó realmente la relación; definir idempotencia por actor/recurso/tipo.
- **Alcance:** Medio.
- **Riesgo:** Bajo-medio.
- **Pruebas:** Repeticiones, fallo de notificación y concurrencia.
- **Dependencias:** RTM-DATA-004 comparte el mismo patrón check-then-write.

### RTM-DATA-008 — Validación y constraints no protegen invariantes

- **Severidad:** P2
- **Categoría:** Riesgo de integridad
- **Confianza:** Alta
- **Ubicación:** `src/app/api/diary/route.ts:27`, `src/app/api/reviews/route.ts:169`, `prisma/schema.prisma:57`
- **Evidencia:** Diario no valida rango/pasos del rating ni fecha válida; reviews no verifican tipo o longitud de contenido. La base carece de `CHECK` para ratings, slots, tipos de música y fechas de eventos.
- **Comportamiento actual:** Entradas inválidas pueden producir 500 o persistir valores fuera del dominio.
- **Escenario:** `ratingValue=999`, fecha inválida, contenido no-string o payload enorme.
- **Impacto:** Datos incoherentes y abuso de recursos.
- **Causa:** Reglas dispersas y protección sólo parcial en aplicación.
- **Recomendación:** DTOs validados en cada límite y constraints equivalentes en DB cuando SQLite los soporte.
- **Alcance:** Medio-alto por migración.
- **Riesgo:** Medio si existen datos incompatibles.
- **Pruebas:** Límites, tipos, NaN, fechas, payloads grandes y constraints directos.
- **Dependencias:** RTM-OPS-011. La DB local no contiene actualmente valores inválidos.

### RTM-PERF-009 — Colecciones sin cota, N+1 y consultas que ordenan temporalmente

- **Severidad:** P2
- **Categoría:** Oportunidad de rendimiento
- **Confianza:** Alta sobre el patrón; impacto productivo no medido
- **Ubicación:** `src/app/api/lists/route.ts:99`, `src/app/api/reviews/[id]/comments/route.ts:91`, `src/app/api/notifications/route.ts:21`, `src/services/music.ts:69`
- **Evidencia:** Listas, comentarios, diario y listen-later no tienen paginación. Detalle musical carga todos los ratings/reviews. Notificaciones realiza una consulta de usuario por notificación.
- **Planes SQLite:** Feed reciente y listas públicas hacen `SCAN` + `TEMP B-TREE`; notificaciones usan índice parcial pero ordenan en B-tree temporal. El índice de diario sí satisface su acceso.
- **Comportamiento actual:** Trabajo y serialización crecen con el historial.
- **Escenario:** Usuario popular, review con muchos comentarios o álbum con muchas reseñas.
- **Impacto:** Latencia, memoria y costo de Turso.
- **Causa:** Los contratos no definen límites ni cursores.
- **Recomendación:** Paginación estable, `_count`/agregados, relación de `sourceUser` o consulta batched, selección mínima y medición antes de agregar índices.
- **Alcance:** Medio por cambios de contrato.
- **Riesgo:** Medio.
- **Pruebas:** Paginación, orden estable, límites máximos y dataset representativo.
- **Dependencias:** Los índices deben decidirse con métricas reales, no sólo con la DB local.

### RTM-INT-010 — Deezer carece de timeout y tiene contratos de fallo contradictorios

- **Severidad:** P2
- **Categoría:** Riesgo potencial
- **Confianza:** Alta
- **Ubicación:** `src/services/deezer.ts:66`, `src/services/deezer.service.ts:24`, `src/app/api/music/route.ts:6`
- **Evidencia:** Ninguno de los fetches servidor usa timeout. `index` y `limit` se reenvían sin cota. Una implementación devuelve `[]`/`null`; la otra lanza `AppError`.
- **Comportamiento actual:** Una dependencia lenta puede retener requests; una caída suele presentarse como catálogo vacío con HTTP 200.
- **Escenario:** Deezer no responde, devuelve payload malformado o un usuario solicita límites extremos.
- **Impacto:** Saturación, fallos difíciles de detectar y UX engañosa.
- **Causa:** Dos clientes evolucionaron con políticas distintas.
- **Recomendación:** Unificar política mínima: límites, `AbortSignal.timeout`, validación de respuesta y error/resultado parcial explícito.
- **Alcance:** Medio.
- **Riesgo:** Medio por cambio de contrato.
- **Pruebas:** Timeout, 429/5xx, JSON inválido, respuesta parcial y límites.
- **Dependencias:** RTM-ARCH-013.

### RTM-OPS-011 — No existe historial de migraciones reproducible

- **Severidad:** P2
- **Categoría:** Riesgo de datos y operación
- **Confianza:** Alta
- **Ubicación:** `prisma.config.ts:7`, `scripts/push-to-turso.ts:14`
- **Evidencia:** `prisma/migrations` no existe. El script genera un diff `--from-empty` y ejecuta todas las sentencias sobre Turso.
- **Comportamiento actual:** Puede inicializar una base vacía, pero no evolucionar de forma segura una base existente ni demostrar rollback.
- **Escenario:** Desplegar un nuevo constraint o columna sobre producción.
- **Impacto:** Deploy fallido, cambios manuales o riesgo de incompatibilidad/pérdida.
- **Causa:** El esquema se usa como snapshot, no como historial operacional.
- **Recomendación:** Baseline controlado, migraciones incrementales, prueba sobre copia representativa y procedimiento de rollback/compensación.
- **Alcance:** Alto.
- **Riesgo:** Alto si se improvisa sobre producción.
- **Pruebas:** Upgrade desde cada versión soportada, datos existentes, rollback y restauración.
- **Dependencias:** Bloquea correcciones de RTM-DATA-004 y RTM-DATA-008.

### RTM-TEST-012 — La suite no ejerce el backend real

- **Severidad:** P2
- **Categoría:** Deuda técnica
- **Confianza:** Alta
- **Ubicación:** `test/`, `test/auth-session-sync.test.ts:8`
- **Evidencia:** No hay tests que invoquen handlers con DB real/efímera. El test de sesión valida regex, no cookies, navegación ni render.
- **Comportamiento actual:** La suite pasa aunque existan IDOR, carreras, sobrescritura del diario o bypass de middleware.
- **Escenario:** Una refactorización conserva los textos buscados pero rompe el comportamiento.
- **Impacto:** Baja detectabilidad de regresiones críticas.
- **Causa:** Pruebas orientadas a presencia de implementación.
- **Recomendación:** Integración sobre SQLite efímero para API/datos y pocos E2E para auth; mantener unitarios para lógica pura.
- **Alcance:** Medio-alto incremental.
- **Riesgo:** Bajo.
- **Pruebas:** Detalladas en la matriz posterior.
- **Dependencias:** Debe acompañar cada etapa de remediación.

### RTM-ARCH-013 — Autenticación, Prisma y errores están dispersos

- **Severidad:** P2
- **Categoría:** Deuda técnica
- **Confianza:** Alta
- **Ubicación:** `src/app/api/users/[username]/route.ts:11`, `src/app/api/reviews/route.ts:9`, `src/utils/errors.ts:1`
- **Evidencia:** 28 archivos importan acceso DB directamente y 14 redefinen `getAuthUser`; los handlers de usuarios/reviews coordinan reglas, IO externo, transacciones, badges y notificaciones.
- **Comportamiento preservado:** Contratos HTTP, reglas actuales y Prisma/libSQL.
- **Responsabilidad mal ubicada:** Auth y casos de uso se repiten en presentación; errores y Deezer tienen dos políticas.
- **Alternativa mínima:** Helper único de identidad, funciones por caso de uso para operaciones multiescritura y acceso a datos sólo donde una consulta concreta lo justifique.
- **Beneficio:** Menos divergencias, pruebas más directas y transacciones visibles.
- **Costo/trade-off:** Más módulos y migración incremental; no justifica Clean Architecture ni repositorios genéricos.
- **Alcance:** Alto pero divisible.
- **Riesgo:** Medio sin tests de caracterización.
- **Pruebas:** Contratos antes/después y errores esperados.
- **Dependencias:** RTM-TEST-012.

### RTM-CACHE-014 — Stats y recap permanecen obsoletos hasta una hora

- **Severidad:** P2
- **Categoría:** Defecto potencial de consistencia
- **Confianza:** Alta sobre la caché; media sobre expectativa UX
- **Ubicación:** `src/app/api/users/[username]/stats/route.ts:93`, `src/app/api/users/[username]/recap/route.ts:101`
- **Evidencia:** Caché de 3600 segundos con tags globales; no existe `revalidateTag` o `revalidatePath` tras escribir reviews/ratings.
- **Comportamiento actual:** `cache: no-store` del cliente no evita la caché interna del servidor.
- **Escenario:** Crear una reseña y abrir inmediatamente las estadísticas.
- **Impacto:** Conteos y recap temporalmente inconsistentes.
- **Causa:** Cache agregada sin política de invalidación.
- **Recomendación:** Confirmar SLA de frescura; invalidar tags por usuario/año o retirar caché hasta medir la consulta.
- **Alcance:** Pequeño-medio.
- **Riesgo:** Bajo, con posible aumento de carga.
- **Pruebas:** Escritura seguida de lectura y expiración controlada.
- **Dependencias:** Medición de RTM-PERF-009.

## Hallazgos P3

### RTM-CONTRACT-015 — Errores internos se presentan como estados válidos

- **Severidad:** P3
- **Categoría:** Mejora de contrato/observabilidad
- **Confianza:** Alta
- **Ubicación:** `src/app/api/auth/me/route.ts:40`, `src/app/api/music/route.ts:26`
- **Evidencia:** `/auth/me` responde `200 user:null` ante cualquier excepción; música responde `200 []` cuando falla la dependencia.
- **Comportamiento actual:** El cliente no distingue logout, catálogo vacío y caída interna.
- **Escenario:** Error de DB durante sesión o fallo de Deezer.
- **Impacto:** Síntomas engañosos y diagnóstico difícil.
- **Causa:** `catch` genérico orientado a que la UI no falle.
- **Recomendación:** Mantener mensajes seguros, pero diferenciar 401, 502/503 y 500 con códigos estables y correlación.
- **Alcance:** Medio por consumidores.
- **Riesgo:** Medio si el frontend no contempla estados nuevos.
- **Pruebas:** Fallo de DB/proveedor y contrato de error.
- **Dependencias:** RTM-INT-010 y RTM-ARCH-013.

### RTM-DEBT-016 — Dependencias y código sin consumidores

- **Severidad:** P3
- **Categoría:** Mejora menor
- **Confianza:** Alta para referencias estáticas
- **Ubicación:** `package.json:20`, `src/services/music-event.service.ts:21`, `src/repositories/music-event.repository.ts:14`
- **Evidencia:** `jsonwebtoken` y sus tipos no tienen consumidores; se usa `jose`. `getTodayEventOrThrow` y `findById` no tienen referencias.
- **Comportamiento actual:** Sin defecto funcional observado.
- **Escenario:** Mantenimiento o auditoría de dependencias innecesariamente amplia.
- **Impacto:** Superficie y ruido menores.
- **Causa:** Evolución incompleta entre implementaciones.
- **Recomendación:** Confirmar que no hay uso externo/dinámico y retirar de forma independiente.
- **Alcance:** Pequeño.
- **Riesgo:** Bajo.
- **Pruebas:** Type-check, suite y build.
- **Dependencias:** Ninguna.

## Quick wins

1. Acotar y validar `limit`, `index`, longitudes y tipos en búsquedas/notificaciones.
2. Eliminar el campo `tracks` no utilizado de la consulta de estadísticas.
3. Sustituir el N+1 de usuarios origen de notificaciones por una consulta batched o relación explícita.
4. Crear notificación de follow sólo cuando la relación cambia realmente.
5. Centralizar el helper exacto de cookie/JWT ya existente, sin rediseñar la arquitectura.
6. Retirar `jsonwebtoken` y helpers muertos tras confirmar consumidores.
7. Agregar pruebas negativas para listen-later y validaciones antes de modificar contratos.

No se consideran quick wins la migración de ratings, la revocación completa de sesiones ni la estrategia de migraciones.

## Mejoras estructurales

- **Autenticación incremental:** una sola función de identidad y autorización explícita por recurso. Detenerse cuando ningún handler protegido dependa de headers confiables.
- **Casos de uso multiescritura:** reviews, playlists y acciones sociales con transacción/idempotencia visible. Detenerse cuando cada operación tenga una unidad de consistencia definida.
- **Cliente Deezer único:** conservar contratos públicos y unificar timeout, validación y fallos. No agregar una interfaz si no se necesita para tests o variación.
- **Persistencia versionada:** baseline más migraciones incrementales; detenerse cuando un upgrade desde la versión desplegada pueda probarse y compensarse.
- **Contratos de colecciones:** paginación y límites compatibles, empezando por las superficies de mayor crecimiento.

## Matriz de pruebas faltantes

| Comportamiento | Riesgo | Nivel | Positivos | Negativos/límites | Módulos |
|---|---|---|---|---|---|
| Middleware y actor autenticado | P1 | Integración/seguridad | JWT válido | bypass, headers falsos, token inválido | middleware, reviews, ratings |
| Privacidad listen-later | P1 | Integración | propietario | anónimo, otro usuario | listen-later |
| Login y sincronización visual | P1/P2 | E2E | login/logout | cookie expirada, fallo `/me`, navegación persistente | auth, layout, Navbar |
| Diario histórico | P1 | Integración DB | varias escuchas | fecha/rating inválidos, concurrencia | diary, DiaryLog |
| Rating único | P1 | Concurrencia/migración | create/update | dos requests simultáneos, datos duplicados | Rating, reviews |
| Playlist importada | P2 | Integración | hasta 100 tracks | duplicados, 101+, payload inválido, rollback | lists/save-playlist |
| Like/follow/comment | P2 | Integración | transición única | retry, fallo de notificación | social/Notification |
| Validación | P2 | Contrato | valores válidos | tipos, tamaños, Unicode, NaN | todos los POST/PUT |
| Deezer | P2 | Integración con stub | respuesta válida/parcial | timeout, 429, 5xx, JSON inválido | servicios Deezer |
| Migraciones | P2 | Migración | upgrade | rollback, datos incompatibles | Prisma/Turso |
| Paginación | P2 | Integración/performance | primera/siguiente página | límites, orden empatado | listas, comentarios, diario |

## Plan de remediación priorizado

### 1. Seguridad inmediata

- **Hallazgos:** RTM-SEC-001, RTM-SEC-002.
- **Validación:** Pruebas de bypass y autorización horizontal.
- **Criterio de finalización:** Ningún handler confía en identidad falsificable; listen-later sólo es visible al dueño.

### 2. Integridad y defectos funcionales

- **Hallazgos:** RTM-FUNC-003, RTM-DATA-004, RTM-DATA-006 y RTM-DATA-008.
- **Dependencia:** Baseline de datos y diseño de migración.
- **Criterio de finalización:** Diario histórico preservado, rating único y operaciones atómicas.

### 3. Red de protección

- **Hallazgo:** RTM-TEST-012.
- **Criterio de finalización:** Integración real para auth, DB, permisos, concurrencia y contratos críticos.

### 4. Rendimiento y resiliencia

- **Hallazgos:** RTM-PERF-009, RTM-INT-010, RTM-CACHE-014.
- **Criterio de finalización:** Colecciones acotadas, timeouts, métricas y planes verificados con datos representativos.

### 5. Refactor de alto valor

- **Hallazgos:** RTM-ARCH-013, RTM-CONTRACT-015.
- **Criterio de finalización:** Políticas comunes sin alterar comportamiento público no acordado.

### 6. Limpieza

- **Hallazgo:** RTM-DEBT-016.
- **Criterio de finalización:** Dependencias y código muerto retirados con suite, type-check y build aprobados.

## Validaciones ejecutadas

| Comando/check | Resultado |
|---|---|
| `npm run lint` | Exit 0; sin errores. Advertencias de `<img>` y hooks, mayormente frontend. |
| `npx tsc --noEmit --incremental false` | Exit 0. |
| `npx tsx --test test/*.test.ts` | 36/36 tests aprobados. |
| `npx prisma validate` | Exit 0; warning por `driverAdapters` deprecado. |
| `npm audit --omit=dev --json` | Exit 1: 7 paquetes afectados; 1 crítico, 2 altos, 4 moderados. Next.js es dependencia runtime directa afectada. |
| Inspección `sqlite_master` | FKs e índices reales coinciden con el snapshot actual; no hay tabla de migraciones. |
| `PRAGMA foreign_key_check` | Sin violaciones en la DB local. |
| Consultas agregadas de integridad | Sin ratings duplicados/inválidos en la DB local actual, que sólo contiene 1 usuario y pocos registros. |
| `EXPLAIN QUERY PLAN` | Confirmó scans/ordenamientos temporales indicados en RTM-PERF-009. |
| `git status` antes/después | Limpio: `main...origin/main`; no quedaron cambios de la auditoría. |

No se ejecutó `build` para evitar mutar el `.next` preexistente. Tampoco se ejecutaron seeds, `db push`, `db:push-turso` ni operaciones de escritura durante la auditoría.

## Áreas no verificadas y riesgo residual

- **Producción/Turso:** No se inspeccionaron datos, schema aplicado, configuración, permisos, backups ni restauraciones.
- **Runtime de sesión:** No se realizó login con credenciales ni E2E; falta confirmar la corrección en navegador.
- **Proxy/hosting:** No se verificó cómo sanea IPs o headers Vercel u otro proxy.
- **Volumen:** No hay métricas de tráfico, cardinalidad o latencia productiva.
- **Rate limiting:** El mapa en memoria es por instancia; su efectividad distribuida no pudo verificarse.
- **Dependencias:** `npm audit` confirma versiones afectadas, pero no se intentaron exploits ni se validó cada advisory contra la topología desplegada.
- **Deezer:** No se hicieron pruebas activas de degradación o carga.
- **Recuperación:** No existe evidencia de backup/restauración probada, RPO/RTO o retención.
- **Consumidores externos:** Sólo se verificaron referencias dentro del repositorio; no hay especificación pública de API ni inventario externo.

## Cierre

- **Confirmado:** El repositorio presenta cuatro hallazgos P1, diez P2 y dos P3 respaldados por código, configuración, base local o comandos ejecutados.
- **Inferido:** El impacto de rendimiento y parte de los escenarios de abuso dependen del volumen y de la topología productiva no disponible.
- **Supuestos:** No se asumieron tráfico, SLA, RPO/RTO ni contenido de producción.
- **Estado:** Requiere cambios antes de producción, priorizando RTM-SEC-001 y RTM-SEC-002.
- **Integridad de la auditoría:** La auditoría original no modificó código ni datos. Este archivo es el único artefacto documental creado posteriormente por solicitud expresa.
