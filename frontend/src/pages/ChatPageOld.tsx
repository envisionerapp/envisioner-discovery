import React, { useMemo, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { PaperAirplaneIcon, PlusIcon, ArrowPathIcon, TrashIcon } from '@heroicons/react/24/outline';
import { AVATARS } from '@/utils/avatars';
import { PlatformIcon } from '@/components/icons/PlatformIcon';
import { flagFor, regionLabel } from '@/utils/geo';

const ChatPage: React.FC = () => {
  const { user } = useAuth();

  const [showHistoryMobile, setShowHistoryMobile] = useState(false);
  type Msg = { id: string; role: 'ai'|'user'; text: string; time: string };
  const seedMsgs: Msg[] = useMemo(() => ([
    { id: 'm1', role: 'ai', text: 'Hi! I’m Mielo. How can I help?', time: 'now' },
    { id: 'm2', role: 'user', text: 'Show top Twitch streamers in Mexico', time: 'now' },
    { id: 'm3', role: 'ai', text: 'Placeholder results will appear here.', time: 'now' },
  ]), []);
  const [messages, setMessages] = useState<Msg[]>(seedMsgs);
  const [input, setInput] = useState('');
  const onNew = () => { setMessages(seedMsgs); setInput(''); };
  const onClear = () => setMessages([]);

  type Session = { id: string; title: string; time: string };
  const initialSessions: Session[] = useMemo(() => (
    Array.from({ length: 80 }).map((_, i) => ({
      id: `s${i+1}`,
      title: [
        'Top Twitch MX',
        'Campaign Fits',
        'Fraud Flags',
        'Live Now Snapshot',
        'Export CSV – Twitch',
        'Top Categories',
        'Paused Accounts',
        'Budget Summary',
        'Mexico Focus',
        'Chile Highlights',
      ][i % 10],
      time: i === 0 ? 'now' : i < 5 ? `${i*7}m ago` : i < 10 ? `${i-4}h ago` : `${i-9}d ago`,
    }))
  ), []);
  const [sessions, setSessions] = useState<Session[]>(initialSessions);
  const deleteSession = (id: string) => setSessions((prev) => prev.filter(s => s.id !== id));

  

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
          Chat with Mielo
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Ask me anything about your streamers and campaigns using natural language.
        </p>
        {user?.email && (
          <p className="text-sm text-gray-500 mt-2">Logged in as {user.email}</p>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-stretch min-h-0">
        {/* History sidebar */}
        <aside className="md:col-span-1">
          <div className="flex items-center justify-between md:hidden mb-2">
            <p className="text-sm text-gray-400">Chat History</p>
            <button className="btn-outline dark:border-gray-700 dark:text-gray-300" onClick={() => setShowHistoryMobile((v) => !v)}>
              {showHistoryMobile ? 'Hide' : 'Show'}
            </button>
          </div>
          <div className={`card ${showHistoryMobile ? '' : 'hidden md:block'} h-[70vh] md:h-[calc(100vh-16rem)] flex flex-col overflow-hidden min-h-0`}>
            <div className="card-header">
              <p className="text-sm text-gray-400">Chat History</p>
            </div>
            <div className="card-body p-0 flex-1 scroll-area min-h-0">
              <ul className="divide-y divide-gray-200 dark:divide-gray-800">
                {sessions.map((s) => (
                  <li key={s.id} className="p-3 hover:bg-white/5 cursor-pointer">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-gray-100 truncate">{s.title}</p>
                        <p className="text-xs text-gray-500">{s.time}</p>
                      </div>
                      <button
                        aria-label="Delete session"
                        className="rounded-md p-1 hover:bg-white/10 text-gray-400"
                        onClick={(e) => { e.stopPropagation(); deleteSession(s.id); }}
                      >
                        <TrashIcon className="h-4 w-4" />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </aside>

        {/* Chat area */}
        <section className="md:col-span-2">
          <div className="card h-[70vh] md:h-[calc(100vh-16rem)] flex flex-col overflow-hidden min-h-0">
            {/* Chat header */}
            <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-400">Chat</p>
                <p className="text-xs text-gray-500">Ask about streamers and campaigns</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg chip-glass text-xs text-gray-300 hover:bg-white/10"
                  onClick={onNew}
                  title="Start a new chat"
                >
                  <ArrowPathIcon className="h-4 w-4" />
                  <span>New</span>
                </button>
                <button
                  className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg chip-glass text-xs text-gray-300 hover:bg-white/10"
                  onClick={onClear}
                  title="Clear messages"
                >
                  <TrashIcon className="h-4 w-4" />
                  <span>Clear</span>
                </button>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 scroll-area p-4 space-y-4 min-h-0">
              {messages.map(m => (
                <div key={m.id} className="flex items-start gap-3 chat-message">
                  {m.role === 'ai'
                    ? <div className="h-8 w-8 rounded-full chip-glass flex items-center justify-center text-sm font-bold">M</div>
                    : <img src={AVATARS[0]} alt="you" className="h-8 w-8 rounded-full object-cover" />}
                  <div className="flex-1">
                    <div className="text-xs text-gray-500 mb-1">{m.role === 'ai' ? 'Mielo' : 'You'} • {m.time}</div>
                    {m.role === 'ai'
                      ? <div className="chat-bubble-ai">{m.text}</div>
                      : <div className="chat-bubble-user inline-block">{m.text}</div>}
                  </div>
                </div>
              ))}
            </div>

            {/* Suggestions */}
            <div className="px-4 pb-2">
              <div className="flex flex-wrap gap-2">
                {[
                  'Who is live right now?',
                  'Create a campaign for Mexico',
                  'Flag suspicious audience spikes',
                  'Export streamer list to CSV',
                ].map((s) => (
                  <button key={s} className="text-xs px-3 py-1 rounded-full chip-glass text-gray-300 hover:bg-white/10" disabled>
                    {s}
                  </button>
                ))}
              </div>
            </div>

            {/* Input */}
            <div className="border-t border-white/10 p-3">
              <form className="flex items-center gap-2" onSubmit={(e)=> e.preventDefault()}>
                <button type="button" className="btn-outline" disabled>
                  <PlusIcon className="h-5 w-5" />
                </button>
                <input className="form-input flex-1" placeholder="Type your message" value={input} onChange={(e)=> setInput(e.target.value)} />
                <button className="btn-primary flex items-center gap-1 disabled:opacity-60" disabled>
                  <PaperAirplaneIcon className="h-4 w-4" /> Send
                </button>
              </form>
            </div>
          </div>
        </section>
      </div>

      {/* Sample Streamers Table (contextual results), below chat */}
      <div className="mt-4 card">
        <div className="card-header">
          <p className="text-sm text-gray-400">Results Preview</p>
        </div>
        <div className="card-body overflow-x-auto">
          <table className="table table-fixed table-compact table-striped w-full">
            <thead>
              <tr>
                <th><span className="th">#</span></th>
                <th><span className="th">Streamer</span></th>
                <th><span className="th">Region</span></th>
                <th><span className="th">Followers</span></th>
                <th><span className="th">Avg Viewers</span></th>
                <th><span className="th">Last Live</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
              {[
                { n: 'Streamer 1', p: 'twitch', r: 'mexico', f: 102300, a: 2310, ll: '2h ago' },
                { n: 'Streamer 2', p: 'youtube', r: 'colombia', f: 89320, a: 1840, ll: '5h ago' },
                { n: 'Streamer 3', p: 'kick', r: 'chile', f: 55310, a: 980, ll: '1d ago' },
                { n: 'Streamer 4', p: 'twitch', r: 'argentina', f: 120440, a: 3120, ll: '30m ago' },
              ].map((row, i) => (
                <tr key={i}>
                  <td className="text-gray-400 text-sm">{i+1}</td>
                  <td className="text-gray-100">
                    <div className="flex items-center gap-3">
                      <div className="avatar avatar-sm">
                        <img className="w-full h-full rounded-full object-cover" src={AVATARS[i % AVATARS.length]} alt="avatar" />
                        <span className={`platform-badge ${row.p === 'twitch' ? 'brand-twitch' : row.p === 'youtube' ? 'brand-youtube' : 'brand-kick'}`}>
                          <PlatformIcon name={row.p as any} className="h-3 w-3" />
                        </span>
                      </div>
                      <div className="truncate">
                        <div className="truncate">{row.n}</div>
                        <div className="text-xs text-gray-400 truncate">Top Games: RPG, IRL</div>
                      </div>
                    </div>
                  </td>
                  <td><span className="region-chip"><span className="text-sm">{flagFor(row.r)}</span><span>{regionLabel(row.r)}</span></span></td>
                  <td className="text-left text-gray-300">{row.f.toLocaleString()}</td>
                  <td className="text-left text-gray-300">{row.a.toLocaleString()}</td>
                  <td className="text-left text-gray-300">{row.ll}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default ChatPage;
