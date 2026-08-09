import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { soundManager } from '../audio/sound-manager';
import { SoundControls } from './SoundControls';

describe('SoundControls', () => {
  afterEach(cleanup);

  beforeEach(() => {
    window.localStorage.clear();
    soundManager.setSettings({ master: 0.72, music: 0.22, sfx: 0.7, muted: false });
  });

  it('updates and persists the music volume', () => {
    render(<SoundControls />);
    fireEvent.click(screen.getByRole('button', { name: 'Sound settings' }));
    fireEvent.change(screen.getByRole('slider', { name: 'Music volume' }), {
      target: { value: '35' }
    });

    expect(screen.getByText('35%')).toBeInTheDocument();
    expect(window.localStorage.getItem('atlas-estates:audio:v1')).toContain('"music":0.35');
  });

  it('supports muting every sound channel at once', () => {
    render(<SoundControls />);
    fireEvent.click(screen.getByRole('button', { name: 'Sound settings' }));
    fireEvent.click(screen.getByRole('button', { name: 'Mute all' }));

    expect(screen.getByRole('button', { name: 'Enable sound' })).toBeInTheDocument();
    expect(window.localStorage.getItem('atlas-estates:audio:v1')).toContain('"muted":true');
  });
});
