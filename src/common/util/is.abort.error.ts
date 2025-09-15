import { AbortError } from '@src/types';

export const isAbortError = (error: unknown): error is AbortError => {
  const errorAsAbortError = error as AbortError;
  return (
    errorAsAbortError.name === 'AbortError' && !!errorAsAbortError.code && !!errorAsAbortError.cause
  );
};
