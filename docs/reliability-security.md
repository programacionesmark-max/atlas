# Concurrencia, reconexión, persistencia y seguridad

## Modelo de consistencia

Cada `gameId` tiene un orden total de comandos. El server permite paralelismo entre partidas, pero serializa acciones de la misma partida. El orden observable es la secuencia committeada en PostgreSQL, no el instante en que un packet llegó a una réplica.

### Cola por partida

```text
validar envelope → enqueue(gameId) → reload si es necesario → decide
→ transaction persist → update memoria → ACK/broadcast → siguiente
```

- La cola tiene límite de profundidad y métricas.
- Timeouts del sistema entran por la misma cola que comandos humanos.
- Chat/emotes pueden usar otra ruta porque no mutan `GameState` económico.
- Si un handler falla, la cola libera el slot, registra correlation ID y no salta comandos posteriores.
- El estado en memoria solo avanza con eventos que ya hicieron commit.

### Caso: dos compras simultáneas

El primer comando en cola ve propiedad libre, genera compra y commitea. El segundo se evalúa contra el nuevo estado y recibe `ASSET_NOT_AVAILABLE`. En varias réplicas, el owner/lease y compare-and-swap de versión evitan que dos colas se crean dueñas; una transacción perdedora recarga y reevalúa o devuelve `COMMAND_CONFLICT`.

### Caso: bid cerca del deadline

El server compara su reloj con `deadlineAt` al ejecutar en cola, usando el margen configurado de forma uniforme. Un packet recibido tarde no gana por timestamp del cliente. El cierre de auction es un comando de sistema en la misma cola; gana el orden válido alrededor del deadline.

## Reconnect

### Identidades diferentes

- `socket.id`: una conexión efímera.
- `sessionId`: guest/cuenta en ese dispositivo, durable y revocable.
- `gamePlayerId`: asiento inmutable en una partida.
- reconnect secret: credencial opaca de corta duración, almacenada solo como hash y vinculada a sesión/partida.

Nunca se crea otro `GamePlayer` porque cambió el socket.

### Flujo

1. Al unirse, el server vincula session y player; entrega sesión/reconnect mediante cookie segura o canal autenticado.
2. Ante heartbeat perdido marca `DISCONNECTED` y emite presencia con `graceDeadlineAt`; no elimina al jugador.
3. Turnos y timers siguen la política configurada: autoacción segura, pause limitado o bot takeover en fases futuras.
4. El cliente vuelve con credencial; el server verifica hash, scope, expiración y revocación.
5. Rota el secreto para impedir replay, invalida el anterior y sustituye la conexión activa de forma definida.
6. Envía snapshot visible y eventos posteriores a `lastSequence`.
7. Marca `CONNECTED` y emite “reconnected”.

Si dos conexiones presentan la misma sesión, la política inicial es una conexión de control y las demás read-only o expulsadas con código explícito. Nunca pueden enviar dos comandos fingiendo ser jugadores distintos.

### Almacenamiento del cliente

Preferir cookie `HttpOnly`, `Secure`, `SameSite` compatible con los dominios elegidos y protección CSRF/origin. No poner tokens en query string, logs ni feed. Si la separación Vercel/backend obliga a third-party cookie problemática, usar dominio compartido o bootstrap HTTPS con access token corto en memoria, manteniendo el refresh secret en cookie segura.

## Host migration

Host solo administra lobby; no es autoridad del game engine. Al salir o expirar su grace period, el server elige de forma determinista al member elegible con menor `joinedAt`/seat, actualiza `hostMemberId` y emite `HostChanged`. Durante partida, abandonar host nunca termina el juego. Si vuelve, no recupera host automáticamente salvo regla explícita.

## Persistencia y restore

### Escritura

- Cada comando aceptado persiste eventos antes de ACK.
- Snapshots se generan por intervalo y/o número de eventos; no sustituyen event log.
- El snapshot guarda `lastSequence`, versiones y checksum.
- Los deadlines futuros se reflejan en `Game.nextDeadlineAt`.

### Arranque

1. buscar partidas `ACTIVE`/`PAUSED_RECOVERABLE`;
2. tomar snapshot compatible más reciente;
3. verificar checksum y aplicar events posteriores en orden;
4. comprobar invariantes y reconciliar ledger/proyecciones;
5. registrar partida/owner y reprogramar deadline;
6. si venció, encolar timeout; no ejecutarlo fuera de la cola;
7. aceptar reconexiones cuando readiness confirme restore.

Si no hay snapshot válido se reproduce desde eventos. Si un evento no puede migrarse, la partida se aísla como `RECOVERY_FAILED`, no se inicia con estado parcial.

### Escenarios de fallo

| Punto de fallo                         | Estado correcto                                 |
| -------------------------------------- | ----------------------------------------------- |
| antes de DB transaction                | nada aplicado; retry permitido                  |
| dentro de transaction                  | rollback completo                               |
| después de commit, antes de memoria    | restore/reload desde DB                         |
| después de memoria, antes de broadcast | cliente hace resync por sequence                |
| server reinicia con timer vencido      | timeout se encola una vez mediante idempotencia |
| snapshot corrupto                      | usar snapshot anterior + events                 |

## Límites de confianza

| Entrada       | Validaciones mínimas                                                       |
| ------------- | -------------------------------------------------------------------------- |
| handshake     | origin, protocol, session, expiry, socket limits                           |
| room settings | host, phase, revision, rangos y whitelist                                  |
| game command  | Zod, actor, version, phase, turn, ownership, funds, deadline               |
| trade         | revisión exacta, ambos actores, assets/funds actuales, locks               |
| auction       | auction ID actual, activo, cantidad, fondos, paso irreversible según regla |
| chat          | longitud, Unicode normalizado, sanitize, rate, mute/ban                    |
| map/config    | schema, IDs, graph, economía, effect registry, size limits                 |

## Autenticación y autorización

- Passwords: Argon2id o bcrypt con parámetros actuales y límite de intentos.
- Sesiones: secreto aleatorio de alta entropía, hash server-side, rotación y revocación.
- Guest: privilegio mínimo; nickname y acciones igualmente validados.
- OAuth: PKCE/state/nonce cuando se implemente; no se acepta email sin verificar como prueba de identidad.
- Cada operación reevalúa autorización; pertenecer a una room no concede acceso a cualquier game.
- Host controls y moderation registran actor, target y reason.

## Web y transporte

- HTTPS/WSS obligatorio en producción.
- CORS allowlist exacta; nunca `*` con credenciales.
- Helmet/CSP apropiada, MIME sniffing desactivado y framing restringido.
- Cookies `HttpOnly`, `Secure`; CSRF token/origin check en endpoints mutadores.
- Payload y decompression limits; timeouts; ningún objeto se propaga directamente a Prisma.
- Zod usa objetos strict para rechazar campos inesperados en comandos sensibles.

## Rate limiting

Capas por IP, sesión y game: auth, room create/join, quick play, command, bid, trade, chat y emote. Redis proporciona contadores compartidos si hay varias réplicas. Una respuesta `RATE_LIMITED` indica retry razonable, pero no revela reglas internas aprovechables.

El limitador se coloca antes de operaciones costosas y distingue retry del mismo `commandId` para no romper idempotencia.

## Chat y contenido generado por usuario

- Máximo de caracteres/bytes y mensajes por ventana.
- Normalización Unicode y escape al render; nunca insertar HTML.
- Enlaces pueden desactivarse en MVP.
- Mute local y enforcement server-side preparado.
- Report referencia message ID inmutable y guarda solo evidencia necesaria.
- Política de retención documentada antes de producción; logs operativos no duplican texto completo por defecto.

## Observabilidad segura

Logs estructurados con `correlationId`, `gameId`, command type, resultado, latencia y secuencias; se redactan tokens, cookies, passwords, emails, IP completa y payloads de chat. Métricas clave: conexiones, rooms, games activas, queue depth, stale versions, duplicate commands, DB tx latency, snapshot age, reconnect success y restore failures.

Alertas iniciales: error rate, partidas sin snapshot reciente, deadlines retrasados, command p95, pool PostgreSQL, Redis/lease conflict y recovery failed.

## Checklist previo a escala horizontal

- [ ] Socket.IO adapter probado con disconnect/reconnect entre réplicas.
- [ ] Ownership lease con fencing token y tests de split brain.
- [ ] Sticky sessions o transporte compatible configurado.
- [ ] Rate limits y presence compartidos.
- [ ] Timers recuperables al perder owner.
- [ ] Compare-and-swap/version conflict cubierto.
- [ ] Load/chaos test con kill de owner durante compra, bid y timeout.
