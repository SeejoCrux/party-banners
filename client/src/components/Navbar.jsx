import React from 'react';
import { useAuth } from '../context/AuthContext';
import {
  Compass,
  ShieldCheck,
  Layers,
  LogIn,
  LogOut
} from 'lucide-react';

export default function Navbar({ activeTab, setActiveTab, sseConnected }) {
  const { user, isAdmin, openAuthModal, logout } = useAuth();

  const tabs = [
    { id: 'parties', label: 'Parties Directory', icon: Compass }
  ];

  // Only include Admin Dashboard tab if the authenticated user is an Admin
  if (isAdmin) {
    tabs.push({ id: 'registry', label: 'Admin Dashboard', icon: ShieldCheck, isSpecial: true });
  }

  const handleTabClick = (tab) => {
    setActiveTab(tab.id);
  };

  return (
    <header className="sticky top-0 z-40 w-full backdrop-blur-xl bg-slate-950/85 border-b border-slate-800/80">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <div
            onClick={() => setActiveTab('parties')}
            className="flex items-center space-x-3 cursor-pointer group"
          >
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-500 via-indigo-500 to-fuchsia-500 p-0.5 shadow-lg shadow-cyan-500/20 group-hover:scale-105 transition-transform">
              <div className="w-full h-full bg-slate-950 rounded-[10px] flex items-center justify-center">
                <Layers className="w-5 h-5 text-cyan-400" />
              </div>
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-extrabold text-lg tracking-tight bg-gradient-to-r from-cyan-400 via-sky-300 to-indigo-400 bg-clip-text text-transparent">
                  Party Banners
                </span>
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-cyan-950 text-cyan-400 border border-cyan-800/60 uppercase tracking-widest">
                  Live
                </span>
              </div>
              <p className="text-[11px] text-slate-400 hidden sm:block">Parties, Tapestries & Live Feed</p>
            </div>
          </div>

          {/* Navigation Tabs */}
          <nav className="hidden md:flex items-center space-x-1 bg-slate-900/90 p-1.5 rounded-xl border border-slate-800">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => handleTabClick(tab)}
                  className={`flex items-center space-x-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    isActive
                      ? tab.isSpecial
                        ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 font-extrabold shadow-md shadow-amber-500/25'
                        : 'bg-gradient-to-r from-cyan-500 to-indigo-600 text-white shadow-md shadow-cyan-500/25'
                      : tab.isSpecial
                      ? 'text-amber-400 hover:text-amber-200 hover:bg-amber-950/40'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                  }`}
                >
                  <Icon
                    className={`w-4 h-4 ${
                      isActive && tab.isSpecial
                        ? 'text-slate-950'
                        : tab.isSpecial
                        ? 'text-amber-400'
                        : isActive
                        ? 'text-white'
                        : 'text-slate-400'
                    }`}
                  />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </nav>

          {/* Right Actions */}
          <div className="flex items-center space-x-3">
            {/* Live SSE status indicator */}
            <div
              className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium border ${
                sseConnected
                  ? 'bg-emerald-950/60 text-emerald-300 border-emerald-800/50'
                  : 'bg-amber-950/60 text-amber-300 border-amber-800/50'
              }`}
              title={sseConnected ? 'Real-time SSE Stream Connected' : 'Connecting to Live Stream...'}
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  sseConnected ? 'bg-emerald-400 animate-pulse-glow' : 'bg-amber-400'
                }`}
              />
              <span className="hidden sm:inline">{sseConnected ? 'SSE Live' : 'Connecting'}</span>
            </div>

            {/* Auth Actions */}
            {user ? (
              <div className="flex items-center space-x-2.5 bg-slate-900 border border-slate-800 rounded-xl p-1 pr-3">
                <img
                  src={user.avatar_url || `https://api.dicebear.com/7.x/adventurer/svg?seed=${encodeURIComponent(user.name)}`}
                  alt={user.name}
                  className="w-7 h-7 rounded-lg bg-slate-800 p-0.5 object-cover"
                />
                <div className="flex flex-col min-w-0">
                  <div className="flex items-center gap-1">
                    <span className="text-xs font-medium text-slate-200 max-w-[90px] truncate">
                      {user.name}
                    </span>
                    {isAdmin && <ShieldCheck className="w-3 h-3 text-amber-400 flex-shrink-0" />}
                  </div>
                </div>
                <button
                  onClick={logout}
                  className="text-slate-400 hover:text-rose-400 p-1 rounded hover:bg-slate-800 transition-colors"
                  title="Sign Out"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <button
                onClick={openAuthModal}
                className="flex items-center space-x-1.5 px-3.5 py-2 bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-white text-xs font-bold rounded-xl shadow-md shadow-cyan-500/20 transition-all"
              >
                <LogIn className="w-3.5 h-3.5" />
                <span>Sign In</span>
              </button>
            )}
          </div>
        </div>

        {/* Mobile Navigation Bar */}
        <div className="flex md:hidden items-center justify-around py-2 border-t border-slate-800/60 overflow-x-auto">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => handleTabClick(tab)}
                className={`flex flex-col items-center py-1 px-3 rounded-lg text-[10px] font-medium transition-colors ${
                  isActive ? 'text-cyan-400 bg-cyan-950/40' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Icon className="w-4 h-4 mb-0.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </header>
  );
}
