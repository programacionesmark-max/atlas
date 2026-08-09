# Protocolo Socket.IO

## Objetivos

- comandos pequeños que expresan intención;
- eventos ordenados y recuperables;
- validación runtime compartida con Zod;
- reintentos idempotentes y errores estables;
- compatibilidad explícita mediante versión de protocolo;
- cero confianza en actor, dinero, ownership, tirada o destino proporcionados por cliente.

## Contrato disponible en Phase 1

La fuente de verdad compilable es `packages/shared/src/protocol.ts`. La primera versión usa el namespace Socket.IO por defecto y rooms internas nombradas por `roomId`; el cliente no decide el join interno. Expone:

- sesión: `session:create`, `session:resume`, `ping`;
- discovery/room: `rooms:list`, `room:create`, `room:join`, `room:quickPlay`, `room:leave`;
- lobby: `lobby:setReady`, `lobby:updatePlayer`, `lobby:updateSettings`, `lobby:start`, `lobby:kick`;
- juego/social: `game:action`, `chat:send`, `player:emote`;
- server push: `room:state`, `rooms:changed`, eventos de player/host, `game:started`, `game:state`, `game:event`, `chat:message`, `emote:shown`, `room:kicked`, `server:error`.

`game:action` usa `{ roomId, action: { actionId, expectedVersion, type, payload? } }`. El server deriva actor de la sesión, serializa por room y emite un `game:state` autoritativo completo más `game:event` con sequence. Esta es una base funcional, pero aún no implementa el catch-up por batches, receipts duraderos ni `game:resync` que se diseñan abajo para Phase 4/12.

## Evolución objetivo antes del gate MVP

La siguiente especificación endurece el contrato sin invalidar el principio actual. Los nombres nuevos (`game:command`, `game:snapshot`, `game:events`) son objetivo de la evolución versionada; no deben documentarse como ya expuestos hasta actualizar `@circuit/shared`, server y web juntos. En esa evolución, las rooms internas usarán prefijos `room:{roomId}`, `game:{gameId}` y `user:{sessionId}`.

## Handshake

El cliente conecta con cookie de sesión segura o credencial de acceso corta y declara `protocolVersion`. El server valida origin, sesión, versión y límites antes de aceptar. Responde:

```ts
type ConnectionReady = {
  protocolVersion: 1;
  connectionId: string;
  session: { sessionId: string; userId?: string; guest: boolean };
  serverTime: string;
  heartbeatMs: number;
};
```

Un `socket.id` identifica una conexión, nunca un jugador persistente. La relación duradera es sesión → `RoomMember`/`GamePlayer`.

## Envelope de comando

```ts
type GameCommandEnvelope = {
  protocolVersion: 1;
  commandId: string; // UUID creado una vez por intención
  gameId: string;
  expectedVersion: number;
  sentAt: string; // observabilidad, no autoridad de tiempo
  command:
    | { type: 'ROLL_DICE' }
    | { type: 'BUY_PROPERTY'; propertyId: string }
    | { type: 'PLACE_BID'; auctionId: string; amount: number }
    | { type: 'PASS_AUCTION'; auctionId: string }
    | { type: 'END_TURN' };
};
```

El server deriva `actorId` de la sesión. Reenviar el mismo `commandId` devuelve el resultado almacenado y no vuelve a aplicar efectos. Reutilizar un `commandId` con bytes/payload diferentes se rechaza como abuso.

## ACK del comando

```ts
type CommandResult =
  | {
      ok: true;
      commandId: string;
      gameId: string;
      acceptedVersion: number;
      firstSequence: number;
      lastSequence: number;
    }
  | {
      ok: false;
      commandId: string;
      code: PublicErrorCode;
      retryable: boolean;
      currentVersion?: number;
      details?: Record<string, string | number | boolean>;
    };
```

El ACK confirma decisión/commit, no sustituye eventos. Si el ACK se pierde, el retry idempotente recupera el mismo resultado.

## Eventos cliente → servidor (objetivo)

| Evento                  | Payload esencial                     | Autoridad/validación                          |
| ----------------------- | ------------------------------------ | --------------------------------------------- |
| `session:resume`        | credencial de reconexión             | hash/expiración/rotación y vínculo de jugador |
| `matchmaking:quickPlay` | modo/mapa/rango permitidos           | server encuentra o crea room                  |
| `matchmaking:cancel`    | requestId                            | dueño de la solicitud                         |
| `room:create`           | nombre, access, settings             | schema, límites, password y code server-side  |
| `room:list`             | filtros + cursor                     | filtros permitidos y paginación limitada      |
| `room:join`             | code/roomId, password opcional       | capacidad, ban, estado y hash de password     |
| `room:leave`            | roomId                               | membresía y host migration                    |
| `room:updateSettings`   | revision + patch                     | solo host, lobby, whitelist y rango           |
| `room:setReady`         | boolean                              | membresía y slot de jugador                   |
| `room:customize`        | avatar/color/token/emote IDs         | ownership y colisión de color/token           |
| `room:start`            | roomId + revision                    | host, ready, tamaño y config válida           |
| `game:command`          | envelope tipado                      | cola + engine autoritativo                    |
| `game:resync`           | gameId + afterSequence               | autorización y ventana de retención           |
| `chat:send`             | scope, clientMessageId, text/quickId | rate, length, sanitize, mute/ban              |
| `emote:send`            | gameId, emoteId                      | ownership, cooldown y fase permitida          |

Cada llamada usa callback ACK con timeout del cliente. Nunca hay un evento llamado genéricamente `updateState` desde cliente.

## Eventos servidor → cliente (objetivo)

| Evento             | Contenido                                 | Uso                               |
| ------------------ | ----------------------------------------- | --------------------------------- |
| `connection:ready` | sesión, server time, protocol             | completar handshake               |
| `room:snapshot`    | room completa + revision                  | join/reconnect                    |
| `room:events`      | cambios ordenados por revision            | ready, join/leave, settings, host |
| `game:snapshot`    | estado visible + sequence/version         | inicio o resync completo          |
| `game:events`      | batch contiguo `fromSequence..toSequence` | evolución normal/catch-up         |
| `command:result`   | resultado correlacionado                  | fallback además del callback ACK  |
| `presence:changed` | player, status, grace deadline            | UX disconnect/reconnect           |
| `chat:message`     | message server ID y texto sanitizado      | chat/feed                         |
| `system:error`     | código, correlationId, retryable          | errores fuera de comando          |
| `server:draining`  | reconnectAfterMs                          | rollout controlado                |

## Snapshot visible

El server puede ocultar datos privados (cartas, seed, decisiones de bot) y enviar una vista por receptor. Un snapshot incluye `gameId`, `engineVersion`, `mapVersion`, `version`, `lastSequence`, `serverTime`, `phase`, `deadlineAt`, participantes y estado público, más la información privada permitida para esa sesión. No incluye password hashes, tokens, emails ni secretos RNG.

## Orden, huecos y resync

1. El cliente conserva `lastSequenceApplied` por `gameId`.
2. Aplica un batch solo si `fromSequence === lastSequenceApplied + 1`.
3. Duplicados ya aplicados se ignoran por sequence/event ID.
4. Ante un hueco, pausa animaciones dependientes y emite `game:resync`.
5. Si el event store conserva el rango, recibe eventos faltantes; si no, snapshot completo.
6. Tras snapshot se descartan estados optimistas incompatibles y se reanudan animaciones desde el confirmado.

La UI puede anticipar hover, selección o “comando enviado”, pero no debe mostrar una compra como final antes del evento autoritativo.

## Errores públicos

Catálogo inicial: `UNAUTHENTICATED`, `FORBIDDEN`, `VALIDATION_FAILED`, `RATE_LIMITED`, `PROTOCOL_UNSUPPORTED`, `ROOM_NOT_FOUND`, `ROOM_FULL`, `ROOM_STARTED`, `INVALID_PASSWORD`, `NOT_HOST`, `NOT_READY`, `GAME_NOT_FOUND`, `NOT_YOUR_TURN`, `INVALID_PHASE`, `STALE_VERSION`, `INSUFFICIENT_FUNDS`, `ASSET_NOT_OWNED`, `AUCTION_CLOSED`, `TRADE_CHANGED`, `DEADLINE_EXPIRED`, `COMMAND_CONFLICT`, `INTERNAL_ERROR`.

`INTERNAL_ERROR` nunca devuelve stack ni detalle de base de datos. El server registra un `correlationId` y responde texto neutral.

## Compatibilidad

`protocolVersion` empieza en `1`. Cambios aditivos con campos opcionales conservan versión si clientes antiguos mantienen semántica. Cambios en discriminantes, invariantes o interpretación requieren nueva versión y ventana de compatibilidad. El server rechaza una versión no soportada antes de permitir comandos.

## Límites iniciales

Los valores exactos son configuración y se afinan con pruebas, pero deben existir límites para: bytes por mensaje, mensajes de chat por ventana, joins/creates por IP y sesión, comandos por game, bids por segundo y sockets simultáneos por sesión. Los límites de juego no pueden romper reintentos legítimos: la deduplicación ocurre antes de cobrar una segunda vez.
