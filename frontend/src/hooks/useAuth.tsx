import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import toast from 'react-hot-toast';
import { authService } from '@/services/authService';
import { User, AuthTokens } from '../types';
import { useEmbed } from '../contexts/EmbedContext';

interface AuthContextType {
  user: User | null;
  login: (email: string, password: string) => Promise<{ requiresMfa?: boolean; userId?: string }>;
  logout: () => void;
  verifyMfa: (token: string, userId: string) => Promise<void>;
  loading: boolean;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const { isEmbedMode, isValidReferrer } = useEmbed();
  const bypassAuth = (import.meta as any)?.env?.VITE_BYPASS_AUTH === 'true' ||
                     (isEmbedMode && isValidReferrer);

  // Auto-logout after 30 minutes of inactivity
  const INACTIVITY_TIMEOUT = 30 * 60 * 1000; // 30 minutes in milliseconds

  // Only log auth debug in development
  if (import.meta.env.MODE === 'development') {
    console.log('🔐 AUTH DEBUG: AuthProvider initialized', {
      bypassAuth,
      mode: import.meta.env.MODE,
      viteBypass: (import.meta as any)?.env?.VITE_BYPASS_AUTH,
      initialUser: user,
      initialLoading: loading
    });
  }

  const isAuthenticated = !!user;

  // Load user from localStorage on app start
  useEffect(() => {
    const initializeAuth = async () => {
      if (import.meta.env.MODE === 'development') {
        console.log('🔐 AUTH DEBUG: Initializing auth...');
      }

      // Dev bypass or embed mode: treat user as authenticated without hitting backend
      if (bypassAuth) {
        if (import.meta.env.MODE === 'development') {
          console.log('🔐 AUTH DEBUG: Using auth bypass mode', { isEmbedMode, isValidReferrer });
        }

        // Use embed user if in embed mode, otherwise dev user
        if (isEmbedMode && isValidReferrer) {
          setUser({
            id: 'embed-user',
            email: 'embed@mielo.cc',
            firstName: 'Embed',
            lastName: 'User',
            mfaEnabled: false
          });
        } else {
          setUser({ id: 'dev-user', email: 'dev@miela.cc', mfaEnabled: false });
        }
        setLoading(false);
        return;
      }

      try {
        const token = localStorage.getItem('mielo_access_token');
        const refreshToken = localStorage.getItem('mielo_refresh_token');

        if (import.meta.env.MODE === 'development') {
          console.log('🔐 AUTH DEBUG: Checking stored tokens', {
            hasAccessToken: !!token,
            hasRefreshToken: !!refreshToken,
            accessTokenLength: token?.length,
            refreshTokenLength: refreshToken?.length
          });
        }

        if (token) {
          console.log('🔐 AUTH DEBUG: Found access token, verifying with backend...');

          // Add timeout for token verification
          const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Token verification timeout')), 10000)
          );

          try {
            const userData = await Promise.race([
              authService.getCurrentUser(),
              timeoutPromise
            ]);
            console.log('🔐 AUTH DEBUG: Successfully got user data', userData);
            setUser(userData as any);
          } catch (verifyError) {
            console.log('🔐 AUTH DEBUG: Token verification failed, clearing tokens', verifyError);
            // If token verification fails, clear tokens and continue as unauthenticated
            localStorage.removeItem('mielo_access_token');
            localStorage.removeItem('mielo_refresh_token');
            setUser(null);
          }
        } else {
          console.log('🔐 AUTH DEBUG: No access token found');
          setUser(null);
        }
      } catch (error) {
        if (import.meta.env.MODE === 'development') {
          console.log('🔐 AUTH DEBUG: Error during auth initialization', error);
        }
        // Token is invalid, remove it
        localStorage.removeItem('mielo_access_token');
        localStorage.removeItem('mielo_refresh_token');
        setUser(null);
      } finally {
        if (import.meta.env.MODE === 'development') {
          console.log('🔐 AUTH DEBUG: Auth initialization complete, setting loading to false');
        }
        setLoading(false);
      }
    };

    initializeAuth();
  }, [bypassAuth, isEmbedMode, isValidReferrer]);

  // Auto-logout on inactivity
  useEffect(() => {
    if (!user || bypassAuth || isEmbedMode) return;

    let inactivityTimer: NodeJS.Timeout;

    const handleLogout = () => {
      logout();
      toast.error('Logged out due to inactivity');
    };

    const resetTimer = () => {
      clearTimeout(inactivityTimer);
      inactivityTimer = setTimeout(handleLogout, INACTIVITY_TIMEOUT);
    };

    // Track user activity
    const events = ['mousedown', 'keydown', 'scroll', 'touchstart', 'click'];
    events.forEach(event => {
      document.addEventListener(event, resetTimer);
    });

    // Start initial timer
    resetTimer();

    return () => {
      clearTimeout(inactivityTimer);
      events.forEach(event => {
        document.removeEventListener(event, resetTimer);
      });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, bypassAuth, isEmbedMode, INACTIVITY_TIMEOUT]);

  const login = async (email: string, password: string) => {
    console.log('🔐 AUTH DEBUG: Login attempt started', { email, bypassAuth });

    if (bypassAuth) {
      console.log('🔐 AUTH DEBUG: Using bypass auth for login');
      setUser({ id: 'dev-user', email: email || 'dev@miela.cc', mfaEnabled: false });
      return {};
    }

    try {
      console.log('🔐 AUTH DEBUG: Calling authService.login...');
      const response = await authService.login(email, password);
      console.log('🔐 AUTH DEBUG: Login response received', response);

      if (response.requiresMfa) {
        console.log('🔐 AUTH DEBUG: MFA required, returning MFA flow');
        return {
          requiresMfa: true,
          userId: response.userId,
        };
      }

      // Store tokens
      if (response.tokens) {
        console.log('🔐 AUTH DEBUG: Storing tokens', {
          hasAccessToken: !!response.tokens.accessToken,
          hasRefreshToken: !!response.tokens.refreshToken,
          accessTokenLength: response.tokens.accessToken?.length,
          refreshTokenLength: response.tokens.refreshToken?.length
        });

        localStorage.setItem('mielo_access_token', response.tokens.accessToken);
        localStorage.setItem('mielo_refresh_token', response.tokens.refreshToken);

        // Optimistically set user from login response to avoid redirect race
        if ((response as any).user) {
          console.log('🔐 AUTH DEBUG: Setting user from login response', (response as any).user);
          setUser((response as any).user);
        }

        // Refresh user details in background
        try {
          console.log('🔐 AUTH DEBUG: Fetching fresh user data...');
          const userData = await authService.getCurrentUser();
          console.log('🔐 AUTH DEBUG: Fresh user data received', userData);
          setUser(userData);
        } catch (e) {
          console.log('🔐 AUTH DEBUG: Failed to get fresh user data, keeping login response user', e);
          // If this fails, we still have an authenticated session from tokens
        }
      } else {
        console.log('🔐 AUTH DEBUG: No tokens in response!', response);
      }

      toast.success('Welcome to Mielo!');
      console.log('🔐 AUTH DEBUG: Login completed successfully');
      return {};
    } catch (error: any) {
      console.log('🔐 AUTH DEBUG: Login failed', error);
      toast.error(error.message || 'Login failed');
      throw error;
    }
  };

  const verifyMfa = async (token: string, userId: string) => {
    if (bypassAuth) {
      return;
    }
    try {
      const response = await authService.verifyMfa(token, userId);

      // Store tokens
      localStorage.setItem('mielo_access_token', response.accessToken);
      localStorage.setItem('mielo_refresh_token', response.refreshToken);

      // Get user data
      const userData = await authService.getCurrentUser();
      setUser(userData);

      toast.success('Authentication successful!');
    } catch (error: any) {
      toast.error(error.message || 'MFA verification failed');
      throw error;
    }
  };

  const logout = async () => {
    try {
      await authService.logout();
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      // Clear local state
      setUser(null);
      localStorage.removeItem('mielo_access_token');
      localStorage.removeItem('mielo_refresh_token');
      toast.success('Logged out successfully');
    }
  };

  const value: AuthContextType = {
    user,
    login,
    logout,
    verifyMfa,
    loading,
    isAuthenticated,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
