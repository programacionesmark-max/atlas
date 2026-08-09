# Plan de entrega — CIRCUIT ESTATES

Este documento es el registro de alcance. Una casilla marcada significa que existe evidencia en el repositorio; no significa que toda la fase esté aprobada. El primer corte jugable local ya atraviesa engine, realtime, rooms, tablero y economía; las casillas abiertas conservan explícitamente el trabajo avanzado o de producción pendiente.

## Definition of Done por feature

- [x] Contratos y reglas documentados antes de exponer la feature.
- [x] El servidor valida identidad, payload, fase, permisos y versión.
- [x] Cambios económicos persistidos y auditables antes del broadcast cuando la persistencia durable está activa.
- [x] Tests unitarios/integración cubren camino feliz, rechazo y concurrencia.
- [x] `format:check`, lint, TypeScript, tests y build pasan.
- [x] Feature probada en navegador; realtime se valida con dos clientes independientes.
- [x] Estados loading, empty, error, timeout, reconnect y responsive revisados para el corte MVP.
- [x] Sin datos falsos ni fallback que simule éxito.

## Phase 1 — Architecture + project setup

- [x] Analizar requisitos, separar MVP, fases avanzadas y criterios de aceptación.
- [x] Elegir React + Vite para web, Fastify + Socket.IO para server y PostgreSQL + Prisma.
- [x] Definir límites del monorepo y dependencia unidireccional del game engine.
- [x] Definir state machine autoritativa y protocolo realtime versionado.
- [x] Definir modelo de datos, persistencia, reconexión, concurrencia y seguridad.
- [x] Documentar sistema visual e inventariar los ocho concepts generados.
- [x] Crear configuración raíz pnpm/Turborepo, TypeScript estricto, ESLint y Prettier.
- [x] Crear `.env.example` sin secretos y `docker-compose.yml` para PostgreSQL/Redis local.
- [x] Crear scaffolds iniciales de `@circuit/shared` y `@circuit/ui`.
- [x] Completar scaffolds de `apps/web`, `apps/server`, `packages/game-engine` y `packages/database`.
- [x] Instalar dependencias con lockfile reproducible.
- [x] Conseguir que format, lint, typecheck, tests y build pasen desde la raíz.
- [x] Iniciar web/server y verificar health checks en navegador.
- [x] Gate Phase 1 aprobado.

## Phase 2 — Game engine

- [x] Definir `GameState`, comandos, eventos y errores tipados.
- [x] Implementar las 14 fases y la tabla exhaustiva de transiciones.
- [x] Inyectar reloj y PRNG determinista; eliminar `Math.random` de reglas.
- [x] Implementar turnos, dados, movimiento, paths y bifurcaciones.
- [x] Implementar registro extensible de `TileEffect`.
- [x] Unit tests deterministas e invariantes de estado.
- [x] Gate Phase 2 aprobado.

## Phase 3 — Database

- [x] Implementar schema Prisma y primera migración.
- [ ] Usuarios, perfiles, sesiones guest/registradas y credenciales seguras.
- [x] Rooms, games, players, events, snapshots y transactions.
- [x] Resultados, estadísticas, mapas, social, cosméticos y reports.
- [x] Contrato mínimo del schema cubierto por tests automáticos.
- [ ] Gate Phase 3 aprobado.

## Phase 4 — Realtime multiplayer

- [x] Handshake, autenticación y validación Zod compartida.
- [x] Cola serial por `gameId`, idempotencia y control de versión.
- [ ] Snapshots, event batches, ACKs, errores estables y resync.
- [x] Presencia, heartbeats, límites de payload y rate limiting.
- [x] Test de dos sockets viendo el mismo orden de eventos.
- [ ] Gate Phase 4 aprobado.

## Phase 5 — Rooms + lobby

- [x] Crear, listar, buscar, unirse y salir de room.
- [x] Rooms públicas/privadas, código único y password opcional hasheado.
- [x] Quick Play real: buscar, unirse o crear y esperar.
- [x] Ready, selección de avatar/color/token/emote y validación de colisiones.
- [x] Controles de host, kick, transferencia y migración automática de host.
- [x] Chat de lobby sanitizado.
- [ ] Gate Phase 5 aprobado.

## Phase 6 — Basic playable board

- [x] Render de tablero a partir de un grafo `MapConfig`.
- [x] HUD desktop, layout móvil específico y controles accesibles.
- [x] Inicio, tirada server-side, movimiento, landing y fin de turno.
- [x] Timer/timeout seguro, presencia y política AFK inicial.
- [x] Feed de actividad derivado de eventos reales.
- [ ] Gate Phase 6 aprobado.

## Phase 7 — Properties + economy

- [x] Ledger inmutable y Bank/Economy Service.
- [x] Compra, dueño, renta, grupos, mejoras y venta de mejoras.
- [x] Impuestos, bonus, multas y patrimonio neto.
- [x] Resolver atomicidad y saldo insuficiente sin valores negativos.
- [x] Tests unitarios de economía, rentas y propiedad.
- [ ] Gate Phase 7 aprobado.

## Phase 8 — Auctions + mortgages

- [x] Subasta global realtime con deadline autoritativo.
- [x] Pujar/pasar idempotente y cierre determinista.
- [x] Hipotecar, deshipotecar, intereses y restricciones de mejoras.
- [ ] Tests de pujas simultáneas, timeout y desconexión.
- [ ] Gate Phase 8 aprobado.

## Phase 9 — Trades

- [x] Draft, offer, accept, decline, counter y expire.
- [x] Dinero, propiedades, cartas y recursos versionados.
- [x] Aceptación atómica revalida ambos patrimonios y estados.
- [x] UI bilateral clara y actividad realtime.
- [ ] Gate Phase 9 aprobado.

## Phase 10 — Cards + events

- [x] DSL/registro seguro de efectos y targeting.
- [x] Mínimo 40 eventos originales validados y testeados.
- [ ] Efectos temporales con duración y expiración deterministas.
- [x] Market events, feedback visual y actividad.
- [ ] Gate Phase 10 aprobado.

## Phase 11 — Bankruptcy + victory

- [x] Estado de deuda con ventana para liquidar activos o negociar.
- [x] Transferencia correcta a jugador acreedor o banco.
- [x] Eliminar jugador de turnos y convertirlo en espectador opcional.
- [ ] Cuatro condiciones de victoria y desempates deterministas.
- [x] Resultado, recap y estadísticas persistidas una sola vez.
- [ ] Gate Phase 11 aprobado.

## Phase 12 — Reconnect + persistence

- [x] Reconnect token firmado, expiración, hash durable y reanudación de sesión.
- [x] Disconnected/reconnected y grace period sin perder identidad.
- [x] Event log duradero, snapshots periódicos y restore al arrancar.
- [ ] Catch-up por secuencia; fallback a snapshot completo.
- [ ] Chaos tests antes/después de commit y reinicio de proceso.
- [ ] Gate Phase 12 aprobado.

## Phase 13 — Bots

- [ ] Easy/Normal/Hard usando solo información pública permitida.
- [ ] Compra, trade, subasta, hipoteca y gestión de liquidez.
- [ ] Decisiones con presupuesto de tiempo y PRNG reproducible.
- [ ] Tests que demuestran ausencia de acceso a resultados futuros.
- [ ] Gate Phase 13 aprobado.

## Phase 14 — Additional maps

- [x] Neon City estabilizado como mapa de referencia.
- [x] World Capitals, Grand Europe, Americas y Asia-Pacific con dioramas propios.
- [ ] Space Colony, Wild West, Luxury Metropolis y Apocalypse City.
- [ ] Layouts circular, isla, ciudad, hexagonal, circuito y bifurcaciones.
- [ ] Validador/preview de configs y compatibilidad de versión.
- [ ] Gate Phase 14 aprobado.

## Phase 15 — UI/UX polish

- [ ] Implementar las 12 pantallas objetivo con HTML/React real.
- [x] Dados pseudo-3D, tokens, transacciones y feedback de eventos.
- [x] SoundManager con Master/Music/SFX y mute.
- [ ] Accesibilidad WCAG 2.2 AA, teclado, contraste y reduced motion.
- [x] Lazy loading por ruta/mapa, WebP y presets gráficos AUTO/LOW/MEDIUM/HIGH.
- [x] QA visual desktop y móvil contra concepto 2.5D.
- [ ] Gate Phase 15 aprobado.

## Phase 16 — Profiles + progression

- [ ] Perfil, estadísticas y match history derivados de resultados.
- [ ] XP/niveles sin ventajas competitivas.
- [ ] Inventario de cosméticos, equipamiento y unlocks.
- [ ] Friends, friend requests, invites y recent players.
- [ ] Base de Casual/Ranked, MMR y rangos sin activar ranked aún.
- [ ] Gate Phase 16 aprobado.

## Phase 17 — Testing + security

- [ ] Matriz completa unit/integration/E2E y cobertura de invariantes.
- [x] E2E del MVP con dos navegadores, enlace de invitación, reconnect y móvil.
- [ ] Fuzz/property tests de comandos económicos.
- [x] Validación Zod, sanitización, autorización, CORS y headers defensivos.
- [x] Rate limits por IP/sesión/game y tests de ventana.
- [ ] Dependencias auditadas y logs sin secretos/PII.
- [x] Smoke de sala autoritativa con 8 jugadores simultáneos.
- [ ] Gate Phase 17 aprobado.

## Phase 18 — Deployment

- [ ] PostgreSQL gestionado, backups, PITR y migraciones release-safe.
- [ ] Server desplegado en Railway/Render/Fly con health/readiness.
- [ ] Web desplegada en Vercel con CORS y cookies correctos.
- [ ] Redis/adapter/ownership habilitado si se escala a más de una réplica.
- [ ] Métricas, logs, alertas y runbook de restore/rollback.
- [ ] Smoke E2E público con dos clientes reales.
- [ ] Gate Phase 18 aprobado.

## Gate del primer MVP multiplayer

- [ ] Un enlace público permite crear y unir una room desde dos equipos.
- [x] Lobby, ready, start y host migration funcionan.
- [x] Turnos, dados, movimiento, dinero, propiedades, compra y renta son autoritativos.
- [x] Sanción original, impuestos, cartas/eventos y chat funcionan.
- [x] Trade, subasta, hipoteca, liquidación y bancarrota funcionan.
- [x] Disconnect/reconnect conserva jugador y estado.
- [x] Existe ganador real, recap y resultado persistido.
- [x] Ambos clientes observan el mismo `gameId`, versión, fase y secuencia final.

Solo después de este gate se priorizan mapas adicionales, XP/cosméticos, ranked, modos avanzados, bolsa, negocios y editor de mapas.
