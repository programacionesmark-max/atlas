import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it } from 'vitest';

import { useRealtimeStore } from '../store/realtime';
import { HomeScreen } from './HomeScreen';

describe('HomeScreen', () => {
  beforeEach(() => {
    localStorage.clear();
    useRealtimeStore.setState({
      connected: true,
      identity: null,
      sessionPending: false,
      error: null
    });
  });

  it('requires a valid nickname before enabling real matchmaking', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <HomeScreen />
      </MemoryRouter>
    );

    const play = screen.getByRole('button', { name: /^play$/i });
    expect(play).toBeDisabled();
    await user.type(screen.getByLabelText(/nickname/i), 'Jamie');
    expect(play).toBeEnabled();
  });
});
