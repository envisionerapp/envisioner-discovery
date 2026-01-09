import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useEmbed } from '../contexts/EmbedContext';

interface User {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  mfaEnabled?: boolean;
}

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
  const { isEmbedMode, isValidReferrer, softrUser } = useEmbed();

  const isAuthenticated = !!user;

  // Initialize auth from Softr user info
  useEffect(() => {
    const initializeAuth = () => {
      // Softr-only mode: create user from Softr embed params
      if (softrUser.email || softrUser.userId) {
        // Extract name parts if available
        const nameParts = softrUser.name?.split(' ') || [];
        const firstName = nameParts[0] || softrUser.email?.split('@')[0] || 'User';
        const lastName = nameParts.slice(1).join(' ') || '';

        setUser({
          id: softrUser.userId || `softr-${softrUser.email || 'anonymous'}`,
          email: softrUser.email || 'user@envisioner.io',
          firstName,
          lastName: lastName || undefined,
          mfaEnabled: false,
        });

        if (import.meta.env.MODE === 'development') {
          console.log('🔐 AUTH: Softr user authenticated', { softrUser });
        }
      } else if (isEmbedMode && isValidReferrer) {
        // Fallback: valid embed without specific user info
        setUser({
          id: 'embed-user',
          email: 'embed@envisioner.io',
          firstName: 'Envisioner',
          lastName: 'User',
          mfaEnabled: false,
        });

        if (import.meta.env.MODE === 'development') {
          console.log('🔐 AUTH: Embed user (no Softr info)', { isEmbedMode, isValidReferrer });
        }
      } else {
        // No valid auth - for Softr-only, this shouldn't happen in production
        // But allow access with anonymous user for development/testing
        setUser({
          id: 'anonymous',
          email: 'guest@envisioner.io',
          firstName: 'Guest',
          mfaEnabled: false,
        });

        if (import.meta.env.MODE === 'development') {
          console.log('🔐 AUTH: Anonymous guest user');
        }
      }

      setLoading(false);
    };

    initializeAuth();
  }, [isEmbedMode, isValidReferrer, softrUser]);

  // Stub login - not used in Softr-only mode
  const login = async (_email: string, _password: string) => {
    console.warn('Login not supported in Softr-only mode');
    return {};
  };

  // Stub MFA verify - not used in Softr-only mode
  const verifyMfa = async (_token: string, _userId: string) => {
    console.warn('MFA not supported in Softr-only mode');
  };

  // Logout - just resets to anonymous (not really used)
  const logout = () => {
    setUser({
      id: 'anonymous',
      email: 'guest@envisioner.io',
      firstName: 'Guest',
      mfaEnabled: false,
    });
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
