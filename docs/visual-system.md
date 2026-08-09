# Sistema visual y diseño de pantallas

## Dirección

ATLAS ESTATES usa una interfaz cálida, legible y competitiva inspirada en un tablero físico de viajes e inversión: marfil, azul marino, verde bosque, terracota, latón y madera. Las ciudades y países del mundo real sustituyen el lenguaje futurista. La profundidad se comunica con bordes, sombras y piezas 3D discretas; el tablero mantiene el protagonismo y los paneles existen para tomar decisiones.

El concept art es una referencia de composición y atmósfera. No debe convertirse en una captura usada como UI: logotipo, textos, HUD, inputs, listas, botones, modales, focus, tooltips y estados se implementan con HTML/React real.

## Tokens existentes

Los valores fuente viven en `packages/ui/src/tokens.ts`:

| Rol              | Token                     | Valor inicial         | Uso                               |
| ---------------- | ------------------------- | --------------------- | --------------------------------- |
| fondo            | `background`              | `#090b13`             | canvas/página                     |
| fondo elevado    | `backgroundElevated`      | `#0d111d`             | shell y rails                     |
| superficie       | `surface`                 | `#111725`             | panel/modal                       |
| superficie muted | `surfaceMuted`            | `#151c2b`             | filas/disabled                    |
| borde            | `border`                  | `#29334a`             | divisores, no decoración excesiva |
| texto            | `text`                    | `#f2efe8`             | títulos y contenido principal     |
| texto secundario | `textMuted`               | `#9aa3b5`             | metadata                          |
| acción/turno     | `violet` / `violetBright` | `#7c5cff` / `#a66cff` | CTA, focus, active                |
| éxito/ganancia   | `mint`                    | `#37d996`             | ready, cash ganado                |
| peligro/pérdida  | `coral`                   | `#ff5f6d`             | deuda, leave, pérdida             |
| evento/tercero   | `amber`                   | `#ffad57`             | subasta, posición, alerta         |
| información      | `cyan`                    | `#33b8ff`             | jugadores/links secundarios       |

Radios: 8/12/16 px. Motion: 140 ms feedback, 220 ms transición estándar y 420 ms transición deliberada. Evitar glass generalizado; usar transparencia solo cuando el contexto del tablero deba permanecer visible.

## Tipografía e iconografía

- Sans display geométrica para títulos/logotipo y sans humanista limpia para UI; cargar WOFF2 con fallback del sistema.
- Cifras monetarias `tabular-nums`; cantidades nunca dependen solo de color.
- Escala compacta: 12 metadata, 14–16 cuerpo/control, 20–24 panel title, 32–56 hero según viewport.
- Iconos de una sola familia outline, stroke coherente y label accesible.
- Avatares, edificios y mapa pueden ser ilustración original; iconos de control siguen siendo semánticos.

## Inventario de conceptos generados

Los concepts se conservaron de forma portable bajo `docs/visual-concepts/`. Su directorio de generación original fue `C:\Users\jamie\.codex\generated_images\019fe0be-c268-7942-b6c3-dd43dbdbb20b`. Son referencias de diseño, no assets runtime publicados.

| #   | Pantallas representadas    | Copia de referencia                           | Fuente generada                                 | Elementos que deben convertirse en componentes reales                                                          |
| --- | -------------------------- | --------------------------------------------- | ----------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| 1   | Main game board            | `docs/visual-concepts/01-main-game.png`       | `exec-8580250b-66e7-4737-bca5-a8c8d0dbeb23.png` | turn header/timer, player rail, board renderer, property inspector, feed, chat, action dock, dice              |
| 2   | Home                       | `docs/visual-concepts/02-home.png`            | `exec-97c4743c-90db-4218-98f5-dcc016a859a4.png` | header, nickname field, Play, Quick Play, Browse Rooms, Create Private Game, online status                     |
| 3   | Room browser + Create room | `docs/visual-concepts/03-rooms-create.png`    | `exec-5c1b7de7-1677-45d0-b49f-ee91f73fe9fd.png` | search/filters, accessible table/list, join by code, create drawer, settings inputs/toggles                    |
| 4   | Lobby                      | `docs/visual-concepts/04-lobby.png`           | `exec-def8128a-5296-4a31-88c0-7d472f5da568.png` | member rows, ready states, customization, map preview, host settings, lobby chat, leave/ready/start            |
| 5   | Trade screen               | `docs/visual-concepts/05-trade.png`           | `exec-dd12d39f-c56a-4c9e-bbc5-d301230a0a1f.png` | two-sided offer builder, cash stepper, asset selection, revisions/activity, value summary, send/counter/accept |
| 6   | Auction + Event card       | `docs/visual-concepts/06-auction-event.png`   | `exec-2ead6c5b-4ed5-46ff-9e0a-4c9adac4cdd7.png` | global auction dialog, server deadline, bid controls, participant states, recent bids, event card/ack          |
| 7   | Mobile game                | `docs/visual-concepts/07-mobile.png`          | `exec-c25760cf-6873-4680-9911-137afe0fda32.png` | compact player strip, pan/zoom board, primary action, bottom nav, snap-point property/action drawer            |
| 8   | Victory + Profile          | `docs/visual-concepts/08-victory-profile.png` | `exec-58b3ebc8-4996-4275-aac1-fc1aa25282bb.png` | winner stage, standings, recap awards, player stats, play again/home, profile tabs, XP/rank/history            |
| 9   | Atlas desktop              | `docs/visual-concepts/09-atlas-desktop.png`   | `exec-4531680c-41ed-4df4-8423-02d3256c480f.png` | world map, ivory panels, wooden board edge, physical dice/tokens, city deed inspector                          |
| 10  | Atlas mobile               | `docs/visual-concepts/10-atlas-mobile.png`    | `exec-4d9c9e4b-9ab5-4bdd-b1bb-7939efc4ebb8.png` | compact world board, warm mobile HUD, physical pieces, bottom navigation                                       |

El inventario cubre las 12 pantallas solicitadas: Home; Room browser; Create room; Lobby; Main board; Property modal/inspector; Trade; Auction; Event card; Mobile game; Victory; Profile.

## Shell desktop del juego

```text
┌ players rail ┬──────── turn / timer ────────┬ context/actions ┐
│              │                              │                 │
│ rankings     │          board               │ property/event  │
│ cash/status  │      tokens + effects        │ decisions       │
│              │                              │                 │
├──────────────┴ activity + chat ─────────────┴ action dock ────┤
```

- El tablero obtiene el área mayor y puede pan/zoom sin perder turno/timer.
- Rail derecho cambia por contexto, pero conserva sitio estable para CTA.
- Feed y chat son redimensionables/colapsables; los eventos críticos también aparecen como toast accesible.
- Modal global se reserva para operaciones que involucran a todos (auction, game over), no para cada landing.

## Mobile específico

- Header mínimo con jugador activo y deadline.
- Player strip horizontal con estado y cash; no intenta reproducir el rail desktop.
- Board ocupa el centro con pinch zoom, pan, “centrar en ficha” y targets touch ≥44 px.
- Bottom navigation: Players, Properties, Chat, Actions.
- Decisiones se abren en bottom sheet con snap points, focus trap cuando modal y CTA sticky.
- Feed económico aparece como una línea transitoria; el historial completo vive en drawer.
- Respetar safe-area insets, orientación y teclado virtual.

## Componentes base

- `AppShell`, `TopNav`, `GameShell`, `ResponsiveRail`, `BottomSheet`.
- `Button`, `IconButton`, `TextField`, `Select`, `SegmentedControl`, `Switch`, `Stepper`.
- `Dialog`, `Drawer`, `Popover`, `Tooltip`, `Toast`, `ProgressTimer`.
- `PlayerAvatar`, `PlayerRow`, `Money`, `PropertyBadge`, `StatusPill`.
- `BoardViewport`, `Tile`, `Token`, `Dice`, `PathChoice`.
- `PropertyInspector`, `TradeBuilder`, `AuctionDialog`, `EventCard`.
- `ActivityFeed`, `ChatPanel`, `EmoteBurst`, `ConnectionBanner`.
- `Standings`, `RecapAwards`, `ProfileSummary`, `MatchHistory`.

Los componentes presentacionales no importan Zustand global. Las features conectan datos confirmados a props y traducen acciones UI en comandos.

## Estados obligatorios por pantalla

| Área            | Estados además de éxito                                                                       |
| --------------- | --------------------------------------------------------------------------------------------- |
| Home            | connecting, nickname inválido, sesión expirada, server unavailable                            |
| Rooms           | loading, empty, filtros sin resultado, full/started, password error, pagination               |
| Create          | validation, submitting idempotente, code collision reintentado por server                     |
| Lobby           | reconnecting, member disconnected, settings stale, no permisos, start blocked                 |
| Board           | catching up, waiting server, not your turn, deadline expired, spectator, game paused/recovery |
| Trade           | draft dirty, offer changed, asset unavailable, expired, accepted/declined                     |
| Auction         | active, passed, highest bidder, reconnect catch-up, server closed                             |
| Victory/Profile | result finalizing, empty history, auth required, stats unavailable                            |

## Motion y sonido

Movimiento de ficha usa una cola que consume eventos autoritativos. La UI puede acelerar catch-up, pero nunca reordena eventos. Dinero ganado/perdido, compra, renta, carta, bankruptcy y victory tienen motion distintivo de baja amplitud. `prefers-reduced-motion` reemplaza trayectorias/3D por fades cortos y resultado inmediato.

SoundManager separa Master/Music/SFX, conserva preferencias y desbloquea AudioContext tras interacción. Cada sonido se dispara por evento confirmado y tiene cooldown para evitar spam. Chat/emotes no deben reproducir audio si el canal está muted.

## Accesibilidad

- Focus visible violeta con contraste suficiente y sin depender del glow.
- Orden DOM lógico incluso si CSS coloca rails visualmente.
- Board tiene alternativa textual: posición, tile, owner/rent y acciones.
- Timer usa texto y anuncios no intrusivos; no actualiza live region cada segundo.
- Ganancia/pérdida añade signo/icono/copy además de color.
- Dialogs tienen título, descripción, focus trap y retorno de focus.
- Emotes y animaciones decorativas tienen `aria-hidden`; mensajes relevantes llegan al feed.

## Assets originales

Antes de publicar un asset, registrar: ID estable, autor/origen, licencia, mapa/uso, dimensiones, formatos fuente/export, paleta, alt/decorative y versión. Exportar AVIF/WebP con fallback cuando proceda, atlases solo si se miden beneficios y audio en formatos web compatibles. Nunca rasterizar texto de interfaz dentro de la ilustración.

## Checklist de QA visual

- [ ] 1440×900, 1280×720, tablet y 390×844 sin controles cortados.
- [ ] Zoom del navegador 200% en flujos esenciales.
- [ ] Teclado completo y lector en create/join/turn action.
- [ ] Contraste AA y modo reduced motion.
- [ ] 2, 4 y 8 jugadores sin desbordar shell.
- [ ] Nombres largos, cantidades grandes y localización expandida.
- [ ] Reconnect, stale action, error y spectator visibles.
- [ ] Assets optimizados, lazy load y sin layout shift crítico.
