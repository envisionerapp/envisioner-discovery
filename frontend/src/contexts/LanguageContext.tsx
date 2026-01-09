import React, { createContext, useContext, useState, useEffect } from 'react';

type Language = 'en' | 'es';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};

interface LanguageProviderProps {
  children: React.ReactNode;
}

export const LanguageProvider: React.FC<LanguageProviderProps> = ({ children }) => {
  const [language, setLanguageState] = useState<Language>(() => {
    const saved = localStorage.getItem('language');
    return (saved === 'en' || saved === 'es') ? saved : 'en';
  });

  useEffect(() => {
    localStorage.setItem('language', language);
  }, [language]);

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
  };

  const t = (key: string): string => {
    const keys = key.split('.');
    let value: any = translations[language];

    for (const k of keys) {
      if (value && typeof value === 'object') {
        value = value[k];
      } else {
        return key; // Return key if translation not found
      }
    }

    return typeof value === 'string' ? value : key;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

// Translations
const translations = {
  en: {
    // Navigation
    nav: {
      dashboard: 'Dashboard',
      streamers: 'Streamers',
      chat: 'AI Chat',
      campaigns: 'Campaigns',
      logout: 'Logout',
      login: 'Login',
      settings: 'Settings'
    },

    // Common
    common: {
      search: 'Search',
      filter: 'Filter',
      sort: 'Sort',
      loading: 'Loading...',
      error: 'Error',
      success: 'Success',
      cancel: 'Cancel',
      save: 'Save',
      delete: 'Delete',
      edit: 'Edit',
      view: 'View',
      close: 'Close',
      yes: 'Yes',
      no: 'No',
      back: 'Back',
      next: 'Next',
      previous: 'Previous',
      clear: 'Clear',
      apply: 'Apply',
      reset: 'Reset',
      export: 'Export',
      import: 'Import',
      download: 'Download',
      upload: 'Upload'
    },

    // Streamers Page
    streamers: {
      title: 'Streamers',
      subtitle: 'Discover and manage content creators',
      searchPlaceholder: 'Search by name, game, or tag...',
      noResults: 'No streamers found',
      noResultsDesc: 'Try adjusting your search criteria or explore different regions.',
      filters: {
        title: 'Filters',
        platform: 'Platform',
        region: 'Region',
        status: 'Status',
        allPlatforms: 'All Platforms',
        allRegions: 'All Regions',
        live: 'Live',
        offline: 'Offline',
        all: 'All'
      },
      sort: {
        title: 'Sort By',
        followers: 'Followers',
        viewers: 'Viewers',
        name: 'Name',
        recent: 'Recently Live'
      },
      stats: {
        followers: 'Followers',
        liveViewers: 'Live Viewers',
        peak: 'Peak Viewers',
        total: 'Total Streamers',
        live: 'Live Now'
      },
      card: {
        live: 'Live',
        offline: 'Offline',
        viewers: 'viewers',
        verified: 'Verified',
        review: 'Review',
        viewProfile: 'View Profile',
        addToCampaign: 'Add to Campaign',
        bio: 'Bio',
        socialLinks: 'Social Links',
        panelImages: 'Panel Images',
        moreImages: 'more images',
        tags: 'Tags',
        moreTags: 'more'
      }
    },

    // Chat Page
    chat: {
      title: 'AI Chat',
      subtitle: 'Find streamers with AI-powered search',
      placeholder: 'Ask me anything about streamers...',
      send: 'Send',
      newChat: 'New Chat',
      history: 'Chat History',
      suggestions: 'Suggestions',
      clearHistory: 'Clear History',
      deleteConversation: 'Delete Conversation',
      thinking: 'Thinking...',
      searching: 'Searching...',
      analyzing: 'Analyzing...',
      examples: {
        title: 'Try asking:',
        example1: 'Find live streamers in Mexico',
        example2: 'Show me top gambling streamers',
        example3: 'Find gaming streamers with high engagement'
      },
      results: {
        found: 'Found',
        streamers: 'streamers',
        matches: 'matches'
      },
      error: {
        title: 'Something went wrong',
        message: 'Please try again or rephrase your question',
        retry: 'Retry'
      }
    },

    // Dashboard
    dashboard: {
      title: 'Dashboard',
      subtitle: 'Overview of your streaming analytics',
      welcome: 'Welcome back',
      overview: 'Overview',
      analytics: 'Analytics',
      recent: 'Recent Activity',
      stats: {
        totalStreamers: 'Total Streamers',
        liveNow: 'Live Now',
        totalViewers: 'Total Viewers',
        activeCampaigns: 'Active Campaigns'
      },
      charts: {
        viewership: 'Viewership Trends',
        platforms: 'Platform Distribution',
        regions: 'Regional Distribution',
        categories: 'Top Categories'
      }
    },

    // Campaigns
    campaigns: {
      title: 'Campaigns',
      subtitle: 'Manage your marketing campaigns',
      create: 'Create Campaign',
      noCampaigns: 'No campaigns yet',
      noCampaignsDesc: 'Create your first campaign to get started',
      status: {
        active: 'Active',
        pending: 'Pending',
        completed: 'Completed',
        cancelled: 'Cancelled'
      },
      card: {
        budget: 'Budget',
        roi: 'ROI',
        streamers: 'Streamers',
        performance: 'Performance',
        startDate: 'Start Date',
        endDate: 'End Date'
      }
    },

    // Regions
    regions: {
      mexico: 'Mexico',
      colombia: 'Colombia',
      argentina: 'Argentina',
      chile: 'Chile',
      peru: 'Peru',
      venezuela: 'Venezuela',
      ecuador: 'Ecuador',
      bolivia: 'Bolivia',
      paraguay: 'Paraguay',
      uruguay: 'Uruguay',
      costa_rica: 'Costa Rica',
      panama: 'Panama',
      guatemala: 'Guatemala',
      el_salvador: 'El Salvador',
      honduras: 'Honduras',
      nicaragua: 'Nicaragua',
      dominican_republic: 'Dominican Republic',
      puerto_rico: 'Puerto Rico',
      brazil: 'Brazil'
    },

    // Platforms
    platforms: {
      twitch: 'Twitch',
      youtube: 'YouTube',
      kick: 'Kick',
      facebook: 'Facebook',
      tiktok: 'TikTok'
    },

    // Time
    time: {
      now: 'now',
      minuteAgo: 'a minute ago',
      minutesAgo: 'minutes ago',
      hourAgo: 'an hour ago',
      hoursAgo: 'hours ago',
      dayAgo: 'a day ago',
      daysAgo: 'days ago',
      weekAgo: 'a week ago',
      weeksAgo: 'weeks ago',
      monthAgo: 'a month ago',
      monthsAgo: 'months ago',
      yearAgo: 'a year ago',
      yearsAgo: 'years ago'
    }
  },

  es: {
    // Navegación
    nav: {
      dashboard: 'Panel',
      streamers: 'Streamers',
      chat: 'Chat IA',
      campaigns: 'Campañas',
      logout: 'Cerrar Sesión',
      login: 'Iniciar Sesión',
      settings: 'Configuración'
    },

    // Común
    common: {
      search: 'Buscar',
      filter: 'Filtrar',
      sort: 'Ordenar',
      loading: 'Cargando...',
      error: 'Error',
      success: 'Éxito',
      cancel: 'Cancelar',
      save: 'Guardar',
      delete: 'Eliminar',
      edit: 'Editar',
      view: 'Ver',
      close: 'Cerrar',
      yes: 'Sí',
      no: 'No',
      back: 'Atrás',
      next: 'Siguiente',
      previous: 'Anterior',
      clear: 'Limpiar',
      apply: 'Aplicar',
      reset: 'Restablecer',
      export: 'Exportar',
      import: 'Importar',
      download: 'Descargar',
      upload: 'Subir'
    },

    // Página de Streamers
    streamers: {
      title: 'Streamers',
      subtitle: 'Descubre y gestiona creadores de contenido',
      searchPlaceholder: 'Buscar por nombre, juego o etiqueta...',
      noResults: 'No se encontraron streamers',
      noResultsDesc: 'Intenta ajustar tus criterios de búsqueda o explorar diferentes regiones.',
      filters: {
        title: 'Filtros',
        platform: 'Plataforma',
        region: 'Región',
        status: 'Estado',
        allPlatforms: 'Todas las Plataformas',
        allRegions: 'Todas las Regiones',
        live: 'En Vivo',
        offline: 'Desconectado',
        all: 'Todos'
      },
      sort: {
        title: 'Ordenar Por',
        followers: 'Seguidores',
        viewers: 'Espectadores',
        name: 'Nombre',
        recent: 'Reciente en Vivo'
      },
      stats: {
        followers: 'Seguidores',
        liveViewers: 'Espectadores en Vivo',
        peak: 'Pico de Espectadores',
        total: 'Total de Streamers',
        live: 'En Vivo Ahora'
      },
      card: {
        live: 'En Vivo',
        offline: 'Desconectado',
        viewers: 'espectadores',
        verified: 'Verificado',
        review: 'Revisar',
        viewProfile: 'Ver Perfil',
        addToCampaign: 'Agregar a Campaña',
        bio: 'Biografía',
        socialLinks: 'Redes Sociales',
        panelImages: 'Imágenes de Panel',
        moreImages: 'más imágenes',
        tags: 'Etiquetas',
        moreTags: 'más'
      }
    },

    // Página de Chat
    chat: {
      title: 'Chat IA',
      subtitle: 'Encuentra streamers con búsqueda potenciada por IA',
      placeholder: 'Pregúntame cualquier cosa sobre streamers...',
      send: 'Enviar',
      newChat: 'Nuevo Chat',
      history: 'Historial de Chat',
      suggestions: 'Sugerencias',
      clearHistory: 'Limpiar Historial',
      deleteConversation: 'Eliminar Conversación',
      thinking: 'Pensando...',
      searching: 'Buscando...',
      analyzing: 'Analizando...',
      examples: {
        title: 'Intenta preguntar:',
        example1: 'Encuentra streamers en vivo en México',
        example2: 'Muéstrame los mejores streamers de apuestas',
        example3: 'Encuentra streamers de videojuegos con alto engagement'
      },
      results: {
        found: 'Encontrados',
        streamers: 'streamers',
        matches: 'coincidencias'
      },
      error: {
        title: 'Algo salió mal',
        message: 'Por favor intenta de nuevo o reformula tu pregunta',
        retry: 'Reintentar'
      }
    },

    // Panel de Control
    dashboard: {
      title: 'Panel de Control',
      subtitle: 'Resumen de tus análisis de streaming',
      welcome: 'Bienvenido de nuevo',
      overview: 'Resumen',
      analytics: 'Análisis',
      recent: 'Actividad Reciente',
      stats: {
        totalStreamers: 'Total de Streamers',
        liveNow: 'En Vivo Ahora',
        totalViewers: 'Total de Espectadores',
        activeCampaigns: 'Campañas Activas'
      },
      charts: {
        viewership: 'Tendencias de Audiencia',
        platforms: 'Distribución de Plataformas',
        regions: 'Distribución Regional',
        categories: 'Categorías Principales'
      }
    },

    // Campañas
    campaigns: {
      title: 'Campañas',
      subtitle: 'Gestiona tus campañas de marketing',
      create: 'Crear Campaña',
      noCampaigns: 'Aún no hay campañas',
      noCampaignsDesc: 'Crea tu primera campaña para comenzar',
      status: {
        active: 'Activa',
        pending: 'Pendiente',
        completed: 'Completada',
        cancelled: 'Cancelada'
      },
      card: {
        budget: 'Presupuesto',
        roi: 'ROI',
        streamers: 'Streamers',
        performance: 'Rendimiento',
        startDate: 'Fecha de Inicio',
        endDate: 'Fecha de Fin'
      }
    },

    // Regiones
    regions: {
      mexico: 'México',
      colombia: 'Colombia',
      argentina: 'Argentina',
      chile: 'Chile',
      peru: 'Perú',
      venezuela: 'Venezuela',
      ecuador: 'Ecuador',
      bolivia: 'Bolivia',
      paraguay: 'Paraguay',
      uruguay: 'Uruguay',
      costa_rica: 'Costa Rica',
      panama: 'Panamá',
      guatemala: 'Guatemala',
      el_salvador: 'El Salvador',
      honduras: 'Honduras',
      nicaragua: 'Nicaragua',
      dominican_republic: 'República Dominicana',
      puerto_rico: 'Puerto Rico',
      brazil: 'Brasil'
    },

    // Plataformas
    platforms: {
      twitch: 'Twitch',
      youtube: 'YouTube',
      kick: 'Kick',
      facebook: 'Facebook',
      tiktok: 'TikTok'
    },

    // Tiempo
    time: {
      now: 'ahora',
      minuteAgo: 'hace un minuto',
      minutesAgo: 'hace minutos',
      hourAgo: 'hace una hora',
      hoursAgo: 'hace horas',
      dayAgo: 'hace un día',
      daysAgo: 'hace días',
      weekAgo: 'hace una semana',
      weeksAgo: 'hace semanas',
      monthAgo: 'hace un mes',
      monthsAgo: 'hace meses',
      yearAgo: 'hace un año',
      yearsAgo: 'hace años'
    }
  }
};
