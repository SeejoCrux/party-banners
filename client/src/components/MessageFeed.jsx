import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  MessageSquare,
  Send,
  Radio,
  Clock,
  Sparkles,
  ChevronDown,
  RefreshCw,
  ShieldAlert,
  AlertCircle,
  Flag,
  ShieldCheck,
  Ban
} from 'lucide-react';

export default function MessageFeed({ partyId, partyName, sseConnected, onOpenReport }) {
  const { user, token, openAuthModal } = useAuth();

  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [loadingInitial, setLoadingInitial] = useState(true);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  // Fetch initial history
  const fetchMessages = async () => {
    if (!partyId) return;
    try {
      setLoadingInitial(true);
      setError(null);
      const url = `/api/messages?party_id=${partyId}&limit=30`;
      const res = await fetch(url, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      const data = await res.json();
      setMessages(data.messages || []);
      setHasMore(data.hasMore || false);
    } catch (err) {
      console.error('Failed to load messages:', err);
      setError('Could not load message history.');
    } finally {
      setLoadingInitial(false);
    }
  };

  useEffect(() => {
    fetchMessages();
  }, [partyId]);

  // Fetch older paginated messages
  const loadOlderMessages = async () => {
    if (!partyId || messages.length === 0 || loadingOlder) return;
    const oldestId = messages[messages.length - 1].id;

    try {
      setLoadingOlder(true);
      const url = `/api/messages?party_id=${partyId}&before=${oldestId}&limit=20`;
      const res = await fetch(url, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      const data = await res.json();
      if (data.messages && data.messages.length > 0) {
        setMessages((prev) => [...prev, ...data.messages]);
      }
      setHasMore(data.hasMore || false);
    } catch (err) {
      console.error('Failed to load older messages:', err);
    } finally {
      setLoadingOlder(false);
    }
  };

  // Submit new message
  const handleSendMessage = async (e) => {
    if (e) e.preventDefault();
    if (!inputText.trim()) return;

    if (!user) {
      openAuthModal();
      return;
    }

    const textToSend = inputText.trim();

    try {
      setSubmitting(true);
      setError(null);

      const res = await fetch('/api/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          text: textToSend,
          party_id: partyId
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to post message');
      }

      setInputText('');

      setMessages((prev) => {
        if (prev.some((m) => m.id === data.data.id)) return prev;
        return [data.data, ...prev];
      });
    } catch (err) {
      setError(err.message || 'Failed to send message');
    } finally {
      setSubmitting(false);
    }
  };

  useEffect(() => {
    const handleModEvent = (e) => {
      const { type, payload } = e.detail || {};
      if (type === 'content_reported' && payload?.entityType === 'message') {
        setMessages((prev) => prev.filter((m) => m.id !== payload.id));
      } else if (type === 'content_reviewed' && payload?.entityType === 'message') {
        if (payload.status === 'banned') {
          setMessages((prev) => prev.filter((m) => m.id !== payload.id));
        } else if (payload.status === 'blessed') {
          fetchMessages();
        }
      }
    };
    window.addEventListener('tapestry_moderation_event', handleModEvent);
    return () => window.removeEventListener('tapestry_moderation_event', handleModEvent);
  }, [partyId]);

  const handleReportClick = (msg) => {
    if (!user) {
      openAuthModal();
      return;
    }
    if (onOpenReport) {
      onOpenReport(
        {
          type: 'message',
          id: msg.id,
          preview: msg.text,
          author: msg.user_name
        },
        (reportedEntity) => {
          setMessages((prev) => prev.filter((m) => m.id !== reportedEntity.id));
        }
      );
    }
  };

  const formatTime = (dateStr) => {
    if (!dateStr) return 'just now';
    const date = new Date(dateStr.endsWith('Z') ? dateStr : dateStr + 'Z');
    const now = new Date();
    const diffSeconds = Math.floor((now - date) / 1000);

    if (diffSeconds < 60) return 'just now';
    if (diffSeconds < 3600) return `${Math.floor(diffSeconds / 60)}m ago`;
    if (diffSeconds < 86400) return `${Math.floor(diffSeconds / 3600)}h ago`;
    return date.toLocaleDateString();
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900/60 p-6 rounded-2xl border border-slate-800 backdrop-blur-sm">
        <div>
          <div className="flex items-center space-x-2 text-cyan-400 font-semibold text-xs uppercase tracking-wider mb-1">
            <MessageSquare className="w-4 h-4" />
            <span>{partyName ? `Live Feed • ${partyName}` : 'Party Live Stream'}</span>
          </div>
          <h1 className="text-2xl font-extrabold text-slate-100 tracking-tight">
            Live Stream Feed
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Real-time party broadcast powered by unidirectional Server-Sent Events (SSE).
          </p>
        </div>

        {/* Live Status indicator */}
        <div
          className={`flex items-center space-x-2 px-3.5 py-1.5 rounded-xl border text-xs font-semibold ${
            sseConnected
              ? 'bg-emerald-950/40 text-emerald-300 border-emerald-800/60'
              : 'bg-amber-950/40 text-amber-300 border-amber-800/60'
          }`}
        >
          <Radio className={`w-4 h-4 ${sseConnected ? 'text-emerald-400 animate-pulse' : 'text-amber-400'}`} />
          <span>{sseConnected ? 'Real-time Stream' : 'Reconnecting...'}</span>
        </div>
      </div>

      {/* Message Input Box */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-xl space-y-3">
        {user ? (
          <form onSubmit={handleSendMessage} className="space-y-3">
            <div className="flex items-center space-x-3">
              <img
                src={user.avatar_url || `https://api.dicebear.com/7.x/adventurer/svg?seed=${encodeURIComponent(user.name)}`}
                alt={user.name}
                className="w-8 h-8 rounded-lg bg-slate-800 p-0.5 object-cover flex-shrink-0"
              />
              <span className="text-xs font-bold text-slate-300">
                Posting to <span className="text-cyan-400">{partyName || 'Party Feed'}</span> as{' '}
                <span className="text-slate-100">{user.name}</span>
              </span>
            </div>

            <div className="relative">
              <textarea
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage();
                  }
                }}
                maxLength={255}
                placeholder="Write a message to the live feed... (Press Enter to send)"
                rows={3}
                className="w-full p-3.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 resize-none transition-all"
              />
            </div>

            <div className="flex items-center justify-between">
              <span className="text-[11px] text-slate-500">
                {inputText.length} / 255 characters
              </span>

              <button
                type="submit"
                disabled={submitting || !inputText.trim()}
                className="px-4 py-2 bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-bold rounded-xl shadow-md shadow-cyan-500/25 flex items-center space-x-1.5 transition-all"
              >
                {submitting ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Send className="w-3.5 h-3.5" />
                )}
                <span>Post Message</span>
              </button>
            </div>
          </form>
        ) : (
          <div className="flex items-center justify-between p-3 bg-slate-950/70 border border-slate-800/80 rounded-xl">
            <div className="flex items-center space-x-2.5">
              <ShieldAlert className="w-4 h-4 text-cyan-400" />
              <span className="text-xs text-slate-400">Sign in to join the conversation and post messages.</span>
            </div>
            <button
              onClick={openAuthModal}
              className="px-3 py-1.5 bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-bold rounded-lg transition-all"
            >
              Sign In
            </button>
          </div>
        )}
      </div>

      {error && (
        <div className="flex items-center space-x-2 p-3.5 bg-rose-950/60 border border-rose-800/60 rounded-xl text-rose-300 text-xs animate-slide-down">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Messages Timeline */}
      <div className="space-y-3">
        {loadingInitial ? (
          <div className="h-48 flex flex-col items-center justify-center bg-slate-900/40 border border-slate-800/60 rounded-2xl">
            <RefreshCw className="w-6 h-6 text-cyan-400 animate-spin mb-2" />
            <p className="text-xs text-slate-400">Loading live feed...</p>
          </div>
        ) : messages.length === 0 ? (
          <div className="p-8 text-center bg-slate-900/40 border border-dashed border-slate-800 rounded-2xl">
            <Sparkles className="w-8 h-8 text-slate-600 mx-auto mb-2" />
            <h4 className="text-sm font-bold text-slate-300">No Messages Yet</h4>
            <p className="text-xs text-slate-500 mt-1">Be the first to post a message in this Party!</p>
          </div>
        ) : (
          messages.map((msg) => (
            <div
              key={msg.id}
              className={`border rounded-2xl p-4 transition-all shadow-md animate-slide-down flex items-start space-x-3.5 ${
                msg.status === 'banned'
                  ? 'bg-rose-950/30 border-rose-900/80'
                  : 'bg-slate-900/80 border-slate-800/80 hover:border-slate-700/80'
              }`}
            >
              <img
                src={msg.user_avatar || `https://api.dicebear.com/7.x/adventurer/svg?seed=${encodeURIComponent(msg.user_name)}`}
                alt={msg.user_name}
                className="w-10 h-10 rounded-xl bg-slate-800 p-0.5 object-cover flex-shrink-0 border border-slate-700/60"
              />

              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <span className="text-xs font-bold text-slate-200">{msg.user_name}</span>
                    {msg.status === 'blessed' && (
                      <span className="inline-flex items-center space-x-1 px-1.5 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800/60 text-[10px] font-semibold" title="Blessed & verified by Admin">
                        <ShieldCheck className="w-3 h-3 text-emerald-400" />
                        <span>Blessed</span>
                      </span>
                    )}
                    {msg.status === 'banned' && (
                      <span className="inline-flex items-center space-x-1 px-1.5 py-0.5 rounded bg-rose-950 text-rose-300 border border-rose-800/60 text-[10px] font-bold">
                        <Ban className="w-3 h-3 text-rose-400" />
                        <span>TOMBSTONED: {msg.mod_reason || 'Inappropriate'}</span>
                      </span>
                    )}
                  </div>

                  <div className="flex items-center space-x-2.5">
                    <span className="text-[10px] text-slate-500 flex items-center space-x-1">
                      <Clock className="w-3 h-3" />
                      <span>{formatTime(msg.created_at)}</span>
                    </span>

                    {/* Report as Inappropriate Button */}
                    {(!user || user.is_super_admin === 1 || user.is_super_admin === true || user.role === 'Super Admin' || (user.id !== msg.user_id && msg.status !== 'blessed' && msg.status !== 'banned')) && (
                      <button
                        onClick={() => handleReportClick(msg)}
                        className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-lg text-[10px] font-semibold text-slate-400 hover:text-rose-300 bg-slate-800/60 hover:bg-rose-950/50 border border-slate-700/60 hover:border-rose-800/60 transition-colors shadow-sm"
                        title="Report message as inappropriate"
                      >
                        <Flag className="w-3 h-3 text-rose-400" />
                        <span>Report</span>
                      </button>
                    )}
                  </div>
                </div>

                <p className="text-xs sm:text-sm text-slate-300 mt-1.5 break-words whitespace-pre-wrap leading-relaxed">
                  {msg.text}
                </p>
              </div>
            </div>
          ))
        )}

        {/* Load older messages */}
        {hasMore && (
          <div className="text-center pt-2">
            <button
              onClick={loadOlderMessages}
              disabled={loadingOlder}
              className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 rounded-xl text-xs font-semibold inline-flex items-center space-x-1.5 transition-colors"
            >
              {loadingOlder ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5" />
              )}
              <span>Load Older Messages</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
