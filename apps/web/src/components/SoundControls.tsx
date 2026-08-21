import { Music2, Volume2, VolumeX, X } from 'lucide-react';
import { useState, useSyncExternalStore } from 'react';

import { soundManager } from '../audio/sound-manager';

export function SoundControls() {
  const [open, setOpen] = useState(false);
  const settings = useSyncExternalStore(
    soundManager.subscribe,
    soundManager.getSnapshot,
    soundManager.getSnapshot
  );

  function update(key: 'master' | 'music' | 'sfx', value: string): void {
    void soundManager.unlock();
    soundManager.setSettings({ [key]: Number(value) / 100 });
  }

  return (
    <div className="sound-controls">
      <button
        className="sound-controls__trigger"
        type="button"
        aria-label={settings.muted ? 'Sonido silenciado' : 'Ajustes de sonido'}
        aria-expanded={open}
        onClick={() => {
          void soundManager.unlock();
          setOpen((value) => !value);
        }}
      >
        {settings.muted ? <VolumeX /> : <Volume2 />}
      </button>
      {open ? (
        <section className="sound-panel" role="dialog" aria-label="Ajustes de sonido">
          <div className="sound-panel__title">
            <span>
              <Music2 /> Sonido
            </span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Cerrar ajustes de sonido"
            >
              <X />
            </button>
          </div>
          <VolumeSlider
            label="General"
            value={settings.master}
            onChange={(v) => update('master', v)}
          />
          <VolumeSlider
            label="Música"
            value={settings.music}
            onChange={(v) => update('music', v)}
          />
          <VolumeSlider label="Efectos" value={settings.sfx} onChange={(v) => update('sfx', v)} />
          <button
            className="button button--outline sound-panel__mute"
            type="button"
            onClick={() => soundManager.setSettings({ muted: !settings.muted })}
          >
            {settings.muted ? <Volume2 /> : <VolumeX />}
            {settings.muted ? 'Activar sonido' : 'Silenciar todo'}
          </button>
        </section>
      ) : null}
    </div>
  );
}

function VolumeSlider({
  label,
  value,
  onChange
}: {
  label: string;
  value: number;
  onChange: (value: string) => void;
}) {
  const percentage = Math.round(value * 100);
  return (
    <label className="volume-slider">
      <span>{label}</span>
      <output>{percentage}%</output>
      <input
        type="range"
        min="0"
        max="100"
        step="1"
        value={percentage}
        onChange={(event) => onChange(event.target.value)}
        aria-label={`Volumen de ${label.toLowerCase()}`}
      />
    </label>
  );
}
