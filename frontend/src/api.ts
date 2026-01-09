// API Configuration
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5001';

// Check if running inside Softr
export const isSoftrContext = (): boolean => {
  // Check for Softr's logged_in_user object
  if ((window as any).logged_in_user) return true;

  // Check for Softr in URL/referrer
  const href = window.location.href;
  const referrer = document.referrer;
  if (href.includes('.softr.') || referrer.includes('.softr.')) return true;

  // Check for parent frame (embedded in Softr)
  try {
    if (window.parent !== window && document.referrer.includes('softr')) return true;
  } catch (e) {
    // Cross-origin frame, likely embedded
    return true;
  }

  // Development mode bypass
  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    return true;
  }

  return false;
};

// Get user email - prioritizes Softr user, then URL param
export const getUserEmail = (): string | null => {
  // 1. Check Softr logged-in user
  const softrUser = (window as any).logged_in_user;
  if (softrUser?.email) {
    return softrUser.email;
  }

  // 2. Check URL parameter
  const urlParams = new URLSearchParams(window.location.search);
  const urlUser = urlParams.get('user') || urlParams.get('email');
  if (urlUser) {
    return urlUser;
  }

  return null;
};

// Get user ID for favorites - prioritizes Softr user, then URL param, then localStorage
const getUserId = (): string => {
  const email = getUserEmail();
  if (email) return email;

  // Fallback to localStorage for anonymous users (dev mode only)
  let userId = localStorage.getItem('discovery_user_id');
  if (!userId) {
    userId = 'anon_' + Math.random().toString(36).substring(2, 15);
    localStorage.setItem('discovery_user_id', userId);
  }
  return userId;
};

export const USER_ID = getUserId();

// Access validation response
export interface AccessValidationResult {
  success: boolean;
  error?: 'ACCESS_DENIED' | 'NO_EMAIL' | 'USER_NOT_FOUND' | 'SERVER_ERROR';
  message?: string;
  user?: {
    id: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
  };
}

// Validate user access (Softr context + email in users table)
export async function validateAccess(): Promise<AccessValidationResult> {
  const email = getUserEmail();
  const softrContext = isSoftrContext();

  try {
    const response = await fetch(`${API_BASE_URL}/api/access/validate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Softr-App': softrContext ? 'true' : 'false',
      },
      body: JSON.stringify({ email, softrContext }),
    });

    return await response.json();
  } catch (error) {
    return {
      success: false,
      error: 'SERVER_ERROR',
      message: 'Failed to connect to server',
    };
  }
}

// Types matching backend response
export interface ApiCreator {
  id: string;
  platform: string;
  username: string;
  displayName: string;
  profileUrl: string | null;
  avatarUrl: string | null;
  followers: number;
  currentViewers: number | null;
  highestViewers: number | null;
  isLive: boolean;
  currentGame: string | null;
  primaryCategory: string | null;
  tags: string[];
  region: string;
  language: string;
  totalViews: number;
  totalLikes: number;
  totalComments: number;
  totalShares: number;
  avgViewers: number;
  minutesWatched: number;
  durationMinutes: number;
  engagementRate: number;
  lastScrapedAt: string | null;
  lastStreamed: string | null;
}

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  error?: string;
}

export interface FetchCreatorsParams {
  page?: number;
  limit?: number;
  search?: string;
  platforms?: string[];
  regions?: string[];
  categories?: string[];
  minFollowers?: number;
  maxFollowers?: number;
  minViews?: number;
  maxViews?: number;
  minEngagement?: number;
  minAvgViewers?: number;
  maxLastActive?: number;
  favoritesOnly?: boolean;
  sort?: string;
  dir?: 'asc' | 'desc';
}

// Fetch creators with filters
export async function fetchCreators(params: FetchCreatorsParams = {}): Promise<ApiResponse<ApiCreator[]>> {
  const queryParams = new URLSearchParams();

  if (params.page) queryParams.set('page', params.page.toString());
  if (params.limit) queryParams.set('limit', params.limit.toString());
  if (params.search) queryParams.set('search', params.search);
  if (params.platforms?.length) queryParams.set('platforms', params.platforms.join(','));
  if (params.regions?.length) queryParams.set('regions', params.regions.join(','));
  if (params.categories?.length) queryParams.set('categories', params.categories.join(','));
  if (params.minFollowers) queryParams.set('minFollowers', params.minFollowers.toString());
  if (params.maxFollowers) queryParams.set('maxFollowers', params.maxFollowers.toString());
  if (params.minViews) queryParams.set('minViews', params.minViews.toString());
  if (params.maxViews) queryParams.set('maxViews', params.maxViews.toString());
  if (params.minEngagement) queryParams.set('minEngagement', params.minEngagement.toString());
  if (params.minAvgViewers) queryParams.set('minAvgViewers', params.minAvgViewers.toString());
  if (params.maxLastActive) queryParams.set('maxLastActive', params.maxLastActive.toString());
  if (params.favoritesOnly) {
    queryParams.set('favoritesOnly', 'true');
    queryParams.set('userId', USER_ID);
  }
  if (params.sort) queryParams.set('sort', params.sort);
  if (params.dir) queryParams.set('dir', params.dir);

  const response = await fetch(`${API_BASE_URL}/api/streamers?${queryParams.toString()}`);
  return response.json();
}

// Fetch favorite IDs
export async function fetchFavoriteIds(): Promise<string[]> {
  const response = await fetch(`${API_BASE_URL}/api/favorites/ids?userId=${USER_ID}`);
  const data: ApiResponse<string[]> = await response.json();
  return data.success ? data.data : [];
}

// Toggle favorite
export async function toggleFavorite(streamerId: string): Promise<{ isFavorite: boolean }> {
  const response = await fetch(`${API_BASE_URL}/api/favorites/toggle`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId: USER_ID, streamerId }),
  });
  const data = await response.json();
  return { isFavorite: data.isFavorite };
}

// Helper to format "last active" from timestamp
export function formatLastActive(lastScrapedAt: string | null, isLive: boolean): string {
  if (isLive) return 'Live now';
  if (!lastScrapedAt) return 'Unknown';

  const date = new Date(lastScrapedAt);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
  return `${Math.floor(diffDays / 365)} years ago`;
}

// Helper to get days since last active
export function getDaysSinceActive(lastScrapedAt: string | null, isLive: boolean): number {
  if (isLive) return 0;
  if (!lastScrapedAt) return 999;

  const date = new Date(lastScrapedAt);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}
