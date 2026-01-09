import axios from 'axios';
import { withBase } from '@/utils/api';
import { User, AuthTokens } from '../types';

interface LoginResponse {
  success?: boolean; // backend returns this at top level; we ignore it
  requiresMfa?: boolean;
  userId?: string;
  tokens?: AuthTokens;
  user?: User;
}

interface MfaVerifyResponse {
  accessToken: string;
  refreshToken: string;
  user: User;
}

class AuthService {
  private baseURL = withBase('/api/auth');

  async login(email: string, password: string): Promise<LoginResponse> {
    console.log('🌐 API DEBUG: Login request starting', {
      email,
      url: `${this.baseURL}/login`,
      baseURL: this.baseURL
    });

    const response = await axios.post(`${this.baseURL}/login`, { email, password });

    console.log('🌐 API DEBUG: Login response received', {
      status: response.status,
      headers: response.headers,
      data: response.data,
      responseDataStructure: {
        hasResponse: !!response.data,
        responseType: typeof response.data,
        hasSuccess: response.data && 'success' in response.data,
        hasData: response.data && 'data' in response.data,
        dataType: response.data?.data ? typeof response.data.data : 'no-data',
        keys: response.data ? Object.keys(response.data) : []
      }
    });

    // Handle cases where response.data might be undefined/null
    if (!response.data) {
      console.log('🌐 API DEBUG: Response data is null/undefined');
      throw new Error('Empty response from server');
    }

    // Backend shape: { success: true, data: { tokens, user } }
    const result = response.data.data ?? response.data;
    console.log('🌐 API DEBUG: Login result processed', result);
    return result;
  }

  async verifyMfa(token: string, userId: string): Promise<MfaVerifyResponse> {
    const response = await axios.post(`${this.baseURL}/verify-mfa`, {
      token,
      userId,
    });

    return response.data.data;
  }

  async refreshToken(): Promise<AuthTokens> {
    const refreshToken = localStorage.getItem('mielo_refresh_token');
    console.log('🌐 API DEBUG: refreshToken called', {
      hasRefreshToken: !!refreshToken,
      refreshTokenLength: refreshToken?.length
    });

    if (!refreshToken) {
      console.log('🌐 API DEBUG: No refresh token found - throwing error');
      throw new Error('No refresh token found');
    }

    console.log('🌐 API DEBUG: Calling refresh endpoint...');
    const response = await axios.post(`${this.baseURL}/refresh`, {
      refreshToken,
    });

    console.log('🌐 API DEBUG: Refresh response received', {
      status: response.status,
      data: response.data
    });

    const tokens = response.data.data;
    localStorage.setItem('mielo_access_token', tokens.accessToken);
    localStorage.setItem('mielo_refresh_token', tokens.refreshToken);

    console.log('🌐 API DEBUG: New tokens stored', {
      hasAccessToken: !!tokens.accessToken,
      hasRefreshToken: !!tokens.refreshToken
    });

    return tokens;
  }

  async logout(): Promise<void> {
    try {
      await axios.post(`${this.baseURL}/logout`);
    } catch (error) {
      console.error('Logout request failed:', error);
    }
  }

  async getCurrentUser(): Promise<User> {
    console.log('🌐 API DEBUG: getCurrentUser request starting');
    try {
      const response = await axios.get(withBase('/api/auth/me'));
      console.log('🌐 API DEBUG: getCurrentUser response', {
        status: response.status,
        data: response.data
      });
      return response.data.data;
    } catch (error) {
      console.log('🌐 API DEBUG: getCurrentUser failed', error);
      throw error;
    }
  }

  getAuthHeader(): { Authorization: string } | {} {
    const token = localStorage.getItem('mielo_access_token');
    return token ? { Authorization: `Bearer ${token}` } : {};
  }
}

// Add request interceptor to include auth header or embed headers
axios.interceptors.request.use(
  (config) => {
    // Check if in embed mode (from sessionStorage)
    const embedState = sessionStorage.getItem('mielo_embed_mode');
    const isEmbedMode = embedState ? JSON.parse(embedState).isEmbedMode : false;
    const isValidReferrer = embedState ? JSON.parse(embedState).isValidReferrer : false;

    console.log('🌐 AXIOS DEBUG: Request interceptor', {
      url: config.url,
      method: config.method,
      isEmbedMode,
      isValidReferrer
    });

    if (isEmbedMode && isValidReferrer) {
      // Embed mode: send embed headers instead of auth token
      config.headers['X-Embed-Mode'] = 'true';
      config.headers['X-Embed-Referrer'] = document.referrer || '';
    } else {
      // Normal mode: send auth token
      const token = localStorage.getItem('mielo_access_token');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    }
    return config;
  },
  (error) => {
    console.log('🌐 AXIOS DEBUG: Request interceptor error', error);
    return Promise.reject(error);
  }
);

// Add response interceptor to handle token expiration
axios.interceptors.response.use(
  (response) => {
    console.log('🌐 AXIOS DEBUG: Response interceptor success', {
      url: response.config.url,
      status: response.status,
      method: response.config.method
    });
    return response;
  },
  async (error) => {
    console.log('🌐 AXIOS DEBUG: Response interceptor error', {
      url: error.config?.url,
      method: error.config?.method,
      status: error.response?.status,
      message: error.message,
      hasResponse: !!error.response,
      responseData: error.response?.data
    });

    // Check if in embed mode
    const embedState = sessionStorage.getItem('mielo_embed_mode');
    const isEmbedMode = embedState ? JSON.parse(embedState).isEmbedMode : false;

    // Skip token refresh in embed mode
    if (isEmbedMode) {
      console.log('🌐 AXIOS DEBUG: Embed mode - skipping token refresh on error');
      return Promise.reject(error);
    }

    const originalRequest = error.config;
    const isAuthEndpoint = originalRequest.url?.includes('/auth/login') ||
                          originalRequest.url?.includes('/auth/refresh') ||
                          originalRequest.url?.includes('/auth/verify-mfa');

    // Don't try to refresh tokens for auth endpoints or if we don't have a refresh token
    if (error.response?.status === 401 &&
        !originalRequest._retry &&
        !isAuthEndpoint &&
        localStorage.getItem('mielo_refresh_token')) {

      console.log('🌐 AXIOS DEBUG: 401 detected on protected endpoint, attempting token refresh...');
      originalRequest._retry = true;

      try {
        const authService = new AuthService();
        await authService.refreshToken();

        // Retry the original request
        const token = localStorage.getItem('mielo_access_token');
        originalRequest.headers.Authorization = `Bearer ${token}`;
        console.log('🌐 AXIOS DEBUG: Retrying original request with new token');
        return axios(originalRequest);
      } catch (refreshError) {
        console.log('🌐 AXIOS DEBUG: Token refresh failed, redirecting to login', refreshError);
        // Refresh failed, redirect to login
        localStorage.removeItem('mielo_access_token');
        localStorage.removeItem('mielo_refresh_token');
        window.location.href = '#/login';
        return Promise.reject(refreshError);
      }
    } else if (error.response?.status === 401 && isAuthEndpoint) {
      console.log('🌐 AXIOS DEBUG: 401 on auth endpoint - this is expected for invalid credentials');
    }

    return Promise.reject(error);
  }
);

export const authService = new AuthService();
