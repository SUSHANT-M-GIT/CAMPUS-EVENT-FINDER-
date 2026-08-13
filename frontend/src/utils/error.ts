import axios from 'axios';

export function extractErrorMessage(error: unknown, fallback = 'An error occurred'): string {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data;
    if (data && typeof data === 'object' && 'msg' in data) {
      const maybeMsg = (data as { msg?: unknown }).msg;
      if (typeof maybeMsg === 'string') {
        return maybeMsg;
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
