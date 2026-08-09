import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { CreateRoomDrawer } from './CreateRoomDrawer';

describe('CreateRoomDrawer', () => {
  it('shows a rejected lobby request and restores the submit button', async () => {
    const user = userEvent.setup();
    const onCreate = vi.fn().mockRejectedValue(new Error('Ya tienes una partida activa.'));

    render(<CreateRoomDrawer initialPrivate onClose={vi.fn()} onCreate={onCreate} />);

    const submit = screen.getByRole('button', { name: /crear partida · clásico/i });
    await user.click(submit);

    expect(await screen.findByRole('alert')).toHaveTextContent('Ya tienes una partida activa.');
    expect(submit).toBeEnabled();
    expect(onCreate).toHaveBeenCalledWith(
      expect.objectContaining({ visibility: 'PRIVATE', mode: 'CLASSIC' }),
      undefined
    );
  });
});
