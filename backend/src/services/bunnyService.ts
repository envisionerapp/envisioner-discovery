/**
 * Bunny.net Storage helper
 * Uploads images to Bunny Storage and serves via CDN
 */

const BUNNY_API_KEY = process.env.BUNNY_STORAGE_API_KEY?.trim();
const BUNNY_STORAGE_ZONE = process.env.BUNNY_STORAGE_ZONE?.trim();
const BUNNY_CDN_HOSTNAME = process.env.BUNNY_CDN_HOSTNAME?.trim();
const BUNNY_STORAGE_REGION = (process.env.BUNNY_STORAGE_REGION || '').trim();

// Storage endpoint - use regional endpoint if specified (e.g., 'br', 'ny', 'la', 'sg')
const BUNNY_STORAGE_HOST = BUNNY_STORAGE_REGION
  ? `${BUNNY_STORAGE_REGION}.storage.bunnycdn.com`
  : 'storage.bunnycdn.com';
const BUNNY_STORAGE_URL = `https://${BUNNY_STORAGE_HOST}/${BUNNY_STORAGE_ZONE}`;

/**
 * Check if Bunny Storage is configured
 */
export function isConfigured(): boolean {
  return !!(BUNNY_API_KEY && BUNNY_STORAGE_ZONE && BUNNY_CDN_HOSTNAME);
}

/**
 * Upload an image from URL to Bunny Storage
 * @param imageUrl - Source image URL to download
 * @param path - Destination path in storage (e.g., "avatars/instagram/username.jpg")
 * @returns CDN URL of uploaded image, or null on failure
 */
export async function uploadFromUrl(imageUrl: string, path: string): Promise<string | null> {
  if (!isConfigured()) {
    console.error('Bunny Storage not configured');
    return null;
  }

  try {
    // Download image
    const imageResponse = await fetch(imageUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });

    if (!imageResponse.ok) {
      console.error('Failed to download image:', imageResponse.status, imageUrl);
      return null;
    }

    const imageBuffer = await imageResponse.arrayBuffer();

    // Upload to Bunny Storage
    const uploadUrl = `${BUNNY_STORAGE_URL}/${path}`;
    const uploadResponse = await fetch(uploadUrl, {
      method: 'PUT',
      headers: {
        'AccessKey': BUNNY_API_KEY!,
        'Content-Type': 'application/octet-stream',
      },
      body: imageBuffer,
    });

    if (!uploadResponse.ok) {
      const text = await uploadResponse.text();
      console.error('Bunny upload failed:', uploadResponse.status, text);
      return null;
    }

    // Return CDN URL with format conversion for browser compatibility
    const cdnUrl = `https://${BUNNY_CDN_HOSTNAME}/${path}`;
    return cdnUrl;
  } catch (error: any) {
    console.error('Bunny upload error:', error.message);
    return null;
  }
}

/**
 * Upload Instagram avatar to Bunny CDN
 * @param username - Instagram username
 * @param avatarUrl - Instagram avatar URL
 * @returns Bunny CDN URL or original URL if upload fails
 */
export async function uploadInstagramAvatar(username: string, avatarUrl: string): Promise<string> {
  if (!avatarUrl || !isConfigured()) {
    return avatarUrl;
  }

  // Skip if already a Bunny CDN URL
  if (avatarUrl.includes(BUNNY_CDN_HOSTNAME!)) {
    return avatarUrl;
  }

  const path = `avatars/instagram/${username.toLowerCase()}.jpg`;
  const cdnUrl = await uploadFromUrl(avatarUrl, path);

  return cdnUrl || avatarUrl;
}

/**
 * Upload TikTok avatar to Bunny CDN
 */
export async function uploadTikTokAvatar(username: string, avatarUrl: string): Promise<string> {
  if (!avatarUrl || !isConfigured()) {
    return avatarUrl;
  }

  if (avatarUrl.includes(BUNNY_CDN_HOSTNAME!)) {
    return avatarUrl;
  }

  const path = `avatars/tiktok/${username.toLowerCase()}.jpg`;
  const cdnUrl = await uploadFromUrl(avatarUrl, path);

  return cdnUrl || avatarUrl;
}

/**
 * Upload LinkedIn avatar to Bunny CDN
 * Uses Bunny Optimizer to upscale from 200x200 to 400x400 with sharpening
 */
export async function uploadLinkedInAvatar(username: string, avatarUrl: string): Promise<string> {
  if (!avatarUrl || !isConfigured()) {
    return avatarUrl;
  }

  if (avatarUrl.includes(BUNNY_CDN_HOSTNAME!)) {
    return avatarUrl;
  }

  const path = `avatars/linkedin/${username.toLowerCase()}.jpg`;
  const cdnUrl = await uploadFromUrl(avatarUrl, path);

  if (cdnUrl) {
    // Add Bunny Optimizer params to upscale and sharpen the 200x200 image
    return `${cdnUrl}?width=400&height=400&sharpen=true`;
  }

  return avatarUrl;
}

export const bunnyService = {
  isConfigured,
  uploadFromUrl,
  uploadInstagramAvatar,
  uploadTikTokAvatar,
  uploadLinkedInAvatar,
};
