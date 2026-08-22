import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  Sparkles,
  User,
  Calendar,
  Download,
  Maximize2,
  RefreshCw,
  X,
  Filter,
  Layers,
  Flag,
  ShieldCheck,
  Ban
} from 'lucide-react';

export default function GalleryView({ partyId = null, partyName = null, onNavigateToBanner, onOpenReport }) {
  const { user, token } = useAuth();

  const [images, setImages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all'); // 'all' | 'my'
  const [selectedImage, setSelectedImage] = useState(null);

  const fetchImages = async () => {
    try {
      setLoading(true);
      const baseUrl = filter === 'my' && user ? '/api/uploads/my' : '/api/uploads';
      const params = new URLSearchParams();
      if (partyId) params.append('party_id', partyId);

      const url = `${baseUrl}${params.toString() ? `?${params.toString()}` : ''}`;
      const headers = token ? { Authorization: `Bearer ${token}` } : {};

      const res = await fetch(url, { headers });
      const data = await res.json();
      setImages(data.images || []);
    } catch (err) {
      console.error('Failed to load gallery images:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchImages();
  }, [filter, user, partyId]);

  return (
    <div className="max-w-6xl mx-auto space-y-8 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900/60 p-6 rounded-2xl border border-slate-800 backdrop-blur-sm">
        <div>
          <div className="flex items-center space-x-2 text-cyan-400 font-semibold text-xs uppercase tracking-wider mb-1">
            <Sparkles className="w-4 h-4" />
            <span>{partyName ? `Gallery • ${partyName}` : 'Community Gallery'}</span>
          </div>
          <h1 className="text-2xl font-extrabold text-slate-100 tracking-tight">
            All Uploaded Badges
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Browse individual badged tiles contributed to {partyName || 'the community space'}.
          </p>
        </div>

        {/* Filter Switcher */}
        <div className="flex items-center space-x-2 bg-slate-900 p-1 rounded-xl border border-slate-800">
          <button
            onClick={() => setFilter('all')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              filter === 'all'
                ? 'bg-cyan-500 text-slate-950 font-bold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            All Badges ({filter === 'all' ? images.length : '•'})
          </button>
          {user && (
            <button
              onClick={() => setFilter('my')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                filter === 'my'
                  ? 'bg-cyan-500 text-slate-950 font-bold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              My Badges ({filter === 'my' ? images.length : '•'})
            </button>
          )}
        </div>
      </div>

      {/* Gallery Grid */}
      {loading ? (
        <div className="h-64 flex flex-col items-center justify-center bg-slate-900/40 border border-slate-800/60 rounded-2xl">
          <RefreshCw className="w-8 h-8 text-cyan-400 animate-spin mb-3" />
          <p className="text-xs text-slate-400">Loading badged gallery...</p>
        </div>
      ) : images.length === 0 ? (
        <div className="p-12 text-center bg-slate-900/40 border border-dashed border-slate-800 rounded-2xl">
          <Sparkles className="w-10 h-10 text-slate-600 mx-auto mb-2" />
          <h3 className="text-base font-bold text-slate-200">No Badges Found</h3>
          <p className="text-xs text-slate-500 mt-1">
            {filter === 'my'
              ? "You haven't uploaded any badged images yet in this space."
              : 'Be the first to upload an image in the Studio!'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
          {images.map((img) => (
            <div
              key={img.id}
              className={`group border rounded-2xl overflow-hidden transition-all shadow-lg flex flex-col ${
                img.status === 'banned'
                  ? 'bg-rose-950/30 border-rose-900/80'
                  : 'bg-slate-900 border-slate-800 hover:border-cyan-500/60'
              }`}
            >
              {/* Image Tile */}
              <div
                className="relative aspect-square bg-slate-950 overflow-hidden cursor-pointer"
                onClick={() => setSelectedImage(img)}
              >
                <img
                  src={img.url}
                  alt={img.user_name}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />

                {/* Status Badges Overlay */}
                <div className="absolute top-2 left-2 flex flex-col gap-1">
                  {img.status === 'blessed' && (
                    <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-md bg-emerald-950/90 text-emerald-300 border border-emerald-700/80 text-[10px] font-bold backdrop-blur-sm">
                      <ShieldCheck className="w-3 h-3 text-emerald-400" />
                      <span>Blessed</span>
                    </span>
                  )}
                  {img.status === 'banned' && (
                    <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-md bg-rose-950/90 text-rose-300 border border-rose-700/80 text-[10px] font-bold backdrop-blur-sm">
                      <Ban className="w-3 h-3 text-rose-400" />
                      <span>BANNED: {img.mod_reason || 'Inappropriate'}</span>
                    </span>
                  )}
                </div>

                <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end justify-between p-3">
                  <span className="text-[11px] font-bold text-white bg-slate-900/80 px-2 py-1 rounded-lg backdrop-blur-sm">
                    Click to inspect
                  </span>
                  <Maximize2 className="w-4 h-4 text-cyan-400" />
                </div>
              </div>

              {/* Card Meta */}
              <div className="p-3.5 flex items-center justify-between border-t border-slate-800/80 bg-slate-900/90">
                <div className="min-w-0 pr-2">
                  <p className="text-xs font-bold text-slate-200 truncate">
                    {img.user_name}
                  </p>
                  <p className="text-[10px] text-slate-500 flex items-center gap-1 mt-0.5">
                    <Calendar className="w-3 h-3" />
                    <span>{new Date(img.created_at || Date.now()).toLocaleDateString()}</span>
                  </p>
                </div>

                <div className="flex items-center space-x-1">
                  {/* Report action */}
                  {user && (user.is_super_admin === 1 || user.is_super_admin === true || user.role === 'Super Admin' || (user.id !== img.user_id && img.status !== 'blessed')) && (
                    <button
                      onClick={() =>
                        onOpenReport &&
                        onOpenReport(
                          {
                            type: 'image',
                            id: img.id,
                            preview: `Image by ${img.user_name}`,
                            author: img.user_name
                          },
                          (reportedEntity) => {
                            setImages((prev) => prev.filter((i) => i.id !== reportedEntity.id));
                          }
                        )
                      }
                      className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-slate-800 rounded-lg transition-colors"
                      title="Report Image"
                    >
                      <Flag className="w-3.5 h-3.5" />
                    </button>
                  )}

                  <a
                    href={img.url}
                    download={img.processed_filename}
                    className="p-1.5 text-slate-400 hover:text-cyan-400 hover:bg-slate-800 rounded-lg transition-colors"
                    title="Download Tile"
                  >
                    <Download className="w-3.5 h-3.5" />
                  </a>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Inspect Modal */}
      {selectedImage && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-fade-in"
          onClick={() => setSelectedImage(null)}
        >
          <div
            className="relative max-w-lg w-full bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl p-4 sm:p-6 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center space-x-2.5">
                <div className="p-2 rounded-xl bg-cyan-500/10 text-cyan-400">
                  <User className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-100">{selectedImage.user_name}</h3>
                  <p className="text-[10px] text-slate-400">Processed Name Badge Tile</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedImage(null)}
                className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="rounded-xl overflow-hidden border border-slate-800 bg-slate-950">
              <img
                src={selectedImage.url}
                alt={selectedImage.user_name}
                className="w-full h-auto object-cover max-h-[450px]"
              />
            </div>

            <div className="flex items-center justify-between pt-2">
              <span className="text-xs text-slate-400">
                Created on {new Date(selectedImage.created_at || Date.now()).toLocaleDateString()}
              </span>

              <div className="flex items-center space-x-2">
                {user && (user.is_super_admin === 1 || user.is_super_admin === true || user.role === 'Super Admin' || (user.id !== selectedImage.user_id && selectedImage.status !== 'blessed')) && (
                  <button
                    type="button"
                    onClick={() => {
                      onOpenReport &&
                        onOpenReport(
                          {
                            type: 'image',
                            id: selectedImage.id,
                            preview: `Image by ${selectedImage.user_name}`,
                            author: selectedImage.user_name
                          },
                          (reportedEntity) => {
                            setImages((prev) => prev.filter((i) => i.id !== reportedEntity.id));
                            setSelectedImage(null);
                          }
                        );
                    }}
                    className="px-3 py-2 bg-rose-950/80 hover:bg-rose-900 text-rose-300 border border-rose-800/80 text-xs font-bold rounded-xl flex items-center space-x-1.5 transition-colors"
                  >
                    <Flag className="w-3.5 h-3.5 text-rose-400" />
                    <span>Report Image</span>
                  </button>
                )}

                <a
                  href={selectedImage.url}
                  download={selectedImage.processed_filename}
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
