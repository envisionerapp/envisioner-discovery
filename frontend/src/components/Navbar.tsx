import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useLanguage } from '@/contexts/LanguageContext';
import {
  BellIcon,
  Cog6ToothIcon,
  ArrowRightOnRectangleIcon,
  Bars3Icon,
  LanguageIcon,
} from '@heroicons/react/24/outline';
import { Menu, Transition } from '@headlessui/react';
import { Fragment } from 'react';
import { getUserAvatar } from '@/utils/avatars';

interface NavbarProps {
  onMenuClick?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ onMenuClick }) => {
  const { user, logout } = useAuth();
  const { language, setLanguage, t } = useLanguage();
  const [avatarError, setAvatarError] = React.useState(false);

  const getLocalAvatar = (email: string) => {
    const initials = email.split('@')[0].substring(0, 2).toUpperCase();
    return `data:image/svg+xml;utf8,${encodeURIComponent(
      `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><rect width='100' height='100' fill='#FF6B35'/><text x='50' y='50' text-anchor='middle' dy='0.35em' font-family='system-ui' font-size='40' font-weight='600' fill='#fff'>${initials}</text></svg>`
    )}`;
  };

  return (
    <nav className="glass-nav fixed top-0 left-0 right-0 z-40 safe-top" style={{ WebkitTransform: 'translateZ(0)' }}>
      <div className="min-h-[56px] flex items-center px-3 sm:px-4 md:px-6">
        <div className="flex justify-between items-center w-full">
          {/* Logo */}
          <div className="flex items-center space-x-2 sm:space-x-4 min-w-0">
            {/* Mobile menu button */}
            <button
              className="md:hidden p-2 rounded-lg hover:bg-white/10"
              onClick={onMenuClick}
              aria-label="Open menu"
            >
              <Bars3Icon className="h-6 w-6 text-gray-700 dark:text-gray-200" />
            </button>
            <Link to="/dashboard" className="flex items-center space-x-2 min-w-0">
              <div className="w-8 h-8 bg-primary-500 rounded-lg flex items-center justify-center text-white text-lg font-bold">
                E
              </div>
              <h1 className="text-base sm:text-xl font-bold text-gray-900 dark:text-gray-100">Envisioner</h1>
            </Link>
          </div>

          {/* User menu */}
          <div className="flex items-center space-x-2 sm:space-x-4">
            {/* Language Toggle */}
            <button
              onClick={() => setLanguage(language === 'en' ? 'es' : 'en')}
              className="flex items-center space-x-1 p-2 rounded-lg hover:bg-white/10 transition-colors group"
              title={language === 'en' ? 'Cambiar a Español' : 'Switch to English'}
            >
              <LanguageIcon className="h-5 w-5 text-primary-500 group-hover:text-primary-400" />
              <span className="text-sm font-medium text-gray-300 group-hover:text-gray-100">
                {language === 'en' ? 'ES' : 'EN'}
              </span>
            </button>

            {/* Notifications */}
            <button className="hidden sm:block p-2 transition-colors">
              <BellIcon className="h-6 w-6 text-primary-500" />
            </button>

            {/* User dropdown */}
            <Menu as="div" className="relative">
              <Menu.Button className="flex items-center space-x-2 p-2 rounded-lg hover:bg-white/10 transition-colors">
                <img
                  src={avatarError ? getLocalAvatar(user?.email || 'default-user') : getUserAvatar(user?.email || 'default-user')}
                  alt="User avatar"
                  className="h-8 w-8 rounded-full ring-2 ring-primary-500/50"
                  onError={() => setAvatarError(true)}
                />
                <div className="hidden sm:block text-left truncate max-w-[40vw]">
                  <p className="text-sm font-medium text-gray-100 truncate">
                    {user?.firstName && user?.lastName
                      ? `${user.firstName} ${user.lastName}`
                      : user?.email?.split('@')[0]
                  }
                  </p>
                  <p className="text-xs text-primary-700 font-semibold truncate">{user?.email}</p>
                </div>
              </Menu.Button>

              <Transition
                as={Fragment}
                enter="transition ease-out duration-200"
                enterFrom="transform opacity-0 scale-95"
                enterTo="transform opacity-100 scale-100"
                leave="transition ease-in duration-75"
                leaveFrom="transform opacity-100 scale-100"
                leaveTo="transform opacity-0 scale-95"
              >
                <Menu.Items className="absolute right-0 mt-2 w-48 rounded-lg shadow-lg focus:outline-none z-50 bg-primary-600 text-black border border-primary-700">
                  <div className="py-1 space-y-1">
                    <Menu.Item>
                      {({ active }) => (
                        <button
                          className={`${active ? 'bg-primary-700' : 'bg-primary-500'} flex items-center w-full px-4 py-2 text-sm text-black rounded-md hover:bg-primary-600 transition-colors`}
                        >
                          <Cog6ToothIcon className="h-4 w-4 mr-3 text-black" />
                          {t('nav.settings')}
                        </button>
                      )}
                    </Menu.Item>
                    <hr className="my-1 border-primary-700" />
                    <Menu.Item>
                      {({ active }) => (
                        <button
                          onClick={logout}
                          className={`${active ? 'bg-primary-700' : 'bg-primary-500'} flex items-center w-full px-4 py-2 text-sm text-black rounded-md hover:bg-primary-600 transition-colors`}
                        >
                          <ArrowRightOnRectangleIcon className="h-4 w-4 mr-3 text-black" />
                          {t('nav.logout')}
                        </button>
                      )}
                    </Menu.Item>
                  </div>
                </Menu.Items>
              </Transition>
            </Menu>
          </div>
        </div>
      </div>
    </nav>
  );
};
