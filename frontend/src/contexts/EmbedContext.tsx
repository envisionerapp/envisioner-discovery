import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useLocation } from 'react-router-dom';

interface SoftrUser {
  email: string | null;
  userId: string | null;
  name: string | null;
}

interface EmbedContextType {
  isEmbedMode: boolean;
  embedSource: 'iframe' | 'param' | 'softr' | null;
  isValidReferrer: boolean;
  softrUser: SoftrUser;
}

const EmbedContext = createContext<EmbedContextType | undefined>(undefined);

interface EmbedProviderProps {
  children: ReactNode;
}

// Function to detect embed mode and Softr user info synchronously
export const detectEmbedMode = () => {
  // Check URL parameter from hash since we use HashRouter
  // URL format: http://localhost:3000/#/dashboard?embed=true&softrEmail=user@example.com&softrUserId=123
  const hash = window.location.hash;
  const queryString = hash.includes('?') ? hash.split('?')[1] : '';
  const urlParams = new URLSearchParams(queryString);

  // Get Softr user info from URL params
  const softrEmail = urlParams.get('softrEmail') || urlParams.get('email');
  const softrUserId = urlParams.get('softrUserId') || urlParams.get('userId');
  const softrName = urlParams.get('softrName') || urlParams.get('name');
  const embedParam = urlParams.get('embed') === 'true';

  // Check if in iframe
  const inIframe = window.self !== window.top;

  // Determine embed mode - Softr info means valid embed
  const hasSoftrInfo = !!(softrEmail || softrUserId);
  const embedDetected = embedParam || inIframe || hasSoftrInfo;

  let source: 'iframe' | 'param' | 'softr' | null = null;
  if (hasSoftrInfo) source = 'softr';
  else if (embedParam) source = 'param';
  else if (inIframe) source = 'iframe';

  // Validate referrer for security
  const referrer = document.referrer;
  const allowedDomains = (import.meta as any)?.env?.VITE_ALLOWED_EMBED_DOMAINS || 'softr.app,softr.io,softr.website,envisioner.io,localhost,vercel.app';
  const domains = allowedDomains.split(',').map((d: string) => d.trim().toLowerCase());

  // Valid if Softr info provided, or referrer matches allowed domains, or no referrer (for testing)
  const isValid = hasSoftrInfo || domains.some((domain: string) =>
    referrer.toLowerCase().includes(domain)
  ) || !referrer;

  const softrUser: SoftrUser = {
    email: softrEmail,
    userId: softrUserId,
    name: softrName,
  };

  const result = {
    isEmbedMode: embedDetected || true, // Always embed mode for Softr-only
    embedSource: source,
    isValidReferrer: isValid,
    softrUser,
  };

  // Store in sessionStorage
  sessionStorage.setItem('envisioner_embed_mode', JSON.stringify(result));

  // Debug logging
  if (import.meta.env.MODE === 'development') {
    console.log('🔌 EMBED MODE (Softr):', {
      isEmbedMode: result.isEmbedMode,
      source,
      referrer,
      isValidReferrer: isValid,
      softrUser,
      allowedDomains: domains,
    });
  }

  return result;
};

// Initialize embed mode synchronously
const initialEmbedState = detectEmbedMode();

// Singleton for accessing embed state outside React
let embedModeState = {
  isEmbedMode: initialEmbedState.isEmbedMode,
  isValidReferrer: initialEmbedState.isValidReferrer,
  softrUser: initialEmbedState.softrUser,
};

export const getEmbedMode = () => embedModeState;

export const EmbedProvider: React.FC<EmbedProviderProps> = ({ children }) => {
  const location = useLocation();

  // Initialize state synchronously with detected values
  const [isEmbedMode, setIsEmbedMode] = useState(initialEmbedState.isEmbedMode);
  const [embedSource, setEmbedSource] = useState<'iframe' | 'param' | 'softr' | null>(initialEmbedState.embedSource);
  const [isValidReferrer, setIsValidReferrer] = useState(initialEmbedState.isValidReferrer);
  const [softrUser, setSoftrUser] = useState<SoftrUser>(initialEmbedState.softrUser);

  // Re-detect embed mode whenever the location changes
  useEffect(() => {
    const newState = detectEmbedMode();
    setIsEmbedMode(newState.isEmbedMode);
    setEmbedSource(newState.embedSource);
    setIsValidReferrer(newState.isValidReferrer);
    setSoftrUser(newState.softrUser);

    embedModeState = {
      isEmbedMode: newState.isEmbedMode,
      isValidReferrer: newState.isValidReferrer,
      softrUser: newState.softrUser,
    };
  }, [location]);

  const value: EmbedContextType = {
    isEmbedMode,
    embedSource,
    isValidReferrer,
    softrUser,
  };

  return (
    <EmbedContext.Provider value={value}>
      {children}
    </EmbedContext.Provider>
  );
};

export const useEmbed = (): EmbedContextType => {
  const context = useContext(EmbedContext);
  if (context === undefined) {
    throw new Error('useEmbed must be used within an EmbedProvider');
  }
  return context;
};
