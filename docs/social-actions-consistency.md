# Consistencia de acciones sociales

## Política

Follow, like y comentario son el efecto principal de sus respectivas operaciones.
La notificación social aplicable es un efecto obligatorio: ambos se escriben dentro de la
misma transacción y se confirman o revierten juntos. Las acciones del propietario sobre su
propio contenido no generan una notificación para sí mismo.

No se usa una cola, worker u outbox. Las transacciones son locales, cortas y no contienen
llamadas externas.

## Follow

`POST /api/users/:username/follow` crea la relación respaldada por
`UNIQUE(followerId, followingId)`. Sólo una creación exitosa inserta `NEW_FOLLOWER`.
Repetir el POST devuelve éxito con `changed: false`.

`DELETE /api/users/:username/follow` usa borrado por filtro. Si la relación no existe,
devuelve éxito con `changed: false`. Un follow posterior a un unfollow es una transición
nueva y puede generar otra notificación.

Las respuestas incluyen `following`, `changed` y `followersCount`.

## Like

`POST /api/reviews/:id/like` usa la PK compuesta `(userId, reviewId)` como invariante. Sólo
la transición nueva inserta `NEW_LIKE`. `DELETE` es idempotente y nunca crea notificación.

Las respuestas incluyen `liked`, `changed` y `likesCount`.

## Comentarios

Crear un comentario y su notificación `NEW_COMMENT` ocurre dentro de una transacción. Dos
comentarios con el mismo contenido siguen siendo acciones distintas.

El request acepta:

```json
{
  "content": "Comentario",
  "operationId": "UUID opcional"
}
```

`operationId` es opcional para mantener compatibilidad, pero el consumidor web siempre lo
envía. La combinación `(userId, operationId)` es única:

- la primera solicitud crea comentario y notificación y responde `201`;
- repetir exactamente la misma operación devuelve el comentario existente con `200` y
  `changed: false`;
- reutilizar la clave con otro review o contenido devuelve `409`;
- claves distintas permiten comentarios iguales.

El frontend conserva la misma clave ante un resultado incierto y genera una nueva si el
usuario cambia el contenido.

## Errores y concurrencia

- `400`: payload inválido, UUID inválido o auto-follow.
- `401`: sesión ausente o inválida.
- `404`: usuario o review inexistente.
- `409`: clave de idempotencia reutilizada con otro payload.
- `500`: error inesperado; la transacción revierte todos sus efectos.

Los conflictos de unicidad esperados se reconcilian consultando el estado final. Los
conflictos transitorios de escritura se reintentan como máximo tres veces. Los errores
inesperados no se convierten en éxito.

## Migración

`20260804120000_comment_idempotency` agrega `Comment.operationId` nullable y el índice único
`Comment_userId_operationId_key`. Los comentarios históricos permanecen en `NULL`; no se
deduplican, modifican ni eliminan.

## Verificación

```bash
npm run test:social
npm run db:migrate:test
```

Las pruebas usan SQLite/libSQL real y cubren repetición, concurrencia, autorización, recursos
inexistentes, fallos de cada escritura, rollback por fallo de notificación, reenvío tras
respuesta perdida, migración con datos existentes e integridad referencial.

