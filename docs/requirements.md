# Requisitos analizados

## Resultado que define el producto

CIRCUIT ESTATES está terminado cuando dos personas, desde equipos distintos, pueden abrir un enlace, compartir una room, jugar una partida completa y observar exactamente el mismo estado. El resultado incluye economía real, negociación, desconexión/reconexión, bancarrota, ganador y registro persistente. Compilar o mostrar una pantalla no satisface ese criterio.

## Pilares

1. **Competición económica legible.** Cada turno tiene una decisión clara y el feed explica por qué cambió el estado.
2. **Autoridad y justicia.** El servidor genera azar, aplica reglas y ordena acciones; el cliente solo presenta y solicita.
3. **Social sin fricción.** Guest instantáneo, room code, quick play, chat y reconexión.
4. **Variedad dirigida por datos.** Un mapa es un grafo y una economía versionados, no un tablero hardcodeado.
5. **Producto duradero.** Partidas recuperables, contratos versionados, auditoría y operaciones observables.
6. **Identidad original.** Mundo, nomenclatura, cartas, arte, sonido y reglas específicas propios.

## MVP jugable obligatorio

| Dominio     | Incluido en el primer MVP                               | Evidencia de aceptación                                         |
| ----------- | ------------------------------------------------------- | --------------------------------------------------------------- |
| Entrada     | Home, nickname guest, create/join, room code            | Dos sesiones distintas llegan a la misma room                   |
| Lobby       | 2–4 jugadores, ready, host, ajustes MVP, start          | Start rechazado si no cumple reglas                             |
| Tablero     | Un mapa original, turnos, dados, movimiento, timer      | Mismo orden de eventos y posiciones en ambos clientes           |
| Economía    | Efectivo, ledger, propiedades, compra, renta, impuestos | Ningún cambio se origina en frontend; transacciones auditables  |
| Decisiones  | Eventos, subastas, trades, hipotecas                    | Revalidación atómica al cerrar cada operación                   |
| Insolvencia | Liquidación, bancarrota y transferencia de activos      | Deudor no puede terminar con saldo inválido ni actuar en turnos |
| Social      | Chat, quick messages y presencia                        | Mensajes sanitizados; disconnect/reconnect visible              |
| Continuidad | reconnect token, snapshots y event log                  | Cerrar pestaña y volver conserva `GamePlayer`                   |
| Final       | Victoria, standings, recap y resultado                  | Un único resultado persistido y visible para ambos clientes     |

Aunque el sistema de rooms soportará 2–8 participantes, el gate inicial se valida con 2–4 para controlar complejidad de UI y balance. El diseño de tipos no debe imponer ese límite de MVP.

## Después del gate del MVP

Se posponen: los siete mapas adicionales, 5–8 jugadores como experiencia pulida, bots avanzados, XP, cosméticos, ranked/MMR, friends, achievements, modos Teams/Battle Royale/Tycoon, bolsa, negocios, préstamos, bounties, black market, OAuth y map editor. Los modelos y contratos pueden reservar puntos de extensión, pero no deben implementar flujos falsos ni bloquear el MVP.

## Dominios funcionales

- Identidad: guest, cuenta, perfil y sesión recuperable.
- Room/matchmaking: público/privado, código, password opcional, quick play y host migration.
- Juego: state machine, turnos, azar, movimiento, paths, casillas y decisiones.
- Economía: banco, ledger, propiedad, mejoras, hipotecas, renta, deuda y bancarrota.
- Operaciones multipartes: trade y subasta con deadlines.
- Contenido: mapas, cartas, eventos y reglas especiales validados.
- Realtime: presencia, comandos, ACK, eventos ordenados, snapshot y resync.
- Social: chat, emotes, mute/report preparado y spectator.
- Metajuego: resultado, estadísticas, progresión y cosméticos en fases posteriores.
- Operación: migraciones, backups, observabilidad, rate limits y despliegue.

## Requisitos no funcionales y cómo medirlos

| Área          | Objetivo                                                                    | Verificación                                       |
| ------------- | --------------------------------------------------------------------------- | -------------------------------------------------- |
| Consistencia  | Una secuencia monotónica por partida; cero doble compra/pago                | tests de comandos simultáneos y replay             |
| Recuperación  | Restaurar snapshot + eventos tras reinicio                                  | integration test que mata y reinicia server        |
| Reconexión    | La caída de red no crea otro jugador                                        | E2E con cierre/reapertura y token rotado           |
| Latencia      | Feedback local inmediato y evento autoritativo normalmente <250 ms regional | p50/p95 de command-to-commit y commit-to-broadcast |
| Animación     | 60 fps objetivo en portátil medio; degradación funcional                    | profiling, long tasks, reduced motion              |
| Accesibilidad | WCAG 2.2 AA en flujos esenciales                                            | teclado, lector, contraste, focus y axe            |
| Seguridad     | Rechazar replay, payload inválido y acción fuera de turno                   | tests de abuso y rate limiting                     |
| Privacidad    | Logs sin passwords, tokens, email completo ni chat sensible                 | redaction tests y revisión de sinks                |

## Reglas de autoridad

El cliente nunca proporciona como resultado confiable: saldo, coste final, renta, ownership, tirada, destino, fase, ganador, orden de turno, cierre de auction, aceptación final de trade ni contenido de una carta sorteada. Puede enviar una selección o intención; el servidor deriva el resultado desde su estado y configuración.

## Decisiones asumidas

- Web SPA con React + Vite: el juego no necesita SSR para su loop principal.
- Backend Fastify persistente con Socket.IO: facilita contratos HTTP y conexiones realtime.
- PostgreSQL es la fuente duradera; Redis no sustituye event log ni snapshots.
- La primera topología es una réplica de juego. Escala horizontal solo después de incorporar ownership/lease por `gameId`.
- Los guest conservan identidad mediante sesión segura; registrar una cuenta puede vincular el histórico sin alterar `GamePlayer`.
- Timers usan deadlines del servidor, nunca intervalos confiados al cliente.

## Restricciones legales y creativas

- No extraer, recrear ni adaptar mapas exactos, nombres, cartas, código, branding, música o arte de productos de referencia.
- Registrar origen y licencia de cada asset; el concept art generado es dirección visual hasta completar esa revisión.
- Usar lenguaje propio: por ejemplo, `JAIL` es el nombre técnico de compatibilidad de la state machine, pero el copy de juego debe adoptar una sanción original del mundo CIRCUIT ESTATES.
