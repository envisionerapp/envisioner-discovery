import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useLocation } from 'react-router-dom';

interface EmbedContextType {
  isEmbedMode: boolean;
  embedSource: 'iframe' | 'param' | null;
  isValidReferrer: boolean;
}

const EmbedContext = createContext<EmbedContextType | undefined>(undefined);

interface EmbedProviderProps {
  children: ReactNode;
}

// Function to detect embed mode synchronously
export const detectEmbedMode = () => {
  // Check URL parameter FIRST (from hash since we use HashRouter)
  // URL format: http://localhost:3000/#/dashboard?embed=true
  const hash = window.location.hash; // Gets "#/dashboard?embed=true"
  const queryString = hash.includes('?') ? hash.split('?')[1] : '';
  const urlParams = new URLSearchParams(queryString);
  const embedParam = urlParams.get('embed') === 'true';

  // Debug logging
  console.log('🔌 EMBED DETECTION:', {
    hash,
    queryString,
    embedParam,
    fullUrl: window.location.href
  });

  // Check if in iframe
  const inIframe = window.self !== window.top;

  // Determine embed mode
  const embedDetected = embedParam || inIframe;
  const source = embedParam ? 'param' : inIframe ? 'iframe' : null;

  if (embedDetected) {
    // Validate referrer
    const referrer = document.referrer;
    const allowedDomains = (import.meta as any)?.env?.VITE_ALLOWED_EMBED_DOMAINS || 'softr.app,softr.io,softr.website,talents.miela.cc';
    const domains = allowedDomains.split(',').map((d: string) => d.trim().toLowerCase());

    const isValid = domains.some((domain: string) =>
      referrer.toLowerCase().includes(domain)
    ) || !referrer; // Allow empty referrer for testing

    const result = {
      isEmbedMode: true,
      embedSource: source,
      isValidReferrer: isValid,
    };

    // Store in sessionStorage
    sessionStorage.setItem('mielo_embed_mode', JSON.stringify(result));

    // Always log embed mode for debugging (including production)
    console.log('🔌 EMBED MODE:', {
      isEmbedMode: true,
      source,
      referrer,
      isValidReferrer: isValid,
      allowedDomains: domains,
      env: import.meta.env.MODE,
    });

    return result;
  }

  // Not in embed mode - clear sessionStorage to avoid stale data
  sessionStorage.removeItem('mielo_embed_mode');

  return {
    isEmbedMode: false,
    embedSource: null,
    isValidReferrer: false,
  };
};

// Initialize embed mode synchronously
const initialEmbedState = detectEmbedMode();

// Singleton para acceder al estado embed desde fuera de React
let embedModeState = {
  isEmbedMode: initialEmbedState.isEmbedMode,
  isValidReferrer: initialEmbedState.isValidReferrer,
};

export const getEmbedMode = () => embedModeState;

export const EmbedProvider: React.FC<EmbedProviderProps> = ({ children }) => {
  const location = useLocation();

  // Initialize state synchronously with detected values
  const [isEmbedMode, setIsEmbedMode] = useState(initialEmbedState.isEmbedMode);
  const [embedSource, setEmbedSource] = useState<'iframe' | 'param' | null>(initialEmbedState.embedSource);
  const [isValidReferrer, setIsValidReferrer] = useState(initialEmbedState.isValidReferrer);

  // Re-detect embed mode whenever the location changes (via React Router)
  useEffect(() => {
    const newState = detectEmbedMode();
    setIsEmbedMode(newState.isEmbedMode);
    setEmbedSource(newState.embedSource);
    setIsValidReferrer(newState.isValidReferrer);

    embedModeState = {
      isEmbedMode: newState.isEmbedMode,
      isValidReferrer: newState.isValidReferrer,
    };
  }, [location]);

  const value: EmbedContextType = {
    isEmbedMode,
    embedSource,
    isValidReferrer,
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
