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

// Simple SVG gradient avatar placeholders as data URIs
const svg = (g1: string, g2: string) =>
  `data:image/svg+xml;utf8,` +
  encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'>
      <defs>
        <linearGradient id='g' x1='0' y1='0' x2='1' y2='1'>
          <stop offset='0%' stop-color='${g1}'/>
          <stop offset='100%' stop-color='${g2}'/>
        </linearGradient>
      </defs>
      <rect width='64' height='64' rx='32' fill='url(%23g)'/>
      <circle cx='32' cy='24' r='10' fill='rgba(255,255,255,0.6)'/>
      <path d='M16 52c4-10 28-10 32 0' fill='rgba(255,255,255,0.5)'/>
    </svg>`
  );

export const AVATARS: string[] = [
  svg('#FF6B35','#FF6B35'),
  svg('#FF6B35','#FF6B35'),
  svg('#FF6B35','#FF6B35'),
  svg('#FF6B35','#FF6B35'),
  svg('#FF6B35','#FF6B35'),
  svg('#FF6B35','#FF6B35'),
];

/**
 * Get avatar URL for a streamer
 * @param streamer - Streamer object with username and avatarUrl
 * @param fallbackIndex - Index for fallback avatar if no avatarUrl exists
 * @returns Avatar URL (streamer's avatar or local generated)
 */
export const getStreamerAvatar = (streamer: any, fallbackIndex: number = 0): string => {
  if (streamer?.avatarUrl && streamer.avatarUrl.trim() !== '') {
    return streamer.avatarUrl;
  }
  // Use local avatar fallback
  return AVATARS[fallbackIndex % AVATARS.length];
};

