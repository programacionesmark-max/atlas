import type { ApiError } from '@circuit/shared';

export class RequestError extends Error {
  constructor(
    readonly code: ApiError['code'],
    message: string,
    readonly details?: ApiError['details']
  ) {
    super(message);
    this.name = 'RequestError';
  }
}

export function toApiError(error: unknown): ApiError {
  if (error instanceof RequestError) {
    return error.details === undefined
      ? { code: error.code, message: error.message }
      : { code: error.code, message: error.message, details: error.details };
  }
  const engineError = error as { code?: unknown; message?: unknown };
  if (typeof engineError.code === 'string' && typeof engineError.message === 'string') {
    const code =
      engineError.code === 'STALE_REVISION'
        ? 'STALE_STATE'
        : engineError.code === 'NOT_FOUND'
          ? 'NOT_FOUND'
          : 'BAD_REQUEST';
    return { code, message: engineError.message };
  }
  return { code: 'INTERNAL_ERROR', message: 'An unexpected server error occurred' };
}
