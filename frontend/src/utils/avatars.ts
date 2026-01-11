/**
 * Generate initials from email or name
 */
const getInitials = (seed: string): string => {
  if (!seed) return 'U';
  const parts = seed.split('@')[0].split(/[._-]/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  } else if (parts[0].length >= 2) {
    return parts[0].substring(0, 2).toUpperCase();
  }
  return parts[0][0].toUpperCase();
};

/**
 * Generate color from seed
 */
const getColorFromSeed = (seed: string): string => {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = seed.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = hash % 360;
  return `hsl(${hue}, 70%, 60%)`;
};

/**
 * Generate a local SVG avatar as fallback
 */
const getLocalAvatar = (seed: string): string => {
  const initials = getInitials(seed);
  const color = getColorFromSeed(seed);

  return `data:image/svg+xml;utf8,${encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'>
      <rect width='100' height='100' fill='${color}'/>
      <text x='50' y='50' text-anchor='middle' dy='0.35em' font-family='system-ui, -apple-system, sans-serif' font-size='40' font-weight='600' fill='white'>${initials}</text>
    </svg>`
  )}`;
};

/**
 * Generate user avatar with yellow background
 * Uses UI Avatars API with yellow background
 */
export const getUserAvatar = (seed: string): string => {
  if (!seed) return getLocalAvatar('User');

  // Use UI Avatars API with yellow background (#FF6B35)
  const name = seed.split('@')[0].replace(/[._-]/g, ' ');
  const encodedName = encodeURIComponent(name);

  // UI Avatars with yellow background and black text
  return `https://ui-avatars.com/api/?name=${encodedName}&background=FF6B35&color=fff&size=128&bold=true&format=svg`;
};

// Default placeholder avatar from Bunny CDN
export const DEFAULT_AVATAR = 'https://todoalrojo.b-cdn.net/envisioner/icono.jpg';

// Legacy AVATARS array - now all point to the same Bunny CDN placeholder
export const AVATARS: string[] = [
  DEFAULT_AVATAR,
  DEFAULT_AVATAR,
  DEFAULT_AVATAR,
  DEFAULT_AVATAR,
  DEFAULT_AVATAR,
  DEFAULT_AVATAR,
];

/**
 * Get the avatar URL, using Bunny CDN URLs directly
 * For all platforms, avatars should ideally be on Bunny CDN (media.envr.io)
 * Non-Bunny URLs are proxied through weserv.nl for reliability
 */
const proxyImageUrl = (url: string): string => {
  if (!url) return url;

  // Bunny CDN URLs work directly - no proxy needed
  if (url.includes('media.envr.io') || url.includes('.b-cdn.net')) {
    return url;
  }

  // Kick CDN works directly - no proxy needed (files.kick.com)
  if (url.includes('files.kick.com') || url.includes('kick.com/images')) {
    return url;
  }

  // Twitch CDN works directly - no proxy needed
  if (url.includes('static-cdn.jtvnw.net')) {
    return url;
  }

  // YouTube CDN works directly - no proxy needed
  if (url.includes('yt3.ggpht.com') || url.includes('yt3.googleusercontent.com')) {
    return url;
  }

  // Proxy platforms with CORS issues through weserv.nl
  const needsProxy =
    // Instagram / Facebook (CORS issues)
    url.includes('instagram.') ||
    url.includes('fbcdn.net') ||
    url.includes('cdninstagram.') ||
    // TikTok (CORS issues)
    url.includes('tiktokcdn.') ||
    url.includes('tiktok.com');

  if (needsProxy) {
    return `https://wsrv.nl/?url=${encodeURIComponent(url)}&w=300&h=300&fit=cover&output=jpg`;
  }

  return url;
};

/**
 * Get avatar URL for a streamer
 * @param streamer - Streamer object with username and avatarUrl
 * @returns Avatar URL (streamer's avatar or Bunny CDN placeholder)
 */
export const getStreamerAvatar = (streamer: any): string => {
  if (streamer?.avatarUrl && streamer.avatarUrl.trim() !== '') {
    return proxyImageUrl(streamer.avatarUrl);
  }
  // Use Bunny CDN placeholder as fallback
  return DEFAULT_AVATAR;
};

