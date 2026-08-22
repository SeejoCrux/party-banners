import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  Layers,
  RefreshCw,
  Download,
  SlidersHorizontal,
  Maximize2,
  Calendar,
  Grid,
  Sparkles,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  Lock,
  Zap,
  Flag,
  User,
  ShieldCheck,
  X
} from 'lucide-react';

// Configuration property for Automatic Banner Regeneration
export const AUTO_REGENERATE_BANNER = true;

export default function BannerView({ partyId, partyName, tapestryTitle, onNavigateToStudio, onOpenReport }) {
  const { user, openAuthModal, token } = useAuth();

  const [banner, setBanner] = useState(null);
  const [tiles, setTiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);
  const [selectedTile, setSelectedTile] = useState(null);

  // Generation options
  const [showConfig, setShowConfig] = useState(false);
  const [columns, setColumns] = useState('0'); // 0 for auto
  const [imageLimit, setImageLimit] = useState(24);

  const effectiveTitle = tapestryTitle || (partyName ? `${partyName} Tapestry` : 'Party Tapestry');

  const fetchLatestBanner = async () => {
    if (!partyId) return;
    try {
      setLoading(true);
      setError(null);
      const url = `/api/banner/latest?party_id=${partyId}`;
      const res = await fetch(url);
      const data = await res.json();
      setBanner(data.banner);

      // Also fetch constituent tiles that compose the tapestry
      const tilesRes = await fetch(`/api/uploads?party_id=${partyId}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      const tilesData = await tilesRes.json();
      setTiles(tilesData.images || []);
    } catch (err) {
      console.error('Failed to fetch banner or tiles:', err);
      setError('Could not load current party tapestry.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLatestBanner();
  }, [partyId, partyName, tapestryTitle]);

  // Listen to live SSE moderation events to update tiles & banner in real-time
  useEffect(() => {
    const handleModEvent = (e) => {
      const { type, payload } = e.detail || {};
      if ((type === 'content_reported' || type === 'content_reviewed') && payload?.entityType === 'image') {
        fetchLatestBanner();
      }
    };
    window.addEventListener('tapestry_moderation_event', handleModEvent);
    return () => window.removeEventListener('tapestry_moderation_event', handleModEvent);
  }, [partyId]);

  const handleGenerateBanner = async () => {
    if (!user) {
      openAuthModal();
      return;
    }

    try {
      setGenerating(true);
      setError(null);
      setSuccessMsg(null);

      const res = await fetch('/api/banner/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          title: effectiveTitle,
          columns: columns === '0' ? undefined : parseInt(columns, 10),
          limit: imageLimit,
          party_id: partyId
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to generate tapestry');
      }

      setBanner(data.banner);
      setSuccessMsg('✨ Tapestry regenerated successfully with Sharp!');
      fetchLatestBanner();
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err) {
      setError(err.message || 'Generation failed');
    } finally {
      setGenerating(false);
    }
  };

  const handleStudioNavigation = () => {
    if (!user) {
      openAuthModal();
      return;
    }
    if (onNavigateToStudio) {
      onNavigateToStudio();
    }
  };

  const handleReportTile = (tile) => {
    if (!user) {
      openAuthModal();
      return;
    }
    if (onOpenReport) {
      onOpenReport(
        {
          type: 'image',
          id: tile.id,
          preview: tile.original_filename || `Badge tile by ${tile.user_name}`,
          author: tile.user_name
        },
        (reportedEntity) => {
          setTiles((prev) => prev.filter((t) => t.id !== reportedEntity.id));
          fetchLatestBanner();
          if (selectedTile && selectedTile.id === reportedEntity.id) {
            setSelectedTile(null);
          }
        }
      );
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8 animate-fade-in">
      {/* Banner Top Hero Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900/60 p-6 rounded-2xl border border-slate-800 backdrop-blur-sm">
        <div>
          <div className="flex items-center space-x-2 text-cyan-400 font-semibold text-xs uppercase tracking-wider mb-1">
            <Layers className="w-4 h-4" />
            <span>Party Mosaic Tapestry</span>
            {AUTO_REGENERATE_BANNER && (
              <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-md bg-cyan-950 text-cyan-300 border border-cyan-800/60 text-[10px] font-bold">
                <Zap className="w-3 h-3 text-cyan-400" />
                <span>Auto-Stitch Active</span>
              </span>
            )}
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-100 tracking-tight">
            {effectiveTitle}
          </h1>
          <p className="text-sm text-slate-400 mt-1 max-w-xl">
            {AUTO_REGENERATE_BANNER
              ? 'Photos uploaded to this Party are automatically stitched into the tapestry with Sharp. You can inspect or report any individual tile below.'
              : 'Uploaded images are stitched server-side with Sharp into a high-resolution mosaic banner.'}
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex items-center flex-wrap gap-2.5">
          <button
            onClick={() => setShowConfig(!showConfig)}
            className={`px-3.5 py-2.5 rounded-xl border text-xs font-semibold flex items-center space-x-2 transition-all ${
              showConfig
                ? 'bg-cyan-950/80 text-cyan-300 border-cyan-700/60'
                : 'bg-slate-800/80 text-slate-300 border-slate-700/70 hover:bg-slate-800'
            }`}
          >
            <SlidersHorizontal className="w-4 h-4" />
            <span>Layout Options</span>
          </button>

          {/* If AUTO_REGENERATE_BANNER is false, render manual Regenerate button */}
          {!AUTO_REGENERATE_BANNER && (
            user ? (
              <button
                onClick={handleGenerateBanner}
                disabled={generating}
                className="px-4 py-2.5 bg-gradient-to-r from-cyan-500 via-sky-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-lg shadow-cyan-500/25 flex items-center space-x-2 transition-all"
              >
                <RefreshCw className={`w-4 h-4 ${generating ? 'animate-spin' : ''}`} />
                <span>{generating ? 'Stitching Tapestry...' : 'Regenerate Tapestry'}</span>
              </button>
            ) : (
              <button
                onClick={openAuthModal}
                className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 rounded-xl text-xs font-bold flex items-center space-x-2 transition-all shadow-md"
                title="Sign in to regenerate tapestry"
              >
                <Lock className="w-4 h-4 text-amber-400" />
                <span>Sign In to Regenerate</span>
              </button>
            )
          )}
        </div>
      </div>

      {/* Config Drawer */}
      {showConfig && (
        <div className="bg-slate-900/90 border border-cyan-800/40 rounded-2xl p-5 animate-slide-down shadow-xl grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center justify-between">
              <span>Tapestry Title</span>
              <span className="text-[10px] text-cyan-400 font-bold uppercase tracking-wider">Admin Decided</span>
            </label>
            <div className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 font-semibold truncate flex items-center justify-between">
              <span className="truncate">{effectiveTitle}</span>
              <Lock className="w-3.5 h-3.5 text-slate-500 flex-shrink-0 ml-2" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">Grid Columns</label>
            <select
              value={columns}
              onChange={(e) => setColumns(e.target.value)}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 focus:border-cyan-500 focus:outline-none"
            >
              <option value="0">Auto-Calculate (Balanced)</option>
              <option value="2">2 Columns (Duo)</option>
              <option value="3">3 Columns (Standard)</option>
              <option value="4">4 Columns (Wide)</option>
              <option value="5">5 Columns (Panoramic)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">Image Limit</label>
            <select
              value={imageLimit}
              onChange={(e) => setImageLimit(parseInt(e.target.value, 10))}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 focus:border-cyan-500 focus:outline-none"
            >
              <option value="12">Recent 12 Images</option>
              <option value="24">Recent 24 Images</option>
              <option value="48">Recent 48 Images</option>
              <option value="100">All Images (Up to 100)</option>
            </select>
          </div>
        </div>
      )}

      {/* Notifications */}
      {successMsg && (
        <div className="flex items-center space-x-2 p-3.5 bg-emerald-950/60 border border-emerald-800/60 rounded-xl text-emerald-300 text-xs animate-slide-down">
          <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {error && (
        <div className="flex items-center space-x-2 p-3.5 bg-rose-950/60 border border-rose-800/60 rounded-xl text-rose-300 text-xs animate-slide-down">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Banner Showcase Viewport */}
      {loading ? (
        <div className="h-96 flex flex-col items-center justify-center bg-slate-900/40 border border-slate-800/60 rounded-2xl">
          <RefreshCw className="w-8 h-8 text-cyan-400 animate-spin mb-3" />
          <p className="text-xs text-slate-400">Loading stitched tapestry...</p>
        </div>
      ) : banner ? (
        <div className="space-y-6">
          <div className="relative group bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl">
            {/* Banner Metadata Badge Top Right */}
            <div className="absolute top-4 right-4 z-10 flex items-center space-x-2 bg-slate-950/80 backdrop-blur-md px-3 py-1.5 rounded-xl border border-slate-800 text-[11px] text-slate-300 shadow-md">
              <span className="flex items-center space-x-1">
                <Grid className="w-3.5 h-3.5 text-cyan-400" />
                <span>{banner.grid_layout || 'Grid'}</span>
              </span>
              <span className="text-slate-600">•</span>
              <span className="flex items-center space-x-1">
                <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                <span>{banner.image_count} Tiles</span>
              </span>
            </div>

            {/* Rendered Stitched Banner Image */}
            <div className="overflow-x-auto flex justify-center p-2 sm:p-4 bg-slate-950/40">
              <img
                src={banner.url}
                alt={banner.title || effectiveTitle}
                className="max-h-[650px] w-auto object-contain rounded-xl shadow-2xl transition-transform duration-300"
              />
            </div>

            {/* Bottom Bar Controls */}
            <div className="p-4 bg-slate-900/90 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center space-x-2 text-xs text-slate-400">
                <Calendar className="w-3.5 h-3.5" />
                <span>
                  Generated on {new Date(banner.created_at || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • {banner.title || effectiveTitle}
                </span>
              </div>

              <div className="flex items-center space-x-2">
                <a
                  href={banner.url}
                  download={banner.filename}
                  className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-cyan-300 hover:text-cyan-200 border border-slate-700 rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition-colors shadow-sm"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download High-Res PNG</span>
                </a>
                <a
                  href={banner.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-semibold flex items-center space-x-1 transition-colors"
                >
                  <Maximize2 className="w-3.5 h-3.5" />
                  <span>View Raw</span>
                </a>
              </div>
            </div>
          </div>

          {/* Constituent Tiles & Interactive Inspection Grid */}
          <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-cyan-400" />
                  <span>Constituent Tapestry Tiles ({tiles.length})</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Inspect any individual tile or report inappropriate content before/after it is stitched into the tapestry.
                </p>
              </div>

              <button
                onClick={handleStudioNavigation}
                className="px-3.5 py-1.5 bg-cyan-500/10 hover:bg-cyan-500 hover:text-slate-950 text-cyan-300 border border-cyan-500/30 rounded-xl text-xs font-bold transition-all self-start sm:self-auto flex items-center space-x-1.5"
              >
                <span>+ Upload Your Badge</span>
              </button>
            </div>

            {tiles.length === 0 ? (
              <p className="text-xs text-slate-500 italic py-4 text-center">No active tiles uploaded yet.</p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 pt-2">
                {tiles.map((tile) => (
                  <div
                    key={tile.id}
                    className="group relative bg-slate-950 border border-slate-800 hover:border-cyan-500/60 rounded-xl overflow-hidden shadow-md transition-all flex flex-col"
                  >
                    {/* Thumbnail & Quick Actions Overlay */}
                    <div className="relative aspect-square w-full bg-slate-900 overflow-hidden cursor-pointer" onClick={() => setSelectedTile(tile)}>
                      <img
                        src={tile.url}
                        alt={tile.user_name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                      />

                      {/* Status Badges */}
                      {tile.status === 'blessed' && (
                        <span className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded bg-emerald-950/90 text-emerald-300 border border-emerald-800 text-[9px] font-bold flex items-center gap-1 shadow">
                          <ShieldCheck className="w-2.5 h-2.5 text-emerald-400" />
                          <span>Blessed</span>
                        </span>
                      )}

                      <div className="absolute inset-0 bg-slate-950/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center space-x-1.5">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedTile(tile);
                          }}
                          className="p-1.5 bg-slate-900/90 hover:bg-slate-800 text-slate-200 rounded-lg shadow"
                          title="Inspect Tile"
                        >
                          <Maximize2 className="w-3.5 h-3.5" />
                        </button>
                        {(!user || user.is_super_admin === 1 || user.is_super_admin === true || user.role === 'Super Admin' || (user.id !== tile.user_id && tile.status !== 'blessed')) && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleReportTile(tile);
                            }}
                            className="p-1.5 bg-rose-950/90 hover:bg-rose-900 text-rose-300 border border-rose-800/80 rounded-lg shadow"
                            title="Report this tile as inappropriate"
                          >
                            <Flag className="w-3.5 h-3.5 text-rose-400" />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Meta Footer */}
                    <div className="p-2 bg-slate-950 flex items-center justify-between border-t border-slate-800/80 text-[10px]">
                      <div className="min-w-0 pr-1">
                        <p className="font-bold text-slate-200 truncate">{tile.user_name}</p>
                        <p className="text-slate-500">{new Date(tile.created_at || Date.now()).toLocaleDateString()}</p>
                      </div>

                      {(!user || user.is_super_admin === 1 || user.is_super_admin === true || user.role === 'Super Admin' || (user.id !== tile.user_id && tile.status !== 'blessed')) && (
                        <button
                          type="button"
                          onClick={() => handleReportTile(tile)}
                          className="p-1 text-slate-400 hover:text-rose-400 hover:bg-slate-900 rounded transition-colors"
                          title="Report Tile"
                        >
                          <Flag className="w-3 h-3 text-rose-400" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : (
        /* Empty State */
        <div className="p-12 text-center bg-slate-900/40 border border-dashed border-slate-800 rounded-2xl space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 flex items-center justify-center mx-auto">
            <Layers className="w-8 h-8" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-100">No Tapestry Generated Yet</h3>
            <p className="text-xs text-slate-400 max-w-md mx-auto mt-1">
              Upload a photo badge in the Upload Studio to stitch the inaugural mosaic for {partyName || 'this Party'}.
            </p>
          </div>
          <button
            onClick={handleStudioNavigation}
            className="inline-flex items-center space-x-2 px-4 py-2.5 bg-gradient-to-r from-cyan-500 to-indigo-600 text-white text-xs font-bold rounded-xl shadow-lg shadow-cyan-500/20 transition-all hover:scale-105"
          >
            {!user && <Lock className="w-4 h-4 text-amber-300" />}
            <span>{user ? 'Go to Upload Studio' : 'Sign In to Upload'}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Inspect Modal for Individual Tile */}
      {selectedTile && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-fade-in"
          onClick={() => setSelectedTile(null)}
        >
          <div
            className="relative max-w-lg w-full bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl p-5 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center space-x-2.5">
                <div className="p-2 rounded-xl bg-cyan-500/10 text-cyan-400">
                  <User className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-100">{selectedTile.user_name}</h3>
                  <p className="text-[10px] text-slate-400">Tapestry Badge Tile</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedTile(null)}
                className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="rounded-xl overflow-hidden border border-slate-800 bg-slate-950">
              <img
                src={selectedTile.url}
                alt={selectedTile.user_name}
                className="w-full h-auto object-cover max-h-[450px]"
              />
            </div>

            <div className="flex items-center justify-between pt-2">
              <span className="text-xs text-slate-400">
                Uploaded on {new Date(selectedTile.created_at || Date.now()).toLocaleDateString()}
              </span>

              <div className="flex items-center space-x-2">
                {(!user || user.is_super_admin === 1 || user.is_super_admin === true || user.role === 'Super Admin' || (user.id !== selectedTile.user_id && selectedTile.status !== 'blessed')) && (
                  <button
                    type="button"
                    onClick={() => handleReportTile(selectedTile)}
                    className="px-3 py-2 bg-rose-950/80 hover:bg-rose-900 text-rose-300 border border-rose-800/80 text-xs font-bold rounded-xl flex items-center space-x-1.5 transition-colors"
                  >
                    <Flag className="w-3.5 h-3.5 text-rose-400" />
                    <span>Report Tile</span>
                  </button>
                )}

                <a
                  href={selectedTile.url}
                  download={selectedTile.processed_filename}
                  className="px-3.5 py-2 bg-gradient-to-r from-cyan-500 to-indigo-600 text-white text-xs font-bold rounded-xl shadow-md flex items-center space-x-1.5"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download Tile</span>
                </a>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
