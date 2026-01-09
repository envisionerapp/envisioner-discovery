import React, { useState } from 'react';
import { Outlet, NavLink, useLocation } from 'react-router-dom';
import { Navbar } from './Navbar';
import { Sidebar } from './Sidebar';
import { useEmbed } from '../contexts/EmbedContext';
import { useDashboardStats } from '@/hooks/useDashboardStats';
import { useLiveCount } from '@/contexts/LiveCountContext';
import { HomeIcon, UsersIcon, ChatBubbleLeftRightIcon } from '@heroicons/react/24/outline';
import clsx from 'clsx';

export const Layout: React.FC = () => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { isEmbedMode } = useEmbed();
  const location = useLocation();

  // Call hooks unconditionally at the top (required by React rules)
  const { stats, isLoading } = useDashboardStats();
  const { liveCount, isLoading: liveCountLoading } = useLiveCount();

  // Embed mode: render with horizontal top navigation
  if (isEmbedMode) {
    const navItems = [
      { path: '/dashboard', label: 'Overview', icon: HomeIcon },
      { path: '/streamers', label: 'Streamers', icon: UsersIcon },
      { path: '/chat', label: 'Chat', icon: ChatBubbleLeftRightIcon },
    ];

    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
        {/* Horizontal navigation for embed mode */}
        <nav
          className="sticky top-0 z-10 border-b"
          style={{
            background: 'rgba(8, 7, 8, 0.95)',
            borderColor: 'rgba(255,255,255,0.08)'
          }}
        >
          <div className="flex items-center justify-between px-4 py-2.5">
            {/* Navigation items on the left */}
            <div className="flex items-center gap-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = location.pathname === item.path;
                return (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    className={clsx(
                      'flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all duration-200',
                      isActive
                        ? 'bg-primary-600 text-black font-black'
                        : 'text-gray-300 hover:bg-white/5 hover:text-gray-100 font-semibold'
                    )}
                  >
                    <Icon className={clsx(
                      'h-4 w-4 flex-shrink-0',
                      isActive ? 'text-black' : 'text-gray-400'
                    )} />
                    <span className="hidden sm:inline">{item.label}</span>
                  </NavLink>
                );
              })}
            </div>

            {/* Stats on the right */}
            <div className="flex items-center gap-3 sm:gap-4">
              {/* Total Streamers */}
              <div className="flex items-center gap-1.5">
                <div className="h-6 w-6 rounded-md bg-primary-600/10 flex items-center justify-center">
                  <UsersIcon className="h-3 w-3 text-primary-500" />
                </div>
                <span className="text-xs font-black text-gray-100 tabular-nums">
                  {isLoading ? '...' : stats.totalStreamers.toLocaleString()}
                </span>
              </div>

              {/* Live Now */}
              <div
                className="flex items-center gap-1.5 py-1 px-2 rounded-md"
                style={{ background: 'rgba(255, 107, 53, 0.1)' }}
              >
                <div className="h-6 w-6 rounded-md bg-[#FF6B35]/20 flex items-center justify-center">
                  <div
                    className="h-2 w-2 rounded-full bg-[#FF6B35] animate-pulse"
                    style={{
                      animationDuration: '1.5s',
                      boxShadow: '0 0 6px rgba(255, 107, 53, 0.8)'
                    }}
                  />
                </div>
                <span className="text-xs font-black text-[#FF6B35] tabular-nums">
                  {liveCountLoading ? '...' : liveCount.toLocaleString()}
                </span>
              </div>
            </div>
          </div>
        </nav>

        <main className="w-full p-3 sm:p-4 max-w-full overflow-x-hidden">
          <Outlet />
        </main>
      </div>
    );
  }

  // Normal mode: render full layout with navbar and sidebar
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <Navbar onMenuClick={() => setMobileOpen(true)} />
      <div className="flex content-offset md:px-4">
        {/* Mobile overlay drawer */}
        {mobileOpen && (
          <div className="fixed inset-0 z-50 md:hidden">
            <div className="absolute inset-0 bg-black/60" onClick={() => setMobileOpen(false)} />
            {/* Use Sidebar's own card to avoid double backgrounds */}
            <div className="absolute left-0 top-14 bottom-0 w-[85vw] sm:w-72 overflow-y-auto">
              <Sidebar
                isMobile
                onNavigate={() => {
                  // Just close the mobile menu, let React Router handle navigation
                  setMobileOpen(false);
                }}
              />
            </div>
          </div>
        )}

        <Sidebar />
        <main className="flex-1 p-3 md:p-6 md:ml-64 md:pl-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
};
