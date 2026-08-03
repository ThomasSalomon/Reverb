# Importacion atomica de playlists

## Contrato

`POST /api/lists/save-playlist` requiere una sesion valida y `Content-Type: application/json`.
El body se lee de forma acotada y no puede superar 256 KiB.

```json
{
  "title": "Nombre de la playlist",
  "description": "Descripcion opcional",
  "ticket": "<ticket firmado entregado por /api/events/today/tracks>",
  "tracks": [
    {
      "externalId": "3135556",
      "type": "SONG"
    }
  ]
}
```

El objeto raiz no admite otros campos. `title` es obligatorio, se normaliza con `trim` y
acepta hasta 100 caracteres. `description` puede omitirse, ser `null` o texto de hasta 500
caracteres. `tracks` debe contener entre 1 y 100 entradas antes de deduplicar. Cada entrada
admite solamente un `externalId` decimal positivo, expresado como string y de hasta 20
digitos, y `type`, cuyo unico valor valido es `SONG`.

El limite de 100 se rechaza con `413`; nunca se trunca el array. Los duplicados se resuelven
por `(type, externalId)`, conservando la primera aparicion y compactando `order` desde cero.
Titulos iguales con IDs distintos no son duplicados.

## Origen confiable de metadata

`GET /api/events/today/tracks` obtiene las pistas de Deezer en el servidor y devuelve un
ticket HS256 con issuer y audience especificos, vencimiento de 15 minutos y la metadata
validada. El guardado verifica firma, expiracion y pertenencia de cada ID solicitado. El
navegador no puede proporcionar titulo, artista ni portada y esos campos no se toman como
datos autenticos del cliente.

El endpoint de guardado no llama a Deezer. Si Deezer falla, el endpoint de origen no emite
un ticket; por lo tanto no se inicia ninguna importacion ni transaccion. Un ticket alterado,
vencido o que no contiene un ID solicitado se rechaza antes de escribir.

## Persistencia e identidad

La importacion ejecuta dentro de una unica transaccion interactiva:

1. el conteo de listas del actor y el limite de 50;
2. una consulta de todos los `MusicItem` candidatos;
3. una insercion en bloque de los elementos faltantes;
4. la creacion de `List` con el `userId` derivado de la cookie firmada;
5. una insercion en bloque de todas las relaciones con su orden.

Una excepcion en cualquier etapa aborta todo el trabajo, incluidos los `MusicItem` nuevos.
Las respuestas se construyen con los IDs de relaciones devueltos por la base y se envian
solo despues de que la transaccion confirma.

Las canciones nuevas usan `deezer:track:<externalId>`. Para compatibilidad se reutiliza un
ID numerico legado cuando ya representa una `SONG`; si ese ID representa un `ALBUM`, se crea
la identidad namespaced sin mezclar tipos. La metadata de un `MusicItem` existente nunca se
actualiza desde la importacion. La restriccion existente unica sobre
`ListItem(listId, musicItemId)` permanece como defensa final contra duplicados.

## Concurrencia e idempotencia

Los conflictos transitorios de unicidad o escritura se reintentan hasta tres veces, siempre
repitiendo la transaccion completa. Dos importaciones simultaneas comparten `MusicItem` y
cada lista queda completa. El limite de 50 listas tambien se decide dentro de la transaccion.

No existe una identidad de playlist externa ni una regla de unicidad por titulo. Por eso dos
solicitudes validas con el mismo titulo crean intencionalmente dos listas distintas. El
endpoint no es idempotente frente a reintentos del cliente.

## Respuestas y verificacion

- `201`: `{ "list": ... }`, con relaciones y `MusicItem` en orden persistido.
- `400`: JSON, DTO, ticket, pista o campo invalido.
- `401`: sesion ausente o invalida.
- `403`: limite de 50 listas alcanzado.
- `409`: la identidad namespaced ya existe con un tipo incompatible.
- `413`: body mayor a 256 KiB o mas de 100 pistas.
- `500`: fallo inesperado de persistencia, sin detalles internos.

Ejecutar la suite especifica con:

```bash
npm run test:playlists
```

La suite usa SQLite/libSQL real y cubre 1, varias, 100 y 101 pistas; body grande; contratos
invalidos; tickets alterados; deduplicacion; reuse y colisiones de `MusicItem`; ownership;
fallos inyectados en cada etapa; concurrencia entre usuarios; borde concurrente del limite
de listas; rollback y cantidad acotada de consultas.

