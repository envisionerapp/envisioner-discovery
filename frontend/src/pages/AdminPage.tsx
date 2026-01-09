import React, { useState } from 'react';
import { Cog6ToothIcon, ServerStackIcon, UsersIcon, ClockIcon, CloudArrowDownIcon, HashtagIcon, EnvelopeIcon, ShieldCheckIcon } from '@heroicons/react/24/outline';

const tabs = [
  { id: 'users', name: 'Users', icon: UsersIcon },
  { id: 'scraping', name: 'Scraping', icon: CloudArrowDownIcon },
  { id: 'scheduler', name: 'Scheduler', icon: ClockIcon },
  { id: 'system', name: 'System', icon: ServerStackIcon },
  { id: 'settings', name: 'Settings', icon: Cog6ToothIcon },
];

const AdminPage: React.FC = () => {
  const [active, setActive] = useState<string>('users');

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">Admin Panel</h1>
        <p className="text-gray-600 dark:text-gray-400">System administration, scraping controls, and analytics.</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-4">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setActive(t.id)}
            className={`px-3 py-1.5 rounded-lg text-sm border transition-colors flex items-center gap-2 ${
              active === t.id
                ? 'bg-primary-600 text-white border-primary-600'
                : 'border-gray-300 text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800'
            }`}
          >
            <t.icon className="h-4 w-4" /> {t.name}
          </button>
        ))}
      </div>

      {/* Panels (placeholders) */}
      {active === 'users' && (
        <div className="grid grid-cols-1 gap-4">
          <div className="card p-4">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="font-semibold text-gray-100">Users</h3>
                <p className="text-xs text-gray-400">Manage users and roles (placeholder)</p>
              </div>
              <div className="flex items-center gap-2">
                <button className="btn-primary" disabled>Invite User</button>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="table table-fixed table-compact table-striped w-full">
                <thead>
                  <tr>
                    <th><span className="th"><HashtagIcon /></span></th>
                    <th><span className="th"><UsersIcon />Name</span></th>
                    <th><span className="th"><EnvelopeIcon />Email</span></th>
                    <th><span className="th"><ShieldCheckIcon />Role</span></th>
                    <th></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                  {['Alice','Bruno','Carla','Diego','Emilia'].map((n, i) => (
                    <tr key={i}>
                      <td className="text-gray-400 text-sm">{i+1}</td>
                      <td className="text-gray-100">{n} Rivera</td>
                      <td className="text-gray-300">{n.toLowerCase()}@miela.cc</td>
                      <td className="text-gray-300">{i%2===0 ? 'Admin' : 'Manager'}</td>
                      <td className="text-right"><button className="btn-outline text-xs" disabled>Manage</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {active === 'scraping' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="card p-4">
            <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-2">Twitch Scraper</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">Start/stop, status, last run. (placeholder)</p>
            <div className="mt-3 flex gap-2">
              <button className="btn-primary" disabled>Start</button>
              <button className="btn-outline dark:border-gray-700 dark:text-gray-300" disabled>Stop</button>
            </div>
          </div>
          <div className="card p-4">
            <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-2">YouTube Scraper</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">Controls and status. (placeholder)</p>
          </div>
          <div className="card p-4">
            <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-2">Kick Scraper</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">Controls and status. (placeholder)</p>
          </div>
        </div>
      )}

      {active === 'scheduler' && (
        <div className="card p-4">
          <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-2">Job Scheduler</h3>
          <p className="text-sm text-gray-600 dark:text-gray-400">Configure cron jobs for scraping, refresh, and cleanup. (placeholder)</p>
          <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-3">
            {["Scrape Twitch hourly","Refresh stats daily","Cleanup cache weekly"].map((j) => (
              <div key={j} className="rounded-lg border border-gray-200 dark:border-gray-800 p-3">
                <p className="text-sm text-gray-900 dark:text-gray-100">{j}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">cron: placeholder</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {active === 'system' && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {["API Uptime","Queue Depth","DB Status","Cache Hit Rate"].map((m) => (
            <div key={m} className="card p-4">
              <p className="text-sm text-gray-500 dark:text-gray-400">{m}</p>
              <p className="text-2xl font-semibold text-gray-900 dark:text-gray-100">--</p>
            </div>
          ))}
        </div>
      )}

      {active === 'settings' && (
        <div className="card p-4">
          <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-2">Settings</h3>
          <p className="text-sm text-gray-600 dark:text-gray-400">Environment variables, auth, and integrations. (placeholder)</p>
          <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
            <input className="form-input" placeholder="OpenAI API Key (placeholder)" disabled />
            <input className="form-input" placeholder="Admin Email (placeholder)" disabled />
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminPage;
