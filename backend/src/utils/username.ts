import { Platform } from '@prisma/client';

export function deriveUsernameFromUrl(platform: Platform | string | null | undefined, profileUrl?: string | null, fallbackName?: string | null): string {
  const plat = String(platform || '').toUpperCase() as Platform | string;
  const url = (profileUrl || '').trim();
  const name = (fallbackName || '').trim();

  try {
    if (url) {
      const u = new URL(url);
      const parts = u.pathname.split('/').filter(Boolean);
      if ((plat === 'TWITCH' || u.hostname.includes('twitch.tv')) && parts.length >= 1) {
        return parts[0].toLowerCase();
      }
      if ((plat === 'KICK' || u.hostname.includes('kick.com')) && parts.length >= 1) {
        return parts[0].toLowerCase();
      }
      if (plat === 'YOUTUBE' || u.hostname.includes('youtube.com')) {
        // Handles: /@handle or /channel/UCxxx
        if (parts.length >= 1) {
          if (parts[0].startsWith('@')) return parts[0].slice(1).toLowerCase();
          if (parts[0] === 'channel' && parts[1]) return parts[1].toLowerCase();
          return parts[0].toLowerCase();
        }
      }
    }
  } catch {}

  return name.toLowerCase();
}

