import React, { useState } from 'react';
import { useAuth, SAMPLE_PERSONAS } from '../context/AuthContext';
import { GoogleOAuthProvider, GoogleLogin } from '@react-oauth/google';
import { X, User, Sparkles, LogIn, KeyRound, ShieldCheck, Crown } from 'lucide-react';

export default function AuthModal() {
  const {
    isAuthModalOpen,
    closeAuthModal,
    loginWithDev,
    loginWithGoogle,
    authConfig,
    devLoginEnabled,
    googleClientIdConfigured,
    googleClientId
  } = useAuth();
  const [customName, setCustomName] = useState('');
  const [customEmail, setCustomEmail] = useState('');
  const [customIsAdmin, setCustomIsAdmin] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  if (!isAuthModalOpen) return null;

  const handleDevLogin = async (name, email, avatar, isAdmin) => {
    try {
      setLoading(true);
      setError(null);
      await loginWithDev(name, email, avatar, isAdmin);
    } catch (err) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const handleCustomSubmit = async (e) => {
    e.preventDefault();
    if (!customName.trim()) {
      setError('Please enter a name');
      return;
    }
    const avatar = `https://api.dicebear.com/7.x/adventurer/svg?seed=${encodeURIComponent(customName.trim())}`;
    await handleDevLogin(customName.trim(), customEmail.trim(), avatar, customIsAdmin);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden p-6 sm:p-8">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800/80">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
              <LogIn className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-100">Sign In to Tapestry</h2>
              <p className="text-xs text-slate-400">Authenticate to contribute, manage Parties, & moderate</p>
            </div>
          </div>
          <button
            onClick={closeAuthModal}
            className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="mt-4 p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-300 text-xs">
            {error}
          </div>
        )}

        {devLoginEnabled ? (
          <>
            {/* Quick Demo Personas (Dev Mode) */}
            <div className="mt-6">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                  Quick One-Click Personas
                </span>
                <span className="text-[11px] text-cyan-400/80 bg-cyan-950/60 px-2 py-0.5 rounded-full border border-cyan-800/40">
                  Dev Mode
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                {SAMPLE_PERSONAS.map((persona) => (
                  <button
                    key={persona.name}
                    onClick={() => handleDevLogin(persona.name, persona.email, persona.avatar, persona.isAdmin)}
                    disabled={loading}
                    className={`flex items-center space-x-2.5 p-2.5 rounded-xl border text-left transition-all group ${
                      persona.isSuperAdmin
                        ? 'bg-gradient-to-r from-purple-950/50 to-indigo-950/40 border-purple-500/40 hover:border-purple-400'
                        : persona.isAdmin
                        ? 'bg-gradient-to-r from-amber-950/40 to-slate-900 border-amber-500/40 hover:border-amber-400'
                        : 'bg-slate-800/60 hover:bg-slate-800 border-slate-700/60 hover:border-cyan-500/40'
                    }`}
                  >
                    <img
                      src={persona.avatar}
                      alt={persona.name}
                      className="w-9 h-9 rounded-lg bg-slate-700 p-0.5 object-cover flex-shrink-0 group-hover:scale-105 transition-transform"
                    />
                    <div className="min-w-0">
                      <div className="flex items-center gap-1">
                        <p className="text-xs font-semibold text-slate-200 truncate group-hover:text-cyan-300">
                          {persona.name}
                        </p>
                        {persona.isSuperAdmin ? (
                          <Crown className="w-3 h-3 text-purple-400 flex-shrink-0" />
                        ) : persona.isAdmin ? (
                          <ShieldCheck className="w-3 h-3 text-amber-400 flex-shrink-0" />
                        ) : null}
                      </div>
                      <p className="text-[10px] text-slate-400 truncate">
                        {persona.isSuperAdmin ? 'Super Admin' : persona.isAdmin ? 'Test Admin' : 'Fan • Good Honor'}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-800"></div>
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-slate-900 px-3 text-slate-500 font-medium">Or Custom Persona</span>
              </div>
            </div>

            {/* Custom Persona Form */}
            <form onSubmit={handleCustomSubmit} className="space-y-3.5">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Display Name <span className="text-rose-400">*</span>
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="e.g. Satoshi Nakamoto"
                    value={customName}
                    onChange={(e) => setCustomName(e.target.value)}
                    className="w-full pl-9 pr-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-colors"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Email (Optional)
                </label>
                <input
                  type="email"
                  placeholder="user@example.com"
                  value={customEmail}
                  onChange={(e) => setCustomEmail(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-colors"
                />
              </div>

              <label className="flex items-center space-x-2 cursor-pointer py-1">
                <input
                  type="checkbox"
                  checked={customIsAdmin}
                  onChange={(e) => setCustomIsAdmin(e.target.checked)}
                  className="w-4 h-4 rounded border-slate-700 bg-slate-950 text-cyan-500 focus:ring-cyan-500"
                />
                <span className="text-xs text-slate-300 flex items-center gap-1">
                  Grant Admin privileges <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
                </span>
              </label>

              <button
                type="submit"
                disabled={loading || !customName.trim()}
                className="w-full py-2.5 px-4 bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium text-sm rounded-xl shadow-lg shadow-cyan-500/20 transition-all flex items-center justify-center space-x-2"
              >
                <KeyRound className="w-4 h-4" />
                <span>{loading ? 'Authenticating...' : 'Sign In as Custom Persona'}</span>
              </button>
            </form>
          </>
        ) : (
          /* Staging / Production Authentication View */
          <div className="mt-6 space-y-4 text-center">
            <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl space-y-2">
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 capitalize">
                {authConfig?.environment === 'staging' ? 'Staging Mode Active' : `${authConfig?.environment || 'production'} Mode Active`}
              </span>
              <p className="text-xs text-slate-300">
                Mock developer personas and dev login are disabled in {authConfig?.environment || 'staging'}.
              </p>
            </div>

            {googleClientIdConfigured && googleClientId ? (
              <div className="py-4 flex flex-col items-center justify-center space-y-3">
                <p className="text-xs text-slate-400 mb-1">Sign in securely using your Google Account:</p>
                <div className="flex justify-center">
                  <GoogleOAuthProvider clientId={googleClientId}>
                    <GoogleLogin
                      onSuccess={async (credentialResponse) => {
                        if (credentialResponse.credential) {
                          try {
                            setLoading(true);
                            setError(null);
                            await loginWithGoogle(credentialResponse.credential);
                          } catch (err) {
                            setError(err.message || 'Google Sign-In failed');
                          } finally {
                            setLoading(false);
                          }
                        }
                      }}
                      onError={() => {
                        setError('Google Sign-In failed. Please try again.');
                      }}
                      theme="filled_blue"
                      shape="pill"
                      size="large"
                      text="signin_with"
                    />
                  </GoogleOAuthProvider>
                </div>
              </div>
            ) : (
              <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-xs text-amber-300 text-left">
                <strong>Google OAuth Not Configured</strong>
                <p className="mt-1 text-[11px] text-amber-200/80">
                  Please configure <code className="text-amber-400 bg-amber-950/60 px-1 py-0.5 rounded">GOOGLE_CLIENT_ID</code> in server environment variables to allow Google OAuth login.
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
