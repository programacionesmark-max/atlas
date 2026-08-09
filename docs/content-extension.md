# Extender mapas, cartas y casillas

## Regla general

El contenido declara datos y efectos conocidos por el engine. Un JSON de mapa nunca ejecuta código, importa una función arbitraria ni decide dinero en el cliente. Se valida al cargar/publicar y la partida fija una versión inmutable.

## `MapConfig`

Contrato conceptual:

```ts
type MapConfig = {
  schemaVersion: 1;
  id: string;
  version: number;
  name: string;
  theme: {
    paletteId: string;
    boardArtId: string;
    ambienceId?: string;
  };
  layout: {
    kind: 'CIRCUIT' | 'SQUARE' | 'CIRCULAR' | 'ISLAND' | 'CITY' | 'HEX' | 'BRANCHING';
    nodes: Array<{ id: string; tileId: string; x: number; y: number }>;
    edges: Array<{ from: string; to: string; cost: number; ruleId?: string }>;
  };
  tiles: TileConfig[];
  economy: EconomyConfig;
  decks: Array<{ id: string; cardIds: string[] }>;
  specialRules: SpecialRuleConfig[];
  assets: Record<string, string>;
};
```

Las coordenadas son presentación; los edges son movimiento. Nunca se calcula el path inspeccionando posiciones en pixels.

### Validación de mapa

- IDs/slugs únicos, schema y versión soportados.
- Un único start lógico y todos los `tileId` referenciados.
- Edges apuntan a nodes existentes, costes enteros positivos y paths alcanzables.
- Bifurcaciones tienen política de elección/timeout; no hay sumideros involuntarios.
- Property groups completos, precios/rentas/mejoras enteros y curva válida.
- Decks no vacíos y cards existentes/compatibles.
- Special rules pertenecen a registry permitido y no se contradicen.
- Assets referenciados existen, pero su ausencia visual no cambia reglas.
- Límites de tamaño, número de nodes/edges y profundidad de efectos.

## Añadir un mapa

1. Crear un ID y mundo originales; elegir `layout.kind` por topología, no por apariencia.
2. Diseñar nodos/edges y ejecutar validador de grafo.
3. Declarar tiles, propiedades, grupos, economía, decks y reglas especiales.
4. Añadir assets por ID con inventario de licencia/origen; nunca incrustar UI en background.
5. Registrar config en el catálogo server/engine y publicar versión inmutable.
6. Añadir tests de schema, reachability, rent curve, round traversal y restore/replay.
7. Añadir preview visual y smoke E2E de una vuelta completa.

Modificar un mapa publicado crea `version + 1`. Las partidas activas continúan con la versión fijada.

## Catálogo inicial de mapas

| Mapa              | Layout/identidad              | Variación económica sugerida          | Evento/regla distintiva                  |
| ----------------- | ----------------------------- | ------------------------------------- | ---------------------------------------- |
| Neon City         | circuito urbano de datos      | rentas medias, alta movilidad         | cortes de red/market surge               |
| Tropical Islands  | islas y ferries/bifurcaciones | propiedades dispersas, bonus de rutas | tormenta cambia conexiones temporalmente |
| Cyber Tokyo       | anillo + líneas de metro      | mejoras tecnológicas más potentes     | overload/teleport controlado             |
| Old Europe        | barrios compactos y plazas    | grupos pequeños, rentas estables      | festival/renovación histórica            |
| Space Colony      | módulos orbitales/hex         | mantenimiento alto, bonus energético  | anomalía desplaza o bloquea módulo       |
| Wild West         | circuito con ramales          | cash más escaso, negocios de riesgo   | gold rush/bounty                         |
| Luxury Metropolis | distritos premium             | costes y rentas altos                 | gala/market correction                   |
| Apocalypse City   | rutas dañadas dinámicas       | recursos escasos, volatilidad alta    | supply drop/road collapse                |

Estos son briefs, no balance final. Neon City es el primer mapa de referencia; añadir los otros antes del gate MVP dispersaría testing.

## Modelo de propiedad

Una property tile referencia datos versionados:

```ts
type PropertyConfig = {
  id: string;
  name: string;
  category: 'DISTRICT' | 'BUSINESS' | 'UTILITY' | 'TRANSIT';
  groupId: string;
  purchasePrice: number;
  rentLevels: readonly number[];
  mortgageValue: number;
  upgradeCost: number;
  maxUpgradeLevel: number;
};
```

Owner, hipoteca y upgrade actual pertenecen a `GameState`, no a `MapConfig`. La curva debe superar validaciones de no-negatividad, límites y balance. Un mapa puede cambiar economía mediante multiplicadores declarativos y acotados, no alterando saldo directamente.

## Tile effects

Tipos base: `START`, `PROPERTY`, `TAX`, `EVENT`, `BONUS`, `JAIL`, `GO_TO_JAIL`, `TELEPORT`, `CASINO`, `MARKET`, `AUCTION`, `SHOP`, `SPECIAL`.

```ts
type TileConfig =
  | { id: string; type: 'START'; reward: AmountSpec }
  | { id: string; type: 'PROPERTY'; propertyId: string }
  | { id: string; type: 'TAX'; charge: AmountSpec }
  | { id: string; type: 'EVENT'; deckId: string }
  | { id: string; type: 'TELEPORT'; destinations: string[] }
  | { id: string; type: 'SPECIAL'; effectId: RegisteredEffectId; params: unknown };
```

`TileEffect` recibe estado/contexto y produce eventos o una decisión pendiente. No muta, no hace I/O y no acepta callbacks desde JSON.

## Añadir un tipo de casilla

1. Ampliar el discriminante y su schema Zod strict en contratos internos.
2. Definir configuración mínima y límites; evitar un `params: any` general.
3. Registrar handler puro en el engine y decidir qué fases puede abrir.
4. Añadir render semántico y presentación visual en web por registry exhaustivo.
5. Añadir copy/feed derivado de eventos y alternativa accesible.
6. Testear config inválida, landing, timeout, replay y composición con efectos.
7. Verificar que un cliente antiguo no interpreta mal el mapa; subir schema/protocol si hace falta.

Un `SPECIAL` puede servir mientras prototipa una regla registrada, pero no debe convertirse en escape para lógica sin tipo.

## Cartas y eventos

Una carta contiene metadata original, targeting y una lista acotada de efectos declarativos:

```ts
type CardConfig = {
  id: string;
  version: number;
  name: string;
  descriptionKey: string;
  artId: string;
  targeting: TargetSpec;
  effects: EffectSpec[];
  duration?: { unit: 'TURNS' | 'ROUNDS'; value: number };
  tags: string[];
};
```

Effects permitidos pueden incluir `TRANSFER_MONEY`, `CHARGE_PERCENT_OF_CASH`, `MOVE_TO_NODE`, `MOVE_STEPS`, `ADD_RENT_MODIFIER`, `BLOCK_INCOME`, `GRANT_POWER_UP`, `DRAW_CARD` y `REQUEST_CHOICE`. Cada uno tiene schema y handler exhaustivo. Los porcentajes se redondean con política única documentada.

## Añadir una carta o evento

1. Crear ID, nombre, copy y arte originales.
2. Elegir effects existentes; crear uno nuevo solo si tiene semántica reusable.
3. Declarar target, duración, stacking y expiración.
4. Validar que no produce saldo/upgrade fuera de límites ni loop infinito de draws.
5. Añadir al deck/mapa en una nueva versión.
6. Unit tests con seed fija, targets no elegibles, stacking y expiry.
7. Verificar modal/event card, feed, sonido y reduced motion.

Las 40 cartas mínimas deben agruparse por familias de balance: cash transfer/tax, movement, propiedad, renta, mercado global, mitigación y riesgo social. Tener 40 nombres sin tests ni efectos reales no cumple la fase.

## Efectos temporales

Cada efecto activo guarda `sourceId`, `target`, `appliedAtRound/turn`, `expiresAt`, `stackPolicy` (`REPLACE`, `EXTEND`, `MAX`, `STACK_CAPPED`) y parámetros normalizados. El engine emite `EffectApplied` y `EffectExpired`; no depende de `setTimeout` para reglas por rondas.

## Preparación del map editor

El editor futuro debe generar exactamente `MapConfig` y ejecutar el mismo validator que producción. Preview no otorga permiso para publicar. Una pipeline separada revisará autoría, economía, assets, tamaño y compatibilidad antes de cambiar `status` a `PUBLISHED`.
