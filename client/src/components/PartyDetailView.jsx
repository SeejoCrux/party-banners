import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  ArrowLeft,
  Globe,
  Share2,
  MessageCircle,
  Code,
  Layers,
  Image as ImageIcon,
  MessageSquare,
  Sparkles,
  ExternalLink,
  Calendar,
  Tag,
  Flag,
  Lock,
  AlertTriangle,
  ShieldAlert
} from 'lucide-react';

import BannerView from './BannerView';
import ImageUploader from './ImageUploader';
import MessageFeed from './MessageFeed';
import GalleryView from './GalleryView';

function formatSocialUrl(platform, rawVal) {
  if (!rawVal || typeof rawVal !== 'string') return null;
  const val = rawVal.trim();
  if (!val) return null;

  if (platform === 'bluesky') {
    if (val.startsWith('http://') || val.startsWith('https://')) return val;
    const cleanHandle = val.replace(/^@/, '').replace(/^bsky\.app\/profile\//, '');
    return `https://bsky.app/profile/${cleanHandle}`;
  }
  if (val.startsWith('http://') || val.startsWith('https://')) return val;
  return `https://${val}`;
}

export default function PartyDetailView({ party, onBack, onOpenReport, sseConnected }) {
  const { user, token, isAdmin, isSuperAdmin, openAuthModal } = useAuth();
  const [subTab, setSubTab] = useState('banner');
  const [partyData, setPartyData] = useState(party);
  const [selectedGalleryImage, setSelectedGalleryImage] = useState(null);
  const [isBlocked, setIsBlocked] = useState(false);

  const refreshParty = async () => {
    try {
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const res = await fetch(`/api/parties/${party.id}`, { headers });
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 403) {
          setIsBlocked(true);
        }
        return;
      }
      if (data.party) {
        setPartyData(data.party);
        if (!isAdmin && (data.party.status === 'reported' || data.party.status === 'banned')) {
          setIsBlocked(true);
        } else {
          setIsBlocked(false);
        }
      }
    } catch (e) {
      console.error('Failed to refresh party:', e);
    }
  };

  useEffect(() => {
    refreshParty();
  }, [party.id, isAdmin, token]);

  const handleSubTabClick = (tabId) => {
    if (tabId === 'studio' && !user) {
      openAuthModal();
      return;
    }
    setSubTab(tabId);
  };

  // If party is reported or banned and user is not admin, show blocked message
  if (isBlocked || (!isAdmin && (partyData.status === 'reported' || partyData.status === 'banned'))) {
    return (
      <div className="max-w-xl mx-auto my-16 bg-slate-900 border border-rose-900/60 rounded-3xl p-8 sm:p-10 text-center space-y-5 shadow-2xl animate-fade-in">
        <div className="w-16 h-16 bg-rose-500/10 text-rose-400 rounded-2xl flex items-center justify-center mx-auto border border-rose-500/20 shadow-inner">
          <Flag className="w-8 h-8" />
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl font-extrabold text-slate-100">Party Under Moderation Review</h2>
          <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
            "{partyData.name}" has been reported for community guideline violations and is currently inaccessible pending review by administrators.
          </p>
        </div>
        <div className="pt-2">
          <button
            onClick={onBack}
            className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold transition-colors inline-flex items-center space-x-2"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Return to Parties Directory</span>
          </button>
        </div>
      </div>
    );
  }

  const socials = partyData.social_links || {};
  const galleryImages = partyData.gallery_images || [];

  return (
    <div className="max-w-7xl mx-auto space-y-8 animate-fade-in">
      {/* Admin Review Banner if currently reported or banned */}
      {isAdmin && (partyData.status === 'reported' || partyData.status === 'banned') && (
        <div className="bg-rose-950/60 border border-rose-700/60 rounded-2xl p-4 flex items-center justify-between text-xs text-rose-200">
          <div className="flex items-center space-x-2.5">
            <ShieldAlert className="w-5 h-5 text-rose-400 flex-shrink-0" />
            <span>
              <strong>Admin Warning:</strong> This Party is marked as <strong>{partyData.status.toUpperCase()}</strong>. It is currently hidden from public users and guests.
            </span>
          </div>
          <span className="px-2.5 py-1 rounded-lg bg-rose-900 font-bold uppercase tracking-wider text-[10px]">
            {partyData.status}
          </span>
        </div>
      )}

      {/* Back button and Report button bar */}
      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="inline-flex items-center space-x-2 text-xs font-bold text-slate-400 hover:text-cyan-400 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Parties Directory</span>
        </button>

        {/* Report Party Button */}
        {(isSuperAdmin || partyData.status !== 'blessed') && (
          <button
            onClick={() => {
              if (!user) {
                openAuthModal();
                return;
              }
              onOpenReport &&
                onOpenReport({
                  type: 'party',
                  id: partyData.id,
                  preview: partyData.name,
                  author: 'Party Creator'
                });
            }}
            className="px-3.5 py-1.5 bg-rose-950/70 hover:bg-rose-900 text-rose-300 border border-rose-800/60 rounded-xl text-xs font-bold flex items-center space-x-1.5 transition-all shadow-sm"
            title="Report this entire Party for community guidelines violations"
          >
            <Flag className="w-3.5 h-3.5 text-rose-400" />
            <span>Report Party</span>
          </button>
        )}
      </div>

      {/* Party Hero Banner */}
      <div className="relative rounded-3xl overflow-hidden border border-slate-800 bg-slate-900 shadow-2xl">
        {/* Background Hero Image */}
        <div className="relative h-64 sm:h-80 md:h-96 w-full overflow-hidden bg-slate-950">
          <img
            src={partyData.hero_image}
            alt={partyData.name}
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/70 to-transparent" />
          <div className="absolute inset-0 bg-slate-950/30 backdrop-blur-[2px]" />
        </div>

        {/* Content Overlay */}
        <div className="relative -mt-36 p-6 sm:p-8 space-y-6">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div className="space-y-3 max-w-3xl">
              {/* Tags */}
              <div className="flex flex-wrap gap-1.5">
                {(partyData.tags || []).map((tag) => (
                  <span
                    key={tag}
                    className="px-2.5 py-1 rounded-lg bg-cyan-950/80 border border-cyan-700/60 text-xs font-bold text-cyan-300 backdrop-blur-md"
                  >
                    #{tag}
                  </span>
                ))}
              </div>

              <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-white tracking-tight drop-shadow-md">
                {partyData.name}
              </h1>

              <p className="text-sm sm:text-base text-slate-300 leading-relaxed max-w-2xl drop-shadow">
                {partyData.description}
              </p>
            </div>

            {/* Social Links Bar */}
            {Object.keys(socials).length > 0 && (
              <div className="flex items-center space-x-2 bg-slate-900/90 backdrop-blur-md p-2 rounded-2xl border border-slate-800 shadow-xl flex-shrink-0">
                {Object.entries(socials).map(([platform, urlVal]) => {
                  const href = formatSocialUrl(platform, urlVal);
                  if (!href) return null;
                  return (
                    <a
                      key={platform}
                      href={href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2.5 bg-slate-800 hover:bg-cyan-500 hover:text-slate-950 text-slate-300 rounded-xl transition-all shadow-sm flex items-center space-x-1"
                      title={platform === 'bluesky' ? 'Bluesky Profile' : platform.toUpperCase()}
                    >
                      <Globe className="w-4 h-4" />
                      <span className="text-[10px] font-bold uppercase">{platform === 'bluesky' ? 'Bluesky' : platform}</span>
                    </a>
                  );
                })}
              </div>
            )}
          </div>

          {/* Gallery Strip if images exist */}
          {galleryImages.length > 0 && (
            <div className="pt-4 border-t border-slate-800/80 space-y-2">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                Party Gallery
              </span>
              <div className="flex items-center space-x-3 overflow-x-auto pb-2">
                {galleryImages.map((imgUrl, idx) => (
                  <button
                    key={idx}
                    onClick={() => setSelectedGalleryImage(imgUrl)}
                    className="relative w-28 h-20 rounded-xl overflow-hidden border border-slate-800 hover:border-cyan-500 flex-shrink-0 group transition-all"
                  >
                    <img
                      src={imgUrl}
                      alt={`Gallery ${idx}`}
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform"
                    />
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Sub-Navigation Tabs */}
        <div className="px-6 sm:px-8 border-t border-slate-800/80 bg-slate-950/70 flex items-center space-x-1 overflow-x-auto py-2">
          {[
            { id: 'banner', label: 'Party Tapestry', icon: Layers },
            { id: 'studio', label: 'Upload Studio', icon: ImageIcon, requiresAuth: true },
            { id: 'feed', label: 'Live Stream Feed', icon: MessageSquare },
            { id: 'gallery', label: 'All Badges', icon: Sparkles },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = subTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => handleSubTabClick(tab.id)}
                className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
                  isActive
                    ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{tab.label}</span>
                {tab.requiresAuth && !user && (
                  <Lock className="w-3 h-3 text-amber-400 ml-0.5 opacity-80" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Sub-tab Content Area */}
      <div className="pt-2">
        {subTab === 'banner' && (
          <BannerView
            partyId={partyData.id}
            partyName={partyData.name}
            tapestryTitle={partyData.tapestry_title || `${partyData.name} Tapestry`}
            onNavigateToStudio={() => handleSubTabClick('studio')}
            onOpenReport={onOpenReport}
          />
        )}
        {subTab === 'studio' && (
          <ImageUploader
            partyId={partyData.id}
            partyName={partyData.name}
            onNavigateToBanner={() => setSubTab('banner')}
            onImageUploaded={() => refreshParty()}
          />
        )}
        {subTab === 'feed' && (
          <MessageFeed
            partyId={partyData.id}
            partyName={partyData.name}
            sseConnected={sseConnected}
            onOpenReport={onOpenReport}
          />
        )}
        {subTab === 'gallery' && (
          <GalleryView
            partyId={partyData.id}
            partyName={partyData.name}
            onNavigateToBanner={() => setSubTab('banner')}
            onOpenReport={onOpenReport}
          />
        )}
      </div>

      {/* Lightbox for Party Gallery */}
      {selectedGalleryImage && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-md animate-fade-in"
          onClick={() => setSelectedGalleryImage(null)}
        >
          <div className="relative max-w-3xl w-full bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl p-3">
            <img
              src={selectedGalleryImage}
              alt="Gallery Preview"
              className="w-full h-auto max-h-[80vh] object-contain rounded-2xl"
            />
          </div>
        </div>
      )}
    </div>
  );
}
