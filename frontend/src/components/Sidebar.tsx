import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useDashboardStats } from '@/hooks/useDashboardStats';
import { useLanguage } from '@/contexts/LanguageContext';
import { useLiveCount } from '@/contexts/LiveCountContext';
import {
  ChatBubbleLeftEllipsisIcon,
  UsersIcon,
  MegaphoneIcon,
  CogIcon,
  HomeIcon,
  ChartBarIcon,
} from '@heroicons/react/24/outline';
import clsx from 'clsx';
import { SystemStatus } from './SystemStatus';

interface NavItem {
  nameKey: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  adminOnly?: boolean;
}

const navigation: NavItem[] = [
  {
    nameKey: 'nav.dashboard',
    href: '/dashboard',
    icon: HomeIcon,
  },
  {
    nameKey: 'nav.chat',
    href: '/chat',
    icon: ChatBubbleLeftEllipsisIcon,
  },
  {
    nameKey: 'nav.streamers',
    href: '/streamers',
    icon: UsersIcon,
  },
  {
    nameKey: 'nav.settings',
    href: '/admin',
    icon: CogIcon,
    adminOnly: true,
  },
];

interface SidebarProps { isMobile?: boolean; onNavigate?: (e: React.MouseEvent) => void }

export const Sidebar: React.FC<SidebarProps> = ({ isMobile = false, onNavigate }) => {
  const { user } = useAuth();
  const { stats, isLoading } = useDashboardStats();
  const { liveCount, isLoading: liveCountLoading } = useLiveCount();
  const { t } = useLanguage();

  // Admin emails
  const isAdmin = user?.email === 'abiola@miela.cc' || user?.email === 'admin@envisioner.io';

  const containerClasses = clsx(
    'w-64 sidebar-fixed-height',
    isMobile ? 'block' : 'hidden md:block'
  );

  return (
    <aside className={containerClasses}>
      <nav className="h-full flex flex-col py-3">
        {/* Navigation Links */}
        <div className="flex-1">
          <ul className="space-y-1">
            {navigation.map((item) => {
              if (item.adminOnly && !isAdmin) return null;

              return (
                <li key={item.nameKey}>
                  <NavLink
                    to={item.href}
                    onClick={(e) => {
                      e.stopPropagation();
                      onNavigate?.(e);
                    }}
                    className={({ isActive }) =>
                      clsx(
                        'group relative flex items-center gap-3 px-6 py-3 text-sm transition-all duration-200',
                        isActive
                          ? 'bg-primary-600 text-black font-black'
                          : 'text-gray-300 hover:bg-white/5 hover:text-gray-100 font-semibold'
                      )
                    }
                  >
                    {({ isActive }) => (
                      <>
                        <item.icon
                          className={clsx(
                            'h-5 w-5 flex-shrink-0 transition-transform group-hover:scale-110',
                            isActive ? 'text-black' : 'text-gray-400'
                          )}
                        />
                        <span className="flex-1">{t(item.nameKey)}</span>
                      </>
                    )}
                  </NavLink>
                </li>
              );
            })}
          </ul>
        </div>

        {/* Statistics Section */}
        <div className="pb-3 border-t border-white/5">
          <div className="pt-3 px-6">
            <div className="flex items-center gap-2 mb-3">
              <ChartBarIcon className="h-4 w-4 text-primary-500" />
              <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">{t('dashboard.overview')}</span>
            </div>

            {/* Stats */}
            <div className="space-y-3">
              {/* Total Streamers */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="h-7 w-7 rounded-md bg-primary-600/10 flex items-center justify-center">
                    <UsersIcon className="h-3.5 w-3.5 text-primary-500" />
                  </div>
                  <span className="text-xs text-gray-400">{t('dashboard.stats.totalStreamers')}</span>
                </div>
                <span className="text-sm font-black text-gray-100 tabular-nums">
                  {isLoading ? '...' : stats.totalStreamers.toLocaleString()}
                </span>
              </div>

              {/* Live Now */}
              <div className="flex items-center justify-between py-2 px-2 rounded-md" style={{ background: 'rgba(255, 107, 53, 0.1)' }}>
                <div className="flex items-center gap-2">
                  <div className="h-7 w-7 rounded-md bg-[#FF6B35]/20 flex items-center justify-center relative">
                    <div className="relative h-2 w-2 rounded-full bg-[#FF6B35] animate-pulse" style={{ animationDuration: '1.5s', boxShadow: '0 0 6px rgba(255, 107, 53, 0.8)' }} />
                  </div>
                  <span className="text-xs text-[#FF6B35] font-medium">{t('dashboard.stats.liveNow')}</span>
                </div>
                <span className="text-sm font-black text-[#FF6B35] tabular-nums">
                  {liveCountLoading ? '...' : liveCount.toLocaleString()}
                </span>
              </div>
            </div>
          </div>
        </div>
      </nav>
    </aside>
  );
};
