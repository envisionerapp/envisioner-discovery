// Centralize API base URL for production deployments (e.g., Render)
export const API_BASE = import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, '') || '';

// Only log API config in development
if (import.meta.env.MODE === 'development') {
  console.log('🔧 API CONFIG DEBUG: API base configuration', {
    VITE_API_BASE_URL_direct: import.meta.env.VITE_API_BASE_URL,
    API_BASE,
    mode: import.meta.env.MODE
  });
}

export const withBase = (path: string) => {
  const result = !API_BASE ? path : `${API_BASE}${path.startsWith('/') ? path : `/${path}`}`;
  if (import.meta.env.MODE === 'development') {
    console.log('🔧 API CONFIG DEBUG: withBase called', { path, API_BASE, result });
  }
  return result;
};

