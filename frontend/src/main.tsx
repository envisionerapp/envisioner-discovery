import React from 'react';
import ReactDOM from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from 'react-query';
import { Toaster } from 'react-hot-toast';
import App from './App';
import './index.css';
import { AuthProvider } from './hooks/useAuth';
import { LanguageProvider } from './contexts/LanguageContext';
import { LiveCountProvider } from './contexts/LiveCountContext';
import { EmbedProvider } from './contexts/EmbedContext';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 10 * 60 * 1000, // 10 minutes - data stays fresh longer
      cacheTime: 15 * 60 * 1000, // 15 minutes - keep in cache
      keepPreviousData: true, // Smooth transitions when refetching
    },
  },
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <HashRouter>
      <EmbedProvider>
        <QueryClientProvider client={queryClient}>
          <LanguageProvider>
            <AuthProvider>
              <LiveCountProvider>
                <App />
              <Toaster
                position="top-right"
                toastOptions={{
                  duration: 4000,
                  style: {
                    background: '#1f2937',
                    color: '#f9fafb',
                    fontSize: '14px',
                  },
                }}
              />
              </LiveCountProvider>
            </AuthProvider>
          </LanguageProvider>
        </QueryClientProvider>
      </EmbedProvider>
    </HashRouter>
  </React.StrictMode>,
);
