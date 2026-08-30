import axios from 'axios';

export function extractErrorMessage(error: unknown, fallback = 'An error occurred'): string {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data;
    if (data && typeof data === 'object') {
      if ('msg' in data && typeof (data as { msg?: unknown }).msg === 'string') {
        return (data as { msg: string }).msg;
      }
      if ('message' in data && typeof (data as { message?: unknown }).message === 'string') {
        return (data as { message: string }).message;
      }
      if ('error' in data && typeof (data as { error?: unknown }).error === 'string') {
        return (data as { error: string }).error;
      }
    }
    if (typeof error.message === 'string' && error.message) {
      return error.message;
    }
    return fallback;
  }

  if (error instanceof Error) {
    return error.message || fallback;
  }

  if (typeof error === 'string') {
    return error;
  }

  return fallback;
}
