import React, { useState, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  UploadCloud,
  Image as ImageIcon,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Palette,
  ArrowRight,
  ShieldAlert,
  Layers,
  Lock,
  LogIn
} from 'lucide-react';

const STARTER_PRESETS = [
  { name: 'Aurora Nights', url: 'https://images.unsplash.com/photo-1579033461380-adb47c3eb938?auto=format&fit=crop&w=600&q=80' },
  { name: 'Cyber Neon', url: 'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?auto=format&fit=crop&w=600&q=80' },
  { name: 'Retro Sunset', url: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=600&q=80' },
  { name: 'Cosmic Nebula', url: 'https://images.unsplash.com/photo-1462331940025-496dfbfc7564?auto=format&fit=crop&w=600&q=80' },
];

export default function ImageUploader({ partyId = null, partyName = null, onImageUploaded, onNavigateToBanner }) {
  const { user, token, openAuthModal } = useAuth();

  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [customDisplayName, setCustomDisplayName] = useState('');
  const [uploading, setUploading] = useState(false);
  const [successData, setSuccessData] = useState(null);
  const [error, setError] = useState(null);
  const [dragActive, setDragActive] = useState(false);

  const fileInputRef = useRef(null);

  const handleFileChange = (file) => {
    if (!user) {
      openAuthModal();
      return;
    }
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError('Please choose a valid image file (PNG, JPEG, WebP).');
      return;
    }
    setError(null);
    setSelectedFile(file);
    const objectUrl = URL.createObjectURL(file);
    setPreviewUrl(objectUrl);
  };

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (!user) {
      openAuthModal();
      return;
    }
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileChange(e.dataTransfer.files[0]);
    }
  };

  const handlePresetSelect = async (preset) => {
    if (!user) {
      openAuthModal();
      return;
    }
    try {
      setError(null);
      const res = await fetch(preset.url);
      const blob = await res.blob();
      const file = new File([blob], `${preset.name.toLowerCase().replace(/\s+/g, '-')}.jpg`, { type: 'image/jpeg' });
      handleFileChange(file);
    } catch (err) {
      console.error('Failed to load preset:', err);
      setError('Could not load preset image.');
    }
  };

  const handleUpload = async () => {
    if (!user) {
      openAuthModal();
      return;
    }
    if (!selectedFile) {
      setError('Please choose an image to upload.');
      return;
    }

    try {
      setUploading(true);
      setError(null);

      const formData = new FormData();
      formData.append('image', selectedFile);
      if (customDisplayName.trim()) {
        formData.append('displayName', customDisplayName.trim());
      }
      if (partyId) {
        formData.append('party_id', partyId);
      }

      const res = await fetch('/api/uploads', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`
        },
        body: formData
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Upload failed');
      }

      setSuccessData(data.image);
      if (onImageUploaded) {
        onImageUploaded(data.image);
      }
    } catch (err) {
      setError(err.message || 'Failed to upload image.');
    } finally {
      setUploading(false);
    }
  };

  const resetUpload = () => {
    setSelectedFile(null);
    setPreviewUrl(null);
    setSuccessData(null);
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const currentBadgeName = customDisplayName.trim() || user?.name || 'Your Name Here';

  // If user is not authenticated, render locked access card
  if (!user) {
    return (
      <div className="max-w-3xl mx-auto space-y-6 animate-fade-in py-8">
        <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-8 sm:p-12 text-center space-y-6 shadow-2xl">
          <div className="w-16 h-16 rounded-2xl bg-amber-500/10 text-amber-400 border border-amber-500/30 flex items-center justify-center mx-auto shadow-lg">
            <Lock className="w-8 h-8" />
          </div>

          <div className="space-y-2 max-w-md mx-auto">
            <h2 className="text-2xl font-extrabold text-slate-100">Authentication Required</h2>
            <p className="text-sm text-slate-400 leading-relaxed">
              Image Studio is reserved for registered users. Sign in to upload photos, personalize your name badge, and contribute to{' '}
              <strong className="text-cyan-300">{partyName || 'the community tapestry'}</strong>.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
            <button
              onClick={openAuthModal}
              className="w-full sm:w-auto px-6 py-3 bg-gradient-to-r from-cyan-500 via-sky-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-white font-extrabold text-xs rounded-xl shadow-lg shadow-cyan-500/25 flex items-center justify-center space-x-2 transition-all hover:scale-105"
            >
              <LogIn className="w-4 h-4" />
              <span>Sign In to Access Studio</span>
            </button>

            {onNavigateToBanner && (
              <button
                onClick={onNavigateToBanner}
                className="w-full sm:w-auto px-5 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl border border-slate-700 transition-colors"
              >
                View Tapestry Instead
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-fade-in">
      {/* Studio Header */}
      <div className="bg-slate-900/60 p-6 rounded-2xl border border-slate-800 backdrop-blur-sm">
        <div className="flex items-center space-x-2 text-cyan-400 font-semibold text-xs uppercase tracking-wider mb-1">
          <ImageIcon className="w-4 h-4" />
          <span>{partyName ? `Image Studio • ${partyName}` : 'Image Studio'}</span>
        </div>
        <h1 className="text-2xl font-extrabold text-slate-100 tracking-tight">
          Upload Image with Name Badge
        </h1>
        <p className="text-sm text-slate-400 mt-1">
          Upload any photo. Sharp will automatically brand it with your personalized name overlay badge and associate it with{' '}
          <strong className="text-cyan-300">{partyName || 'the community space'}</strong>.
        </p>
      </div>

      {error && (
        <div className="flex items-center space-x-2 p-3.5 bg-rose-950/60 border border-rose-800/60 rounded-xl text-rose-300 text-xs animate-slide-down">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Success View */}
      {successData ? (
        <div className="bg-slate-900 border border-emerald-800/60 rounded-2xl p-6 sm:p-8 text-center space-y-6 shadow-2xl animate-slide-down">
          <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-7 h-7" />
          </div>

          <div>
            <h3 className="text-xl font-bold text-slate-100">Image Successfully Uploaded & Badged!</h3>
            <p className="text-xs text-slate-400 mt-1">
              Your name badge was rendered directly into the pixels using Sharp.
            </p>
          </div>

          <div className="max-w-xs mx-auto overflow-hidden rounded-2xl border border-slate-700 shadow-2xl">
            <img
              src={successData.url}
              alt="Processed"
              className="w-full h-auto object-cover"
            />
          </div>

          <div className="flex items-center justify-center space-x-3">
            <button
              onClick={resetUpload}
              className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl border border-slate-700 transition-colors"
            >
              Upload Another
            </button>
            <button
              onClick={onNavigateToBanner}
              className="px-4 py-2.5 bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-cyan-500/25 flex items-center space-x-1.5 transition-all"
            >
              <span>View In Tapestry</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      ) : (
        /* Upload & Preview Workspace */
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Left: Drag & Drop Zone */}
          <div className="space-y-4">
            <div
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`relative border-2 border-dashed rounded-2xl p-8 flex flex-col items-center justify-center text-center cursor-pointer transition-all min-h-[260px] ${
                dragActive
                  ? 'border-cyan-400 bg-cyan-950/20'
                  : 'border-slate-800 hover:border-slate-700 bg-slate-900/40 hover:bg-slate-900/60'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={(e) => e.target.files && handleFileChange(e.target.files[0])}
                className="hidden"
              />

              <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 flex items-center justify-center mb-3">
                <UploadCloud className="w-6 h-6" />
              </div>
              <p className="text-sm font-bold text-slate-200">
                Click to browse or drag & drop image
              </p>
              <p className="text-[11px] text-slate-500 mt-1">
                PNG, JPEG, WebP up to 10MB
              </p>
            </div>

            {/* Quick Starters */}
            <div>
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5 mb-2.5">
                <Palette className="w-3.5 h-3.5 text-cyan-400" />
                Or Try Sample Images
              </span>
              <div className="grid grid-cols-4 gap-2">
                {STARTER_PRESETS.map((preset) => (
                  <button
                    key={preset.name}
                    onClick={() => handlePresetSelect(preset)}
                    className="relative rounded-xl overflow-hidden border border-slate-800 hover:border-cyan-500 group text-left transition-all"
                  >
                    <img
                      src={preset.url}
                      alt={preset.name}
                      className="w-full h-14 object-cover group-hover:scale-110 transition-transform"
                    />
                    <div className="absolute inset-0 bg-slate-950/60 flex items-end p-1">
                      <span className="text-[9px] font-semibold text-slate-200 truncate">
                        {preset.name}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Right: Live Interactive Name Badge Preview */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 flex flex-col justify-between space-y-4">
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold text-slate-300 flex items-center space-x-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Live Tile Preview</span>
                </span>
                <span className="text-[10px] text-slate-500">600 × 600 px Tile</span>
              </div>

              {/* Name input customization */}
              <div className="mb-4">
                <label className="block text-[11px] font-medium text-slate-400 mb-1">
                  Name on Badge:
                </label>
                <input
                  type="text"
                  placeholder={user?.name || 'Enter display name'}
                  value={customDisplayName}
                  onChange={(e) => setCustomDisplayName(e.target.value)}
                  className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
                />
              </div>

              {/* Preview Box with live name badge simulation */}
              <div className="relative aspect-square max-w-[280px] mx-auto rounded-xl overflow-hidden border border-slate-700 bg-slate-950 shadow-xl">
                {previewUrl ? (
                  <img
                    src={previewUrl}
                    alt="Preview"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center text-slate-600 p-4 text-center">
                    <ImageIcon className="w-10 h-10 mb-2 opacity-50" />
                    <p className="text-xs">Select or drop an image to preview badge</p>
                  </div>
                )}

                {/* Simulated SVG Name Badge Overlay */}
                <div className="absolute inset-x-0 bottom-0 pt-8 pb-3 px-3 bg-gradient-to-t from-slate-950 via-slate-950/80 to-transparent">
                  <div className="flex items-center space-x-2 bg-slate-900/90 border border-slate-700/80 px-2.5 py-1 rounded-lg w-fit max-w-[90%] shadow-lg">
                    <div className="w-2 h-2 rounded-full bg-cyan-400 flex-shrink-0 animate-pulse" />
                    <span className="text-xs font-bold text-slate-100 truncate">
                      {currentBadgeName}
                    </span>
                  </div>
                  <div className="h-1 w-full bg-cyan-400 mt-2 rounded-full" />
                </div>
              </div>
            </div>

            {/* Upload Button */}
            <button
              onClick={handleUpload}
              disabled={uploading || !selectedFile}
              className="w-full py-3 bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-xs rounded-xl shadow-lg shadow-cyan-500/20 flex items-center justify-center space-x-2 transition-all"
            >
              {uploading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Processing & Overlaying Name...</span>
                </>
              ) : (
                <>
                  <UploadCloud className="w-4 h-4" />
                  <span>Upload & Burn Badge</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
