import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Flag, X, AlertTriangle, Send, RefreshCw, CheckCircle2, ShieldX, Clock } from 'lucide-react';

const REASON_PRESETS = [
  'Inappropriate or NSFW content',
  'Spam, advertising, or bot activity',
  'Harassment or hateful language',
  'Misleading or harmful information',
  'Violates community guidelines'
];

export default function ReportModal({ isOpen, onClose, targetEntity, onReportSubmitted }) {
  const { user, setUser, token, openAuthModal, refreshUserProfile } = useAuth();

  const [selectedPreset, setSelectedPreset] = useState(REASON_PRESETS[0]);
  const [customExplanation, setCustomExplanation] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  // Refresh latest user status (honor and cooldown timestamp) whenever modal is opened
  useEffect(() => {
    if (isOpen && token && refreshUserProfile) {
      refreshUserProfile();
    }
  }, [isOpen, token]);

  if (!isOpen || !targetEntity) return null;

  // Cooldown calculation: strictly for Poor Honor Fans (never Admins, Super Admins, or Good Honor Fans)
  const isAdminOrSuper = !!(user && (user.is_admin === 1 || user.is_admin === true || user.is_super_admin === 1 || user.is_super_admin === true || user.role === 'Admin' || user.role === 'Super Admin'));
  const isPoorHonor = !isAdminOrSuper && user?.honor === 'Poor';
  const isBadHonor = !isAdminOrSuper && user?.honor === 'Bad';

  const cooldownUntil = (isPoorHonor && user?.report_cooldown_until) ? new Date(user.report_cooldown_until) : null;
  const now = new Date();
  const isOnCooldown = !isAdminOrSuper && isPoorHonor && Boolean(cooldownUntil && cooldownUntil > now);
  const remainingMinutes = isOnCooldown ? Math.max(1, Math.ceil((cooldownUntil - now) / (60 * 1000))) : 0;

  const handleClose = () => {
    setError(null);
    setCustomExplanation('');
    setSelectedPreset(REASON_PRESETS[0]);
    onClose();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!user) {
      openAuthModal();
      return;
    }

    if (isOnCooldown) {
      setError(`You are currently on a reporting cooldown. You can submit new reports in ${remainingMinutes} minute(s).`);
      return;
    }

    if (isBadHonor) {
      setError('Fans with Bad Honor cannot report content. Bad Honor upgrades to Poor Honor after 1 week.');
      return;
    }

    const finalReason = customExplanation.trim()
      ? `${selectedPreset}: ${customExplanation.trim()}`
      : selectedPreset;

    try {
      setSubmitting(true);
      setError(null);

      const res = await fetch('/api/moderation/report', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          entityType: targetEntity.type, // 'party' | 'image' | 'message'
          id: targetEntity.id,
          reason: finalReason
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to submit report.');
      }

      // If backend returned updated user state (including new cooldown timestamp), sync context
      if (data.user && setUser) {
        setUser(data.user);
      }

      // Notify parent components so database state and local UI state update immediately
      if (onReportSubmitted) {
        onReportSubmitted(targetEntity);
      }

      // Clean up and close modal immediately
      handleClose();
    } catch (err) {
      setError(err.message || 'Report submission failed.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden p-6 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 bg-rose-500/10 text-rose-400 rounded-xl border border-rose-500/20">
              <Flag className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-100">Report as Inappropriate</h3>
              <p className="text-[11px] text-slate-400">
                Reporting immediately hides this {targetEntity.type} for review by an Admin
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-1 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 1. Active Cooldown Alert (if reporter is on cooldown, regardless of honor) */}
        {isOnCooldown && (
          <div className="p-3.5 bg-amber-950/70 border border-amber-500/60 rounded-xl text-amber-200 text-xs flex items-start space-x-2.5 shadow-sm animate-fade-in">
            <Clock className="w-4 h-4 flex-shrink-0 mt-0.5 text-amber-400 animate-pulse" />
            <div>
              <p className="font-bold text-amber-300">Active Reporting Cooldown</p>
              <p className="text-[11px] text-amber-200/90 mt-0.5 leading-relaxed">
                You are currently on a reporting cooldown. You can submit new reports in <strong>{remainingMinutes} minute{remainingMinutes === 1 ? '' : 's'}</strong>.
              </p>
            </div>
          </div>
        )}

        {/* 2. Bad Honor Warning */}
        {!isOnCooldown && isBadHonor && (
          <div className="p-3.5 bg-rose-950/70 border border-rose-800/80 rounded-xl text-rose-200 text-xs flex items-start space-x-2.5 shadow-sm animate-fade-in">
            <ShieldX className="w-4 h-4 flex-shrink-0 mt-0.5 text-rose-400" />
            <div>
              <p className="font-bold text-rose-300">Reporting Privileges Suspended</p>
              <p className="text-[11px] text-rose-200/90 mt-0.5 leading-relaxed">
                Fans with <strong>Bad Honor</strong> cannot report content. Bad Honor automatically upgrades to Poor Honor after 1 week.
              </p>
            </div>
          </div>
        )}

        {/* 3. Poor Honor Cooldown Notice (if not already on cooldown) */}
        {!isOnCooldown && !isBadHonor && isPoorHonor && (
          <div className="p-2.5 bg-slate-950 border border-amber-500/40 rounded-xl text-amber-300 text-[11px] flex items-start space-x-2 animate-fade-in">
            <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5 text-amber-400" />
            <span>
              <strong>Poor Honor Notice:</strong> Submitting this report will place your account on a 1-hour reporting cooldown.
            </span>
          </div>
        )}

        {error && (
          <div className="p-3 bg-rose-950/60 border border-rose-800/60 rounded-xl text-rose-300 text-xs flex items-start space-x-2 animate-slide-down">
            <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Target preview snippet */}
          <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 text-xs text-slate-300">
            <span className="text-[10px] text-slate-500 uppercase font-semibold block mb-1">
              Target {targetEntity.type} (by {targetEntity.author || 'Fan'}):
            </span>
            <p className="truncate italic">"{targetEntity.preview}"</p>
          </div>

          {/* Presets */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-2">
              Select Reason:
            </label>
            <div className="space-y-1.5">
              {REASON_PRESETS.map((preset) => (
                <label
                  key={preset}
                  className={`flex items-center space-x-2.5 p-2 rounded-xl border text-xs cursor-pointer transition-colors ${
                    selectedPreset === preset
                      ? 'bg-rose-950/40 text-rose-200 border-rose-700/60'
                      : 'bg-slate-950/60 text-slate-400 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <input
                    type="radio"
                    name="reportReason"
                    value={preset}
                    checked={selectedPreset === preset}
                    onChange={() => setSelectedPreset(preset)}
                    disabled={isOnCooldown || isBadHonor}
                    className="text-rose-500 focus:ring-rose-500"
                  />
                  <span>{preset}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Custom note */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Additional Details (Optional):
            </label>
            <textarea
              value={customExplanation}
              onChange={(e) => setCustomExplanation(e.target.value)}
              placeholder="Explain why this content should be reviewed..."
              rows={2}
              disabled={isOnCooldown || isBadHonor}
              className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-rose-500 resize-none disabled:opacity-50"
            />
          </div>

          <div className="flex items-center justify-end space-x-2 pt-2">
            <button
              type="button"
              onClick={handleClose}
              className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || isBadHonor || isOnCooldown}
              className={`px-4 py-2 text-white text-xs font-bold rounded-xl shadow-lg flex items-center space-x-1.5 transition-all ${
                isOnCooldown
                  ? 'bg-amber-800/60 text-amber-200 border border-amber-700/50 cursor-not-allowed opacity-80'
                  : isBadHonor
                  ? 'bg-rose-900/60 text-rose-300 cursor-not-allowed opacity-70'
                  : 'bg-rose-600 hover:bg-rose-500 shadow-rose-600/25'
              }`}
            >
              {submitting ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              ) : isOnCooldown ? (
                <Clock className="w-3.5 h-3.5 text-amber-300" />
              ) : (
                <Send className="w-3.5 h-3.5" />
              )}
              <span>
                {isOnCooldown
                  ? `On Cooldown (${remainingMinutes}m)`
                  : isBadHonor
                  ? 'Reporting Suspended'
                  : 'Submit Report'}
              </span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
