import api from '../services/api';
import type { SyntheticEvent } from 'react';

export const DEFAULT_EVENT_BANNER =
  'https://images.unsplash.com/photo-1503676260728-1c00da094a0b?w=600';

const API_BASE = (api.defaults.baseURL ?? '').replace(/\/api\/?$/, '');

export function getEventBannerUrl(bannerImage?: string | null): string {
  const value = bannerImage?.trim();
  if (!value) return DEFAULT_EVENT_BANNER;
  if (value.startsWith('http://') || value.startsWith('https://')) return value;
  return `${API_BASE}${value.startsWith('/') ? value : `/${value}`}`;
}

export function handleEventBannerError(event: SyntheticEvent<HTMLImageElement>) {
  const image = event.currentTarget;
  if (image.src !== DEFAULT_EVENT_BANNER) image.src = DEFAULT_EVENT_BANNER;
}