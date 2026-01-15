import React from 'react';
import { Outlet, NavLink, useLocation } from 'react-router-dom';
import { useDashboardStats } from '@/hooks/useDashboardStats';
import { useLiveCount } from '@/contexts/LiveCountContext';
import { HomeIcon, UsersIcon } from '@heroicons/react/24/outline';
import clsx from 'clsx';

export const Layout: React.FC = () => {
  const location = useLocation();
  const { stats, isLoading } = useDashboardStats();
  const { liveCount, isLoading: liveCountLoading } = useLiveCount();

  const navItems = [
    { path: '/dashboard', label: 'Overview', icon: HomeIcon },
    { path: '/streamers', label: 'Streamers', icon: UsersIcon },
  ];

  return (
    <div className="h-full flex flex-col bg-white overflow-hidden">
      {/* Tab navigation */}
      <nav className="flex-shrink-0 z-10 border-b border-secondary/10 bg-white">
        <div className="flex items-center justify-between py-2.5">
          {/* Tab items */}
          <div className="flex items-center gap-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;
              return (
                <NavLink
                  key={item.path}
                  to={item.path}
                  className={clsx(
                    'flex items-center gap-2 px-4 py-2 rounded-lg text-sm transition-all duration-200',
                    isActive
                      ? 'bg-accent text-white font-bold'
                      : 'text-secondary/70 hover:bg-secondary/5 hover:text-secondary font-medium'
                  )}
                >
                  <Icon className={clsx(
                    'h-4 w-4 flex-shrink-0',
                    isActive ? 'text-white' : 'text-secondary/50'
                  )} />
                  <span>{item.label}</span>
                </NavLink>
              );
            })}
          </div>

          {/* Stats on the right */}
          <div className="flex items-center gap-3 sm:gap-4 pr-4">
            {/* Total Streamers */}
            <div className="flex items-center gap-1.5">
              <div className="h-6 w-6 rounded-md bg-secondary/5 flex items-center justify-center">
                <UsersIcon className="h-3 w-3 text-secondary/60" />
              </div>
              <span className="text-xs font-bold text-secondary tabular-nums">
                {isLoading ? '...' : stats.totalStreamers.toLocaleString()}
              </span>
            </div>

            {/* Live Now */}
            <div
              className="flex items-center gap-1.5 py-1 px-2 rounded-md"
              style={{ background: 'rgba(255, 107, 53, 0.1)' }}
            >
              <div className="h-6 w-6 rounded-md bg-accent/20 flex items-center justify-center">
                <div
                  className="h-2 w-2 rounded-full bg-accent animate-pulse"
                  style={{
                    animationDuration: '1.5s',
                    boxShadow: '0 0 6px rgba(255, 107, 53, 0.8)'
                  }}
                />
              </div>
              <span className="text-xs font-bold text-accent tabular-nums">
                {liveCountLoading ? '...' : liveCount.toLocaleString()}
              </span>
            </div>
          </div>
        </div>
      </nav>

      <main className="flex-1 w-full p-4 max-w-full overflow-hidden">
        <Outlet />
      </main>
    </div>
  );
};
