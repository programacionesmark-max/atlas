import type { GameMode, RoomSettings } from '@circuit/shared';
import { Check, ChevronRight, Gavel, Handshake, LockKeyhole, Sparkles, X } from 'lucide-react';
import { useMemo, useState, type FormEvent } from 'react';

import { ATLAS_MAPS, ATLAS_MODES } from '../data/atlas';

const defaultSettings: RoomSettings = {
  name: 'Mesa de Jamie',
  visibility: 'PUBLIC',
  maxPlayers: 4,
  mapId: 'neon-city',
  mode: 'CLASSIC',
  allowSpectators: true,
  rules: {
    startingCash: 3200,
    turnTimerSeconds: 45,
    victoryMode: 'LAST_PLAYER_STANDING',
    maxRounds: 30,
    netWorthTarget: null,
    auctionsEnabled: true,
    tradesEnabled: true,
    economicEventsEnabled: true,
    doublesExtraRoll: true
  }
};

interface CreateRoomDrawerProps {
  initialPrivate: boolean;
  initialMapId?: string | null;
  initialMode?: GameMode | null;
  onClose: () => void;
  onCreate: (settings: RoomSettings, password?: string) => Promise<void>;
}

export function CreateRoomDrawer({
  initialPrivate,
  initialMapId,
  initialMode,
  onClose,
  onCreate
}: CreateRoomDrawerProps) {
  const initialModeView = ATLAS_MODES.find((mode) => mode.id === initialMode) ?? ATLAS_MODES[0]!;
  const [settings, setSettings] = useState<RoomSettings>(() =>
    applyMode(
      {
        ...defaultSettings,
        visibility: initialPrivate ? 'PRIVATE' : 'PUBLIC',
        ...(ATLAS_MAPS.some((map) => map.config.id === initialMapId)
          ? { mapId: initialMapId! }
          : {})
      },
      initialModeView.id
    )
  );
  const [password, setPassword] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(initialModeView.id === 'CUSTOM');
  const selectedMap = useMemo(
    () => ATLAS_MAPS.find((map) => map.config.id === settings.mapId) ?? ATLAS_MAPS[0]!,
    [settings.mapId]
  );
  const selectedMode = ATLAS_MODES.find((mode) => mode.id === settings.mode) ?? ATLAS_MODES[0]!;

  function updateRule<K extends keyof RoomSettings['rules']>(
    key: K,
    value: RoomSettings['rules'][K]
  ): void {
    setSettings((current) => ({ ...current, rules: { ...current.rules, [key]: value } }));
  }

  async function submit(event: FormEvent): Promise<void> {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      await onCreate(
        settings,
        settings.visibility === 'PRIVATE' && password ? password : undefined
      );
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : 'No se pudo crear la partida. Inténtalo de nuevo.'
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <aside className="create-drawer create-drawer--atlas" aria-label="Crear partida">
      <div className="drawer-title">
        <div>
          <span className="section-label">Nueva expedición</span>
          <h2>Elige tu próxima ruta</h2>
        </div>
        <button type="button" onClick={onClose} aria-label="Cerrar">
          <X />
        </button>
      </div>
      <form onSubmit={(event) => void submit(event)}>
        <section className="route-picker" aria-labelledby="route-title">
          <div className="picker-heading">
            <h3 id="route-title">Mapa</h3>
            <span>32 casillas por circuito</span>
          </div>
          <div className="route-tabs" role="tablist" aria-label="Mapas disponibles">
            {ATLAS_MAPS.map((map) => (
              <button
                key={map.config.id}
                type="button"
                role="tab"
                aria-selected={settings.mapId === map.config.id}
                className={settings.mapId === map.config.id ? 'is-selected' : ''}
                onClick={() => setSettings((current) => ({ ...current, mapId: map.config.id }))}
              >
                {map.config.name}
              </button>
            ))}
          </div>
          <button
            className="route-preview"
            type="button"
            onClick={() => setSettings((current) => ({ ...current, mapId: selectedMap.config.id }))}
            style={{ '--route-accent': selectedMap.accent } as React.CSSProperties}
          >
            <img src={selectedMap.image} alt="" />
            <span>
              <small>{selectedMap.eyebrow}</small>
              <strong>{selectedMap.config.name}</strong>
              <em>{selectedMap.config.theme}</em>
            </span>
            <Check aria-hidden="true" />
          </button>
        </section>

        <section className="mode-picker" aria-labelledby="mode-title">
          <div className="picker-heading">
            <h3 id="mode-title">Modo de juego</h3>
            <span>9 reglas distintas</span>
          </div>
          <div className="mode-list">
            {ATLAS_MODES.map((mode) => (
              <button
                key={mode.id}
                type="button"
                className={settings.mode === mode.id ? 'is-selected' : ''}
                aria-pressed={settings.mode === mode.id}
                onClick={() => {
                  setSettings((current) => applyMode(current, mode.id));
                  setShowAdvanced(mode.id === 'CUSTOM');
                }}
              >
                <i>{mode.icon}</i>
                <span>
                  <strong>{mode.name}</strong>
                  <small>{mode.description}</small>
                </span>
                <ChevronRight />
              </button>
            ))}
          </div>
          <div className="mode-detail">
            <strong>{selectedMode.name}</strong>
            <p>{selectedMode.description}</p>
            <ul>
              {selectedMode.rules.map((rule) => (
                <li key={rule}>{rule}</li>
              ))}
            </ul>
          </div>
        </section>

        <section className="room-basics">
          <label>
            Nombre de la sala
            <input
              value={settings.name}
              onChange={(event) => setSettings({ ...settings, name: event.target.value })}
              minLength={2}
              maxLength={40}
              required
            />
          </label>
          <fieldset className="segmented-field">
            <legend>Acceso</legend>
            <button
              type="button"
              className={settings.visibility === 'PUBLIC' ? 'is-selected' : ''}
              onClick={() => setSettings({ ...settings, visibility: 'PUBLIC' })}
            >
              Pública
            </button>
            <button
              type="button"
              className={settings.visibility === 'PRIVATE' ? 'is-selected' : ''}
              onClick={() => setSettings({ ...settings, visibility: 'PRIVATE' })}
            >
              <LockKeyhole /> Privada
            </button>
          </fieldset>
          {settings.visibility === 'PRIVATE' ? (
            <label>
              Contraseña (opcional)
              <input
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                minLength={4}
                maxLength={72}
              />
            </label>
          ) : null}
          <label>
            Jugadores
            <input
              type="number"
              min={2}
              max={8}
              value={settings.maxPlayers}
              disabled={settings.mode === 'DUEL'}
              onChange={(event) =>
                setSettings({ ...settings, maxPlayers: Number(event.target.value) })
              }
            />
          </label>
        </section>

        <button
          className="advanced-toggle"
          type="button"
          onClick={() => setShowAdvanced((value) => !value)}
        >
          Ajustes avanzados <span>{showAdvanced ? '−' : '+'}</span>
        </button>
        {showAdvanced ? (
          <section className="advanced-rules">
            <label>
              Dinero inicial
              <input
                type="number"
                min={500}
                max={1000000}
                step={100}
                value={settings.rules.startingCash}
                onChange={(event) => updateRule('startingCash', Number(event.target.value))}
              />
            </label>
            <label>
              Temporizador
              <select
                value={settings.rules.turnTimerSeconds}
                onChange={(event) =>
                  updateRule(
                    'turnTimerSeconds',
                    Number(event.target.value) as 0 | 15 | 30 | 45 | 60
                  )
                }
              >
                <option value={15}>15 s</option>
                <option value={30}>30 s</option>
                <option value={45}>45 s</option>
                <option value={60}>60 s</option>
                <option value={0}>Sin límite</option>
              </select>
            </label>
            <div className="toggle-list">
              <Toggle
                label="Subastas"
                icon={<Gavel />}
                checked={settings.rules.auctionsEnabled}
                onChange={(value) => updateRule('auctionsEnabled', value)}
              />
              <Toggle
                label="Tratos"
                icon={<Handshake />}
                checked={settings.rules.tradesEnabled}
                onChange={(value) => updateRule('tradesEnabled', value)}
              />
              <Toggle
                label="Eventos"
                icon={<Sparkles />}
                checked={settings.rules.economicEventsEnabled}
                onChange={(value) => updateRule('economicEventsEnabled', value)}
              />
            </div>
          </section>
        ) : null}

        {error ? (
          <div className="drawer-error" role="alert">
            {error}
          </div>
        ) : null}

        <button type="submit" className="button button--primary drawer-submit" disabled={pending}>
          {pending ? 'Creando…' : `Crear partida · ${selectedMode.name}`}
        </button>
      </form>
    </aside>
  );
}

function applyMode(settings: RoomSettings, modeId: GameMode): RoomSettings {
  const mode = ATLAS_MODES.find((item) => item.id === modeId) ?? ATLAS_MODES[0]!;
  const { maxPlayers, ...rulePreset } = mode.preset;
  return {
    ...settings,
    mode: modeId,
    maxPlayers:
      maxPlayers ??
      (settings.maxPlayers === 2 && settings.mode === 'DUEL' ? 4 : settings.maxPlayers),
    rules: { ...settings.rules, ...rulePreset }
  };
}

function Toggle({
  label,
  icon,
  checked,
  onChange
}: {
  label: string;
  icon: React.ReactNode;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="toggle-row">
      <span>
        {icon}
        {label}
      </span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span className="toggle-control" aria-hidden="true" />
    </label>
  );
}
