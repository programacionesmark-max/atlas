# Estrategia de testing

## Pirámide y gates

Vitest cubre lógica pura e integración server/database; Playwright cubre el flujo real del navegador. Cada feature añade pruebas antes de marcar su checkbox. `--passWithNoTests` solo es aceptable durante scaffold; no es evidencia de una fase implementada.

Orden de gate:

```bash
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm test:e2e
```

Guardar comando, versión Node/pnpm, resultado y cualquier excepción reproducible en la entrega de fase.

## Unit tests del engine

- tabla completa de transiciones válidas e inválidas;
- turn start/roll/move/landing/end con seed fija;
- paths y bifurcación, paso por start y sanciones;
- banco, transferencias, rentas, grupos, mejoras e hipotecas;
- saldo insuficiente, deuda, liquidación y bankruptcy;
- auction: bid/pass/deadline/tie policy;
- trade: revision, ownership, funds, counter, expiry y atomic accept;
- cards: targeting, porcentajes, duration, stacking y expiry;
- condiciones de victoria/desempate;
- host migration, AFK y acciones seguras;
- replay de events produce el mismo state/checksum.

Property-based/fuzz tests generan secuencias de comandos y comprueban invariantes: cash entero, ownership único, ledger balanceado, versión monotónica y terminalidad de `GAME_OVER`.

## Integration tests

### Rooms y autenticación

- guest crea sesión, room pública/privada y code único;
- password correcto/incorrecto sin timing/detail leak obvio;
- capacidad, espectador, kick y host migration;
- Quick Play une una room compatible o crea una real;
- doble join con la misma sesión no duplica member.

### Socket.IO

- handshake/version/origin inválidos rechazados;
- dos sockets reciben exactamente secuencias contiguas;
- mismo command ID dos veces produce un solo efecto;
- expectedVersion stale devuelve resync hint;
- payload con actor/saldo/campos extra se rechaza;
- rate limit no duplica efecto en retry legítimo.

### Persistencia

- command commit inserta events, ledger y receipt atómicamente;
- fallo inyectado dentro de tx no deja escritura parcial;
- restore snapshot + tail events conserva checksum;
- snapshot corrupto retrocede al anterior;
- server restart con deadline vencido dispara un timeout;
- finalizar game dos veces no duplica result/XP/stats.

## Tests de concurrencia obligatorios

Enviar desde promises/sockets coordinados:

- dos compras de la misma propiedad;
- accept trade mientras un asset se hipoteca/transfiere;
- dos bids y close auction alrededor del deadline;
- end turn y roll duplicados;
- reconnect mientras la conexión anterior manda comando;
- dos intentos de host migration;
- timeout y acción humana en el mismo límite.

La aserción no es solo “una respuesta falló”: comprobar state, events, ledger, command receipts y lo observado por ambos clientes.

## E2E MVP con dos contextos

Usar dos `browser.newContext()` independientes para evitar cookies/local storage compartidos.

1. A abre Home, establece nickname y crea room.
2. B abre otro contexto, entra por code.
3. Ambos ven los mismos members/settings; ready y start.
4. Confirmar mismo `gameId`, `version`, `phase`, `lastSequence` mediante UI/test hooks seguros.
5. A tira/mueve/compra; B ve token, owner y feed.
6. B cae/paga renta; A ve saldo y transaction.
7. Ejecutar una auction con bids de ambos y cierre por server.
8. Crear y aceptar trade; comprobar ownership y cash.
9. Hipotecar/liquidar y forzar bankruptcy por reglas de fixture.
10. Cerrar pestaña/red de B, observar disconnected, volver y recuperar mismo player.
11. Terminar partida, confirmar ganador, recap y match history.
12. Recargar ambos clientes y confirmar resultado persistido.

Fixtures de test reducen precios/rondas mediante config válida; no añaden endpoints que “simulan victoria” saltándose el engine.

## Pruebas visuales y accesibilidad

- screenshots deterministas de Home, rooms, lobby, board y dialogs en viewports definidos;
- tolerancia acotada y fonts/assets precargados;
- axe en flujos esenciales;
- solo teclado, focus trap/return y anuncios de error;
- `prefers-reduced-motion`, 200% zoom, nombres/cantidades largas;
- touch targets y safe areas móvil.

Una diferencia respecto al concept art no falla si mejora accesibilidad o legibilidad; sí falla si rompe jerarquía, controls o consistencia de estados.

## Rendimiento

- React Profiler comprueba que timer no rerenderiza todo el tablero.
- Performance trace de movimiento con 2/4/8 tokens y effects.
- Presupuesto de tamaño por route/asset y lazy load de mapas/audio.
- p50/p95 server de enqueue, engine, DB commit y broadcast.
- load test con muchas partidas pequeñas, no solo miles de sockets inactivos.

Objetivo visual 60 fps; medir en dispositivo medio y permitir reduced/degraded effects sin alterar reglas.

## Security tests

- fuzz de schemas y límites de payload/decompression;
- command actor spoof, fuera de turno y ownership falso;
- replay de sesión/reconnect/command;
- room code enumeration y auth brute-force limits;
- CORS/origin/CSRF/cookie flags;
- XSS/Unicode en nickname y chat;
- logs redactan cookie/token/password/email/chat;
- dependencias y container images auditadas.

## Entornos y datos

Tests unitarios no dependen de red/reloj real. Integration usa PostgreSQL aislado y limpia por schema/database dedicada, nunca la base de desarrollo. E2E crea IDs únicos y elimina solo sus propios datos. Seeds de engine se guardan en output al fallar para reproducir.

## Evidencia de fase

Cada gate debe registrar:

- commit/revisión probada;
- comandos exactos y exit code;
- suites/casos/cobertura relevante;
- screenshot/video solo como evidencia adicional;
- incidencias conocidas que no contradigan aceptación;
- resultado del test con dos clientes para features realtime.

No se marca un checkbox por haber escrito el test si está skipped, flaky sin resolver o no ejecutado.
