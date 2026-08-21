import { describe, expect, it, vi } from 'vitest';

import { createClientId } from './client-id';

describe('createClientId', () => {
  it('uses randomUUID when the browser provides it', () => {
    const randomUUID = vi.fn(() => '5b3fcf54-af31-49e7-b9cd-d77d142a5d5c');
    expect(createClientId({ randomUUID })).toBe('5b3fcf54-af31-49e7-b9cd-d77d142a5d5c');
    expect(randomUUID).toHaveBeenCalledOnce();
  });

  it('creates a valid v4 UUID on an insecure LAN origin', () => {
    const id = createClientId({
      getRandomValues(bytes) {
        bytes.fill(17);
        return bytes;
      }
    });
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });
});
