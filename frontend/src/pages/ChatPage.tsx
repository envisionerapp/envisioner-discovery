import React, { useState, useRef, useEffect } from 'react';
import { formatDistanceToNow } from 'date-fns';
import ReactMarkdown from 'react-markdown';
import { useAuth } from '@/hooks/useAuth';
import { useChat } from '@/hooks/useChat';
import {
  PaperAirplaneIcon,
  PlusIcon,
  ArrowPathIcon,
  TrashIcon,
  SparklesIcon,
  ClockIcon,
  ExclamationTriangleIcon,
  HashtagIcon,
  UsersIcon,
  EyeIcon,
  TrophyIcon
} from '@heroicons/react/24/outline';
import { getStreamerAvatar, DEFAULT_AVATAR } from '@/utils/avatars';
import { PlatformIcon } from '@/components/icons/PlatformIcon';

// Handle image load errors by falling back to placeholder
const handleImageError = (e: React.SyntheticEvent<HTMLImageElement>) => {
  const img = e.currentTarget;
  if (img.src !== DEFAULT_AVATAR) {
    img.src = DEFAULT_AVATAR;
  }
};
import { flagFor, regionLabel } from '@/utils/geo';
// Results now rendered via table theme
import { ChatStreamerTable } from '@/components/ChatStreamerTable';
import { LoadingSpinner } from '@/components/LoadingSpinner';

const ChatPage: React.FC = () => {
  const { user } = useAuth();
  const {
    chatState,
    conversationHistory,
    suggestions,
    sendMessage,
    searchStreamers,
    loadConversation,
    deleteConversation,
    startNewConversation,
    clearMessages,
    clearAllHistory
  } = useChat();

  const [showHistoryMobile, setShowHistoryMobile] = useState(false);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [selected, setSelected] = useState<any | null>(null);
  const [lastQuery, setLastQuery] = useState<string>(''); // Track last search query
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatState.messages]);

  // Focus input when not loading
  useEffect(() => {
    if (!chatState.isLoading && inputRef.current) {
      inputRef.current.focus();
    }
  }, [chatState.isLoading]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || chatState.isLoading) return;

    const message = input.trim();
    setInput('');
    setIsTyping(false);
    setLastQuery(message); // Track the query

    await sendMessage(message);
  };

  const handleSuggestionClick = async (suggestion: string) => {
    setInput(suggestion);
    setLastQuery(suggestion); // Track the query
    await sendMessage(suggestion);
  };

  const handleNewChat = () => {
    startNewConversation();
    setInput('');
    setLastQuery(''); // Clear last query on new chat
  };

  const handleClearMessages = () => {
    clearMessages();
    setInput('');
    setLastQuery(''); // Clear last query
  };

  const formatTime = (timestamp: Date | string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / (1000 * 60));
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (minutes < 1) return 'now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
  };

  const formatProcessingTime = (ms?: number) => {
    if (!ms) return '';
    const seconds = (ms / 1000).toFixed(1);
    return `${seconds}s`;
  };

  return (
    <>
      <div className="w-full max-w-7xl mx-auto px-2 sm:px-4 lg:px-6 overflow-hidden h-full flex flex-col">
        <div className="mb-4 md:mb-6 hidden md:block flex-shrink-0">
          <div className="flex items-center gap-2 md:gap-3 mb-2">
            <div className="p-1.5 md:p-2 rounded-lg bg-gradient-to-r from-primary-500 to-primary-600">
              <SparklesIcon className="h-5 w-5 md:h-6 md:w-6 text-black" />
            </div>
            <div>
              <h1 className="text-xl md:text-2xl font-bold text-gray-900 dark:text-gray-100">
                Chat with Envisioner
              </h1>
              <p className="text-sm md:text-base text-gray-600 dark:text-gray-400 hidden sm:block">
                Ask me anything about LATAM streamers using natural language.
              </p>
            </div>
          </div>
          {user?.email && (
            <div className="flex items-center gap-2 text-xs md:text-sm text-gray-500 flex-wrap">
              <span className="truncate max-w-[200px] md:max-w-none">Logged in as {user.email}</span>
              {chatState.processingTime && (
                <>
                  <span className="hidden sm:inline">•</span>
                  <div className="flex items-center gap-1">
                    <ClockIcon className="h-3 w-3" />
                    <span className="whitespace-nowrap">Last response: {formatProcessingTime(chatState.processingTime)}</span>
                  </div>
                </>
              )}
            </div>
          )}
        </div>

      <div className="flex flex-col lg:flex-row gap-3 md:gap-4 lg:gap-6 w-full max-w-full flex-1 min-h-0">
        {/* History sidebar */}
        <aside className="w-full lg:w-72 xl:w-80 flex-shrink-0">
          <div className="flex items-center justify-between lg:hidden mb-2">
            <p className="text-sm font-medium text-gray-400">Chat History</p>
            <button
              className="btn-outline dark:border-gray-700 dark:text-gray-300 text-xs px-3 py-1"
              onClick={() => setShowHistoryMobile(!showHistoryMobile)}
            >
              {showHistoryMobile ? 'Hide' : 'Show'}
            </button>
          </div>

          <div className={`${showHistoryMobile ? 'block' : 'hidden'} lg:block mb-3 lg:mb-0 h-full`} style={{ width: '100%', minWidth: 0 }}>
            <div className="card flex flex-col h-auto max-h-[400px] sm:max-h-[500px] md:max-h-[600px] lg:h-full lg:max-h-none overflow-hidden" style={{ width: '100%', minWidth: 0 }}>
            <div className="px-2 py-2 sm:px-3 sm:py-3 md:px-4 md:py-4 border-b border-gray-800/30 flex-shrink-0 rounded-t-xl" style={{ background: 'linear-gradient(90deg, rgba(255, 107, 53, 0.08) 0%, transparent 100%)' }}>
              <div className="flex items-center justify-between">
                <p className="text-xs md:text-sm font-semibold text-gray-400 uppercase tracking-wide">Conversations</p>
                <button
                  className="inline-flex items-center gap-1 md:gap-1.5 px-2 py-1 md:px-3 md:py-1.5 rounded-lg bg-primary-600 hover-darken-primary text-xs text-black font-bold transition-colors"
                  onClick={clearAllHistory}
                  title="Clear all history"
                  style={{ minWidth: '32px', minHeight: '32px' }}
                >
                  <TrashIcon className="h-3 w-3 md:h-4 md:w-4" />
                  <span className="hidden lg:inline">Clear</span>
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto overflow-x-hidden min-h-0" style={{ WebkitOverflowScrolling: 'touch' }}>
              {conversationHistory.isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <LoadingSpinner size="sm" />
                </div>
              ) : conversationHistory.conversations.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <p className="text-sm">No conversations yet.</p>
                  <p className="text-xs mt-1">Start chatting to see history!</p>
                </div>
              ) : (
                <ul className="divide-y" style={{ borderColor: 'rgba(156, 163, 175, 0.3)' }}>
                  {conversationHistory.conversations.map((conversation) => (
                    <li key={conversation.id} className="hover:bg-white/5 cursor-pointer" style={{ padding: '0.5rem' }}>
                      <div
                        className="flex items-start justify-between gap-2"
                        onClick={() => {
                          loadConversation(conversation.id);
                          // Set lastQuery to the conversation title so results show
                          setLastQuery(conversation.title);
                        }}
                      >
                        <div className="flex-1" style={{ minWidth: 0, overflow: 'hidden' }}>
                          <p className="text-gray-100 truncate font-medium" style={{ fontSize: '0.875rem', lineHeight: '1.25rem' }}>
                            {conversation.title}
                          </p>
                          <p className="text-gray-400 truncate" style={{ fontSize: '0.75rem', lineHeight: '1rem', marginTop: '0.25rem' }}>
                            {conversation.lastMessage}
                          </p>
                          <div className="flex items-center gap-2 text-gray-500" style={{ fontSize: '0.75rem', marginTop: '0.25rem', flexWrap: 'wrap' }}>
                            <span style={{ whiteSpace: 'nowrap' }}>{formatTime(conversation.lastActivity)}</span>
                            <span>•</span>
                            <span style={{ whiteSpace: 'nowrap' }}>{conversation.messageCount} msg</span>
                          </div>
                        </div>
                        <button
                          className="inline-flex items-center justify-center rounded-lg bg-[#FF6B35]/90 hover:bg-[#FF6B35] transition-colors"
                          style={{ flexShrink: 0, marginLeft: '0.5rem', minWidth: '32px', minHeight: '32px', padding: '0.25rem' }}
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteConversation(conversation.id);
                          }}
                          title="Delete conversation"
                        >
                          <TrashIcon className="h-3 w-3 text-white" />
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
          </div>
        </aside>

        {/* Chat area */}
        <section className="flex-1 w-full min-w-0 min-h-0">
          <div className="card flex flex-col w-full max-w-full h-full">
            {/* Chat header */}
            <div className="px-3 py-2 md:px-4 md:py-3 border-b border-gray-800/30 flex items-center justify-between flex-shrink-0 rounded-t-xl" style={{ background: 'linear-gradient(90deg, rgba(255, 107, 53, 0.08) 0%, transparent 100%)' }}>
              <div>
                <p className="text-xs md:text-sm font-semibold text-gray-400 uppercase tracking-wide">Assistant</p>
                <p className="text-xs text-gray-500 hidden sm:block">
                  {chatState.isLoading ? 'Thinking…' : 'Ready for your questions'}
                </p>
              </div>
              <div className="flex items-center gap-1 md:gap-2">
                <button
                  className="inline-flex items-center justify-center gap-1 md:gap-1.5 px-2 py-1 md:px-3 md:py-1.5 rounded-lg bg-primary-600 hover-darken-primary text-xs text-black font-bold h-8"
                  onClick={handleNewChat}
                  title="Start a new chat"
                  aria-label="New"
                >
                  <span className="text-base md:text-lg leading-none">+</span>
                </button>
                <button
                  className="inline-flex items-center gap-1 md:gap-1.5 px-2 py-1 md:px-3 md:py-1.5 rounded-lg bg-primary-600 hover-darken-primary text-xs text-black font-bold h-8"
                  onClick={handleClearMessages}
                  title="Clear current messages"
                >
                  <TrashIcon className="h-3 w-3 md:h-4 md:w-4" />
                  <span className="hidden sm:inline">Clear</span>
                </button>
              </div>
            </div>

            {/* Messages */}
            <div className="p-3 md:p-4 space-y-3 md:space-y-4 flex-1 overflow-y-auto overflow-x-hidden min-h-0 w-full max-w-full" style={{ WebkitOverflowScrolling: 'touch' }}>
              {(chatState.messages || []).length === 0 ? (
                <div className="text-center py-8 md:py-12">
                  <div className="mx-auto w-12 h-12 md:w-16 md:h-16 rounded-full bg-gradient-to-r from-primary-500 to-primary-600 flex items-center justify-center mb-3 md:mb-4">
                    <SparklesIcon className="h-6 w-6 md:h-8 md:w-8 text-black" />
                  </div>
                  <h3 className="text-base md:text-lg font-medium text-gray-300 mb-2">
                    Welcome to Envisioner!
                  </h3>
                  <p className="text-sm md:text-base text-gray-400 px-4">
                    I can help you discover and analyze LATAM streamers using natural language.
                  </p>
                </div>
              ) : (
                <>
                  {(Array.isArray(chatState.messages) ? chatState.messages : []).map((message) => (
                    <div key={message.id} className="flex items-start gap-2 md:gap-3 chat-message w-full max-w-full">
                      {message.type === 'assistant' ? (
                        <div className="h-7 w-7 md:h-8 md:w-8 rounded-full bg-gradient-to-r from-primary-500 to-primary-600 flex items-center justify-center text-xs md:text-sm font-bold text-white flex-shrink-0">E</div>
                      ) : (
                        <img
                          src={DEFAULT_AVATAR}
                          alt="You"
                          className="h-7 w-7 md:h-8 md:w-8 rounded-full object-cover flex-shrink-0"
                        />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 md:gap-2 text-xs text-gray-500 mb-1 flex-wrap">
                          <span>{message.type === 'assistant' ? 'Envisioner' : 'You'}</span>
                          <span>•</span>
                          <span>{formatTime(message.timestamp)}</span>
                          {message.processingTime && (
                            <>
                              <span>•</span>
                              <span>{formatProcessingTime(message.processingTime)}</span>
                            </>
                          )}
                        </div>
                        {message.type === 'assistant' ? (
                          <>
                            <div className="chat-bubble-ai text-sm md:text-base w-full max-w-full break-words">
                              <ReactMarkdown
                                components={{
                                  p: ({node, ...props}) => <p className="mb-3 last:mb-0" {...props} />,
                                  strong: ({node, ...props}) => <strong className="font-bold text-primary-400" {...props} />,
                                  ul: ({node, ...props}) => <ul className="list-none space-y-1.5 my-3" {...props} />,
                                  li: ({node, ...props}) => <li className="ml-0 leading-relaxed" {...props} />,
                                  h3: ({node, ...props}) => <h3 className="font-bold text-gray-200 mt-4 mb-2 first:mt-0" {...props} />,
                                  h4: ({node, ...props}) => <h4 className="font-bold text-gray-300 mt-3 mb-1.5 first:mt-0" {...props} />
                                }}
                              >
                                {message.response || message.message}
                              </ReactMarkdown>
                            </div>
                            {message.streamers && message.streamers.length > 0 && (
                              <button
                                onClick={() => {
                                  // Extract the user's query from the previous message
                                  const messageIndex = chatState.messages.findIndex(m => m.id === message.id);
                                  const userMessage = messageIndex > 0 ? chatState.messages[messageIndex - 1] : null;
                                  if (userMessage && userMessage.type === 'user') {
                                    // Use stored streamers data directly instead of re-running search
                                    setLastQuery(userMessage.message);
                                    chatState.streamers = message.streamers;
                                    chatState.resultCount = message.streamers.length;
                                  }
                                }}
                                className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary-600 hover-darken-primary text-xs text-black font-bold"
                              >
                                <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                </svg>
                                View Results ({message.streamers.length})
                              </button>
                            )}
                          </>
                        ) : (
                          <div className="chat-bubble-user inline-block text-sm md:text-base max-w-full break-words">
                            {message.message}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}

                  {chatState.isLoading && (
                    <div className="flex items-start gap-2 md:gap-3 chat-message">
                      <div className="h-7 w-7 md:h-8 md:w-8 rounded-full bg-gradient-to-r from-primary-500 to-primary-600 flex items-center justify-center text-xs md:text-sm font-bold text-black flex-shrink-0 animate-pulse">
                        M
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs text-gray-500 mb-2 flex items-center gap-2">
                          <span>Envisioner</span>
                          <span>•</span>
                          <span className="flex items-center gap-1">
                            <span className="inline-block w-1 h-1 rounded-full bg-primary-500 animate-bounce" style={{ animationDelay: '0ms' }}></span>
                            <span className="inline-block w-1 h-1 rounded-full bg-primary-500 animate-bounce" style={{ animationDelay: '150ms' }}></span>
                            <span className="inline-block w-1 h-1 rounded-full bg-primary-500 animate-bounce" style={{ animationDelay: '300ms' }}></span>
                          </span>
                        </div>
                        <div className="chat-bubble-ai text-sm md:text-base">
                          <div className="flex items-center gap-3">
                            <div className="flex items-center gap-1">
                              <div className="w-2 h-2 rounded-full bg-primary-500 animate-pulse" style={{ animationDelay: '0ms' }}></div>
                              <div className="w-2 h-2 rounded-full bg-primary-500 animate-pulse" style={{ animationDelay: '200ms' }}></div>
                              <div className="w-2 h-2 rounded-full bg-primary-500 animate-pulse" style={{ animationDelay: '400ms' }}></div>
                            </div>
                            <span className="text-gray-400">Analyzing streamers...</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  <div ref={messagesEndRef} />
                </>
              )}
            </div>

            {/* Error display */}
            {chatState.error && (
              <div className="px-3 py-2 md:px-4 md:py-2 bg-[#FF6B35]/10 border-t border-[#FF6B35]/20 flex-shrink-0">
                <div className="flex items-center gap-2 text-[#FF6B35] text-xs md:text-sm">
                  <ExclamationTriangleIcon className="h-3.5 w-3.5 md:h-4 md:w-4 flex-shrink-0" />
                  <span className="break-words">{chatState.error}</span>
                </div>
              </div>
            )}


            {/* Input */}
            <div className="border-t border-white/10 p-2 md:p-3 flex-shrink-0">
              <form className="flex items-center gap-1.5 md:gap-2" onSubmit={handleSubmit}>
                <button
                  type="button"
                  className="btn-outline p-1.5 md:p-2 hidden sm:flex"
                  disabled
                  title="Attach files (coming soon)"
                >
                  <PlusIcon className="h-4 w-4 md:h-5 md:w-5" />
                </button>
                <input
                  ref={inputRef}
                  className="form-input flex-1 text-sm md:text-base"
                  placeholder={chatState.isLoading ? "Processing…" : "Ask me about streamers..."}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  disabled={chatState.isLoading}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSubmit(e as any);
                    }
                  }}
                />
                <button
                  type="submit"
                  className="btn-primary flex items-center gap-1.5 md:gap-2 disabled:opacity-50 px-3 py-2 md:px-4 md:py-2 text-sm md:text-base"
                  disabled={chatState.isLoading || !input.trim()}
                >
                  {chatState.isLoading ? (
                    <LoadingSpinner size="sm" />
                  ) : (
                    <PaperAirplaneIcon className="h-3.5 w-3.5 md:h-4 md:w-4" />
                  )}
                  <span className="hidden sm:inline">Send</span>
                </button>
              </form>
            </div>
          </div>
        </section>
      </div>

        {/* Streamer Results - use table theme to match Streamers view */}
        {lastQuery && (
          <div className="mt-6 w-full max-w-full overflow-hidden">
            <ChatStreamerTable
              streamers={chatState.streamers}
              totalCount={chatState.totalCount}
              query={lastQuery}
              onViewDetails={(streamer) => { setSelected(streamer); setShowDetails(true); }}
              onPlatformFilter={(platform) => {
                // When platform filter is clicked, trigger a new search with platform filter (silent mode - no new messages)
                if (lastQuery) {
                  const platformParam = platform ? [platform.toUpperCase()] : undefined;
                  searchStreamers(lastQuery, { platforms: platformParam }, true); // true = silent mode
                }
              }}
            />
          </div>
        )}
      </div>

      {showDetails && selected && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowDetails(false)} />
          <div className="absolute inset-y-0 right-0 w-full sm:w-[580px] card overflow-y-auto" style={{ boxShadow: '-4px 0 24px rgba(0,0,0,0.5)' }}>
            {/* Header with Avatar */}
            <div className="sticky top-0 z-10 backdrop-blur-md border-b p-5 rounded-t-xl" style={{ background: 'rgba(255, 107, 53, 0.08)', borderColor: 'rgba(255, 107, 53, 0.2)' }}>
              <div className="flex items-start gap-4">
                <div className="relative">
                  <img
                    src={getStreamerAvatar(selected)}
                    alt={selected.displayName}
                    className="w-16 h-16 rounded-full object-cover border-2 border-primary-500/30"
                    onError={handleImageError}
                  />
                  {selected.platform && (
                    <span className={`absolute -bottom-0.5 -right-0.5 flex items-center justify-center rounded-full ${
                      String(selected.platform).toLowerCase() === 'twitch' ? 'brand-twitch' :
                      String(selected.platform).toLowerCase() === 'youtube' ? 'brand-youtube' :
                      'brand-kick'
                    } w-5 h-5`} style={{ backgroundColor: 'rgba(20, 28, 46, 0.9)' }}>
                      <PlatformIcon name={String(selected.platform).toLowerCase() as any} className="h-3 w-3" />
                    </span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-xl font-bold text-gray-100 mb-1">{selected.displayName}</h3>
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    {flagFor(String(selected.region || '').toLowerCase()) && (
                      <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg bg-gray-800/60 text-gray-300 border border-gray-700">
                        <span className="text-sm">{flagFor(String(selected.region).toLowerCase())}</span>
                        <span>{regionLabel(String(selected.region))}</span>
                      </span>
                    )}
                    {selected.language && (
                      <span className="inline-flex items-center px-2 py-1 rounded-lg bg-gray-800/60 text-gray-300 border border-gray-700 uppercase">
                        {selected.language}
                      </span>
                    )}
                  </div>
                </div>
                <button
                  className="flex-shrink-0 p-2 rounded-lg hover:bg-gray-800/60 text-gray-400 hover:text-gray-200 transition-colors"
                  onClick={() => setShowDetails(false)}
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="p-3 sm:p-5 space-y-4 sm:space-y-5">
              {/* Visit Channel Button */}
              {selected.username && selected.platform && (
                <a
                  href={(() => {
                    const cleanUsername = String(selected.username).startsWith('@') ? String(selected.username).slice(1) : String(selected.username);
                    const platform = String(selected.platform).toLowerCase();
                    return platform === 'twitch' ? `https://twitch.tv/${cleanUsername}` :
                           platform === 'youtube' ? `https://www.youtube.com/@${cleanUsername}` :
                           platform === 'kick' ? `https://kick.com/${cleanUsername}` : '#';
                  })()}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block w-full"
                >
                  <button className="w-full py-3 sm:py-4 px-4 rounded-xl font-bold text-sm sm:text-base text-black transition-all duration-200 hover:shadow-lg hover:shadow-primary-500/30 hover:scale-[1.02] active:scale-[0.98]"
                    style={{ background: 'linear-gradient(135deg, #FF6B35 0%, #FF6B35 100%)' }}>
                    <div className="flex items-center justify-center gap-2">
                      <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                      <span>Visit Channel</span>
                    </div>
                  </button>
                </a>
              )}

              {/* Stats Grid */}
              <div className="grid grid-cols-2 gap-2 sm:gap-3">
                <div className="p-3 sm:p-4 rounded-xl border" style={{ background: 'rgba(255, 107, 53, 0.05)', borderColor: 'rgba(255, 107, 53, 0.2)' }}>
                  <div className="flex items-center gap-1.5 sm:gap-2 mb-1">
                    <UsersIcon className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-primary-500" />
                    <p className="text-[10px] sm:text-xs text-gray-400 uppercase tracking-wide">Followers</p>
                  </div>
                  <p className="text-lg sm:text-2xl font-bold text-gray-100">{selected.followers?.toLocaleString?.() || '-'}</p>
                </div>
                <div className="p-3 sm:p-4 rounded-xl border" style={{ background: 'rgba(255, 107, 53, 0.05)', borderColor: 'rgba(255, 107, 53, 0.2)' }}>
                  <div className="flex items-center gap-1.5 sm:gap-2 mb-1">
                    <TrophyIcon className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-[#FF6B35]" />
                    <p className="text-[10px] sm:text-xs text-gray-400 uppercase tracking-wide">Peak Viewers</p>
                  </div>
                  <p className="text-lg sm:text-2xl font-bold text-[#FF6B35]">{selected.highestViewers?.toLocaleString?.() || '-'}</p>
                </div>
                <div className="p-3 sm:p-4 rounded-xl border" style={{ background: 'rgba(255, 107, 53, 0.05)', borderColor: 'rgba(255, 107, 53, 0.2)' }}>
                  <div className="flex items-center gap-1.5 sm:gap-2 mb-1">
                    <EyeIcon className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-primary-500" />
                    <p className="text-[10px] sm:text-xs text-gray-400 uppercase tracking-wide">Current Viewers</p>
                  </div>
                  <p className="text-lg sm:text-2xl font-bold text-gray-100">{selected.currentViewers?.toLocaleString?.() || '-'}</p>
                </div>
                <div className="p-3 sm:p-4 rounded-xl border" style={{ background: 'rgba(255, 107, 53, 0.05)', borderColor: 'rgba(255, 107, 53, 0.2)' }}>
                  <div className="flex items-center gap-1.5 sm:gap-2 mb-1">
                    <ClockIcon className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-gray-500" />
                    <p className="text-[10px] sm:text-xs text-gray-400 uppercase tracking-wide">Last Streamed</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {selected.isLive ? (
                      <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-[9px] sm:text-[10px] font-black bg-[#FF6B35] border border-[#FF6B35] animate-pulse" style={{ animationDuration: '2s' }}>
                        <span className="w-1.5 h-1.5 rounded-full bg-white" />
                        LIVE NOW
                      </span>
                    ) : (
                      <p className="text-xs sm:text-sm font-semibold text-gray-300">
                        {selected.lastStreamed ? new Date(selected.lastStreamed).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '-'}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Bio / Description */}
              {selected.profileDescription && (
                <div className="p-3 sm:p-4 rounded-xl border" style={{ background: 'rgba(255, 107, 53, 0.05)', borderColor: 'rgba(255, 107, 53, 0.2)' }}>
                  <div className="flex items-center gap-2 mb-2 sm:mb-3">
                    <svg className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-primary-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                    <p className="text-xs sm:text-sm text-gray-400 uppercase tracking-wide font-semibold">Bio</p>
                  </div>
                  <p className="text-xs sm:text-sm text-gray-300 leading-relaxed">{selected.profileDescription}</p>
                </div>
              )}

              {/* Social Links */}
              {selected.externalLinks && Object.keys(selected.externalLinks).length > 0 && (
                <div className="p-3 sm:p-4 rounded-xl border" style={{ background: 'rgba(255, 107, 53, 0.05)', borderColor: 'rgba(255, 107, 53, 0.2)' }}>
                  <div className="flex items-center gap-2 mb-2 sm:mb-3">
                    <svg className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-primary-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                    </svg>
                    <p className="text-xs sm:text-sm text-gray-400 uppercase tracking-wide font-semibold">Social Links</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {selected.externalLinks.instagram && (
                      <a
                        href={selected.externalLinks.instagram}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs sm:text-sm font-semibold text-white hover:opacity-80 transition-opacity"
                        style={{ background: 'linear-gradient(45deg, #FF6B35 0%,#FF6B35 25%,#FF6B35 50%,#FF6B35 75%,#FF6B35 100%)' }}
                      >
                        <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
                        </svg>
                        Instagram
                      </a>
                    )}
                    {selected.externalLinks.twitter && (
                      <a
                        href={selected.externalLinks.twitter}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs sm:text-sm font-semibold bg-[#FF6B35] text-white hover:opacity-80 transition-opacity"
                      >
                        <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M23.953 4.57a10 10 0 01-2.825.775 4.958 4.958 0 002.163-2.723c-.951.555-2.005.959-3.127 1.184a4.92 4.92 0 00-8.384 4.482C7.69 8.095 4.067 6.13 1.64 3.162a4.822 4.822 0 00-.666 2.475c0 1.71.87 3.213 2.188 4.096a4.904 4.904 0 01-2.228-.616v.06a4.923 4.923 0 003.946 4.827 4.996 4.996 0 01-2.212.085 4.936 4.936 0 004.604 3.417 9.867 9.867 0 01-6.102 2.105c-.39 0-.779-.023-1.17-.067a13.995 13.995 0 007.557 2.209c9.053 0 13.998-7.496 13.998-13.985 0-.21 0-.42-.015-.63A9.935 9.935 0 0024 4.59z"/>
                        </svg>
                        Twitter
                      </a>
                    )}
                    {selected.externalLinks.youtube && (
                      <a
                        href={selected.externalLinks.youtube}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs sm:text-sm font-semibold bg-[#FF6B35] text-white hover:opacity-80 transition-opacity"
                      >
                        <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
                        </svg>
                        YouTube
                      </a>
                    )}
                    {selected.externalLinks.tiktok && (
                      <a
                        href={selected.externalLinks.tiktok}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs sm:text-sm font-semibold bg-black text-white hover:opacity-80 transition-opacity border border-gray-700"
                      >
                        <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z"/>
                        </svg>
                        TikTok
                      </a>
                    )}
                    {selected.externalLinks.discord && (
                      <a
                        href={selected.externalLinks.discord}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs sm:text-sm font-semibold bg-[#FF6B35] text-white hover:opacity-80 transition-opacity"
                      >
                        <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
                        </svg>
                        Discord
                      </a>
                    )}
                    {selected.externalLinks.facebook && (
                      <a
                        href={selected.externalLinks.facebook}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs sm:text-sm font-semibold bg-[#FF6B35] text-white hover:opacity-80 transition-opacity"
                      >
                        <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                        </svg>
                        Facebook
                      </a>
                    )}
                  </div>
                </div>
              )}

              {/* Tags */}
              {selected.tags && selected.tags.length > 0 && (
                <div className="chip-glass p-3 sm:p-4 rounded-xl border border-gray-800">
                  <div className="flex items-center gap-2 mb-2 sm:mb-3">
                    <HashtagIcon className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-primary-500" />
                    <p className="text-xs sm:text-sm text-gray-400 uppercase tracking-wide">Tags</p>
                  </div>
                  <div className="flex flex-wrap gap-1.5 sm:gap-2">
                    {selected.tags.map((tag: string, idx: number) => (
                      <span key={idx} className="inline-flex items-center px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg bg-primary-600/20 text-primary-300 border border-primary-600/30 text-xs sm:text-sm font-semibold">
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Panel Images */}
              {selected.panelImages && selected.panelImages.length > 0 && (
                <div className="chip-glass p-3 sm:p-4 rounded-xl border border-gray-800">
                  <div className="flex items-center gap-2 mb-2 sm:mb-3">
                    <svg className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-primary-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <p className="text-xs sm:text-sm text-gray-400 uppercase tracking-wide">Channel Panels</p>
                  </div>
                  <div className="grid grid-cols-2 gap-2 sm:gap-3">
                    {selected.panelImages.map((panel: { url: string; alt?: string; link?: string }, idx: number) => (
                      <div key={idx} className="group relative" style={{ display: 'block' }}>
                        {panel.link ? (
                          <a href={panel.link} target="_blank" rel="noopener noreferrer" className="block">
                            <img
                              src={panel.url}
                              alt={panel.alt || `Panel ${idx + 1}`}
                              className="w-full rounded-lg border border-gray-700 hover:border-primary-600 transition-all duration-200 hover:scale-105 cursor-pointer"
                              loading="lazy"
                              onError={(e) => { const container = e.currentTarget.closest('[style*="display"]'); if (container) (container as HTMLElement).style.display = 'none'; }}
                            />
                          </a>
                        ) : (
                          <img
                            src={panel.url}
                            alt={panel.alt || `Panel ${idx + 1}`}
                            className="w-full rounded-lg border border-gray-700"
                            loading="lazy"
                            onError={(e) => { const container = e.currentTarget.closest('[style*="display"]'); if (container) (container as HTMLElement).style.display = 'none'; }}
                          />
                        )}
                        {panel.alt && (
                          <div className="absolute inset-0 bg-black/80 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg p-2 flex items-center justify-center">
                            <p className="text-[10px] text-gray-200 text-center line-clamp-3">{panel.alt}</p>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Stream History */}
              {selected.streamTitles && selected.streamTitles.length > 0 && (
                <div className="chip-glass p-3 sm:p-4 rounded-xl border border-gray-800">
                  <div className="flex items-center gap-2 mb-2 sm:mb-3">
                    <svg className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-primary-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                    <p className="text-xs sm:text-sm text-gray-400 uppercase tracking-wide">Stream History</p>
                  </div>
                  <div className="max-h-48 overflow-y-auto space-y-2 pr-1" style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(255, 107, 53, 0.3) transparent' }}>
                    {selected.streamTitles.map((stream: { title: string; date: string }, idx: number) => (
                      <div key={idx} className="p-2 sm:p-2.5 rounded-lg bg-gray-900/60 border border-gray-700/50 hover:border-gray-600/50 transition-colors">
                        <p className="text-xs sm:text-sm text-gray-200 mb-1 line-clamp-2">{stream.title}</p>
                        <p className="text-[10px] sm:text-xs text-gray-500">
                          {formatDistanceToNow(new Date(stream.date), { addSuffix: true })}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Notes Section */}
              <div className="p-3 sm:p-4 rounded-xl border" style={{ background: 'rgba(255, 107, 53, 0.05)', borderColor: 'rgba(255, 107, 53, 0.2)' }}>
                <div className="flex items-center gap-2 mb-2 sm:mb-3">
                  <svg className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-primary-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                  <p className="text-xs sm:text-sm text-gray-400 uppercase tracking-wide font-semibold">Notes</p>
                </div>
                <textarea
                  className="w-full bg-gray-900/60 border border-gray-700 rounded-lg p-2.5 sm:p-3 text-xs sm:text-sm text-gray-300 placeholder-gray-500 focus:outline-none focus:border-primary-600 focus:ring-1 focus:ring-primary-600"
                  rows={4}
                  placeholder="Add notes about this streamer..."
                  defaultValue={selected.notes || ''}
                />
              </div>

              {/* Assignments Section */}
              <div className="p-3 sm:p-4 rounded-xl border" style={{ background: 'rgba(255, 107, 53, 0.05)', borderColor: 'rgba(255, 107, 53, 0.2)' }}>
                <div className="flex items-center justify-between mb-2 sm:mb-3">
                  <div className="flex items-center gap-2">
                    <svg className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-primary-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                    <p className="text-xs sm:text-sm text-gray-400 uppercase tracking-wide font-semibold">Campaign Assignments</p>
                  </div>
                  <button className="px-2.5 sm:px-3 py-1 rounded-lg bg-primary-600 text-black text-[10px] sm:text-xs font-bold hover:bg-primary-500 transition-colors">
                    + Assign
                  </button>
                </div>
                <div className="text-xs sm:text-sm text-gray-400 text-center py-3 sm:py-4">
                  No campaign assignments yet
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default ChatPage;
