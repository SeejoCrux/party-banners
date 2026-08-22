import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  ShieldAlert,
  ShieldCheck,
  PlusCircle,
  Edit,
  Trash2,
  CheckCircle2,
  XCircle,
  AlertCircle,
  RefreshCw,
  MessageSquare,
  Image as ImageIcon,
  Flag,
  Globe,
  Tag,
  Clock,
  User,
  Users,
  SlidersHorizontal,
  X,
  UploadCloud,
  ExternalLink,
  Layers,
  Sparkles,
  ArrowRight,
  Eye,
  Crown,
  KeyRound,
  Ban,
  UserX,
  UserCheck,
  UserPlus,
  UserMinus,
  ChevronLeft,
  ChevronRight,
  Search,
  Filter,
  ArrowUpCircle,
  ArrowDownCircle,
  AlertTriangle,
  Heart,
  Award,
  ShieldX
} from 'lucide-react';

const HERO_PRESETS = [
  { name: 'Cyber Neon Gala', url: 'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?auto=format&fit=crop&w=1200&q=80' },
  { name: 'AI Future Summit', url: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=1200&q=80' },
  { name: 'Indie Game Jam', url: 'https://images.unsplash.com/photo-1550745165-9bc0b252726f?auto=format&fit=crop&w=1200&q=80' },
  { name: 'Digital Art Festival', url: 'https://images.unsplash.com/photo-1579033461380-adb47c3eb938?auto=format&fit=crop&w=1200&q=80' },
];

export default function AdminDashboard({ onSelectParty, onPartyUpdated }) {
  const { user, token, isAdmin, isSuperAdmin, loginWithDev } = useAuth();

  const [activeAdminTab, setActiveAdminTab] = useState('parties'); // 'parties' | 'users' | 'promotion' | 'moderation'
  const [parties, setParties] = useState([]);
  const [reportedParties, setReportedParties] = useState([]);
  const [reportedImages, setReportedImages] = useState([]);
  const [reportedMessages, setReportedMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [uploadingHero, setUploadingHero] = useState(false);
  const [uploadingGallery, setUploadingGallery] = useState(false);
  const [feedback, setFeedback] = useState(null);

  // Search in Registry
  const [registrySearch, setRegistrySearch] = useState('');

  // User Dashboard / Promotion State
  const [usersList, setUsersList] = useState([]);
  const [userTotal, setUserTotal] = useState(0);
  const [userPage, setUserPage] = useState(1);
  const [userTotalPages, setUserTotalPages] = useState(1);
  const [userSearch, setUserSearch] = useState('');
  const [userFilter, setUserFilter] = useState('all'); // 'all' | 'fan' | 'admin' | 'super_admin' | 'honor_good' | 'honor_poor' | 'honor_bad' | 'active' | 'banned' | 'flagged'
  const [userSort, setUserSort] = useState('newest'); // 'newest' | 'violations' | 'images' | 'messages' | 'honor' | 'name'
  const [usersLoading, setUsersLoading] = useState(false);

  // Ban/Unban Confirmation Modal
  const [banModal, setBanModal] = useState({
    isOpen: false,
    user: null,
    action: 'ban' // 'ban' | 'unban'
  });

  // Report Party Confirmation Modal
  const [reportPartyModal, setReportPartyModal] = useState({
    isOpen: false,
    party: null,
    reason: 'Violates community guidelines'
  });

  // Party Form State
  const [isPartyModalOpen, setIsPartyModalOpen] = useState(false);
  const [editingParty, setEditingParty] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    slug: '',
    hero_image: '',
    tapestry_title: '',
    description: '',
    tags: 'Tech, AI, Innovation',
    gallery_images: [],
    website: '',
    twitter: '',
    bluesky: '',
    instagram: '',
    github: ''
  });

  const heroFileInputRef = useRef(null);
  const galleryFileInputRef = useRef(null);

  // Moderation Review State Modal
  const [reviewModal, setReviewModal] = useState({
    isOpen: false,
    item: null,
    type: 'image', // 'party' | 'image' | 'message'
    action: 'agree',
    reason: ''
  });

  const loadData = async () => {
    try {
      setLoading(true);
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const partiesRes = await fetch('/api/parties?limit=100&includeReported=true', { headers });
      const partiesData = await partiesRes.json();
      setParties(partiesData.parties || []);

      if (isAdmin && token) {
        const modRes = await fetch('/api/moderation/queue', {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (modRes.ok) {
          const modData = await modRes.json();
          setReportedParties(modData.reportedParties || []);
          setReportedImages(modData.reportedImages || []);
          setReportedMessages(modData.reportedMessages || []);
        }

        // Also load users summary
        fetchUsers();
      }
    } catch (err) {
      console.error('Failed to load registry data:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchUsers = async () => {
    if (!isAdmin || !token) return;
    try {
      setUsersLoading(true);
      const params = new URLSearchParams({
        page: userPage,
        limit: 10,
        filter: userFilter,
        sort: userSort
      });
      if (userSearch.trim()) params.append('search', userSearch.trim());

      const res = await fetch(`/api/users?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) {
        setUsersList(data.users || []);
        setUserTotal(data.total || 0);
        setUserTotalPages(data.totalPages || 1);
      }
    } catch (err) {
      console.error('Failed to fetch users:', err);
    } finally {
      setUsersLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [isAdmin, token]);

  useEffect(() => {
    if (activeAdminTab === 'users' || activeAdminTab === 'promotion') {
      fetchUsers();
    }
  }, [activeAdminTab, userPage, userFilter, userSort]);

  const handleUserSearchSubmit = (e) => {
    if (e) e.preventDefault();
    setUserPage(1);
    fetchUsers();
  };

  const handleInstantAdminUnlock = async () => {
    try {
      setActionLoading(true);
      await loginWithDev(
        'Seejo Crux',
        'seejo.crux@gmail.com',
        'https://api.dicebear.com/7.x/adventurer/svg?seed=SeejoCrux',
        true
      );
      setFeedback({ type: 'success', text: '⚡ Super Admin access unlocked for Seejo Crux! You have full administrative privileges.' });
    } catch (err) {
      setFeedback({ type: 'error', text: err.message });
    } finally {
      setActionLoading(false);
    }
  };

  const handleOpenPartyModal = (party = null) => {
    if (!isAdmin) {
      handleInstantAdminUnlock();
      return;
    }
    if (party) {
      setEditingParty(party);
      setFormData({
        name: party.name || '',
        slug: party.slug || '',
        hero_image: party.hero_image || '',
        tapestry_title: party.tapestry_title || (party.name ? `${party.name} Tapestry` : ''),
        description: party.description || '',
        tags: (party.tags || []).join(', '),
        gallery_images: Array.isArray(party.gallery_images) ? party.gallery_images : [],
        website: party.social_links?.website || '',
        twitter: party.social_links?.twitter || '',
        bluesky: party.social_links?.bluesky || party.social_links?.discord || '',
        instagram: party.social_links?.instagram || '',
        github: party.social_links?.github || ''
      });
    } else {
      setEditingParty(null);
      setFormData({
        name: '',
        slug: '',
        hero_image: HERO_PRESETS[0].url,
        tapestry_title: '',
        description: '',
        tags: 'Tech, Art, Music',
        gallery_images: [],
        website: '',
        twitter: '',
        bluesky: '',
        instagram: '',
        github: ''
      });
    }
    setIsPartyModalOpen(true);
  };

  // Upload hero file to server
  const handleHeroFileUpload = async (file) => {
    if (!file) return;
    try {
      setUploadingHero(true);
      const data = new FormData();
      data.append('file', file);

      const res = await fetch('/api/parties/upload-asset', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: data
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to upload hero image');

      setFormData((prev) => ({ ...prev, hero_image: json.url }));
    } catch (err) {
      setFeedback({ type: 'error', text: 'Hero upload error: ' + err.message });
    } finally {
      setUploadingHero(false);
    }
  };

  // Upload gallery files to server
  const handleGalleryFilesUpload = async (fileList) => {
    if (!fileList || fileList.length === 0) return;
    try {
      setUploadingGallery(true);
      const uploadedUrls = [];

      for (let i = 0; i < fileList.length; i++) {
        const file = fileList[i];
        const data = new FormData();
        data.append('file', file);

        const res = await fetch('/api/parties/upload-asset', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: data
        });

        const json = await res.json();
        if (res.ok && json.url) {
          uploadedUrls.push(json.url);
        }
      }

      setFormData((prev) => ({
        ...prev,
        gallery_images: [...prev.gallery_images, ...uploadedUrls]
      }));
    } catch (err) {
      setFeedback({ type: 'error', text: 'Gallery upload error: ' + err.message });
    } finally {
      setUploadingGallery(false);
      if (galleryFileInputRef.current) galleryFileInputRef.current.value = '';
    }
  };

  const handleRemoveGalleryImage = (indexToRemove) => {
    setFormData((prev) => ({
      ...prev,
      gallery_images: prev.gallery_images.filter((_, idx) => idx !== indexToRemove)
    }));
  };

  const handleSaveParty = async (e) => {
    e.preventDefault();
    try {
      setActionLoading(true);
      const payload = {
        name: formData.name.trim(),
        slug: formData.slug.trim(),
        hero_image: formData.hero_image.trim(),
        tapestry_title: formData.tapestry_title.trim() || `${formData.name.trim()} Tapestry`,
        description: formData.description.trim(),
        tags: formData.tags.split(',').map((t) => t.trim()).filter(Boolean),
        gallery_images: formData.gallery_images,
        social_links: {
          website: formData.website.trim(),
          twitter: formData.twitter.trim(),
          bluesky: formData.bluesky.trim(),
          instagram: formData.instagram.trim(),
          github: formData.github.trim()
        }
      };

      const url = editingParty ? `/api/parties/${editingParty.id}` : '/api/parties';
      const method = editingParty ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save party');

      setFeedback({ type: 'success', text: `Party "${data.party.name}" registered successfully!` });
      setIsPartyModalOpen(false);
      loadData();
      if (onPartyUpdated) onPartyUpdated();
    } catch (err) {
      setFeedback({ type: 'error', text: err.message });
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteParty = async (id, name) => {
    if (!window.confirm(`Are you sure you want to delete "${name}"? This action is permanent.`)) return;
    try {
      setActionLoading(true);
      const res = await fetch(`/api/parties/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to delete party');

      setFeedback({ type: 'success', text: data.message });
      loadData();
      if (onPartyUpdated) onPartyUpdated();
    } catch (err) {
      setFeedback({ type: 'error', text: err.message });
    } finally {
      setActionLoading(false);
    }
  };

  // Submit Party Report
  const handleSubmitPartyReport = async () => {
    if (!reportPartyModal.party) return;
    try {
      setActionLoading(true);
      const res = await fetch('/api/moderation/report', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          entityType: 'party',
          id: reportPartyModal.party.id,
          reason: reportPartyModal.reason
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to report party');

      setFeedback({ type: 'success', text: data.message });
      setReportPartyModal({ isOpen: false, party: null, reason: 'Violates community guidelines' });
      loadData();
      if (onPartyUpdated) onPartyUpdated();
    } catch (err) {
      setFeedback({ type: 'error', text: err.message });
    } finally {
      setActionLoading(false);
    }
  };

  // User Ban / Unban Actions
  const handleConfirmBanToggle = async () => {
    if (!banModal.user) return;
    try {
      setActionLoading(true);
      const endpoint = banModal.action === 'ban' ? `/api/users/${banModal.user.id}/ban` : `/api/users/${banModal.user.id}/unban`;
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update user ban status');

      setFeedback({ type: 'success', text: data.message });
      setBanModal({ isOpen: false, user: null, action: 'ban' });
      fetchUsers();
    } catch (err) {
      setFeedback({ type: 'error', text: err.message });
    } finally {
      setActionLoading(false);
    }
  };

  // Super Admin Role Promotion/Demotion Action (Promote to Admin / Demote to Fan)
  const handleUpdateUserRole = async (targetUser, targetRole) => {
    try {
      setActionLoading(true);
      const res = await fetch(`/api/users/${targetUser.id}/role`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ role: targetRole })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update role');

      setFeedback({ type: 'success', text: data.message });
      fetchUsers();
    } catch (err) {
      setFeedback({ type: 'error', text: err.message });
    } finally {
      setActionLoading(false);
    }
  };

  const openReview = (item, type, action) => {
    setReviewModal({
      isOpen: true,
      item,
      type,
      action,
      reason: action === 'agree' ? 'Violates community guidelines' : 'Approved by Admin - content is appropriate'
    });
  };

  const handleSubmitReview = async () => {
    try {
      setActionLoading(true);
      const { item, type, action, reason } = reviewModal;

      if (item && item.reported_by_id === user?.id && !isSuperAdmin) {
        throw new Error('Conflict of Interest: You cannot moderate content that you reported. Another Admin must review this report.');
      }

      const res = await fetch('/api/moderation/review', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          entityType: type, // 'party' | 'image' | 'message'
          id: item.id,
          action,
          reason
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Review failed');

      setFeedback({ type: 'success', text: data.message });
      setReviewModal({ isOpen: false, item: null, type: 'image', action: 'agree', reason: '' });
      loadData();
      if (activeAdminTab === 'users' || activeAdminTab === 'promotion') fetchUsers();
      if (onPartyUpdated) onPartyUpdated();
    } catch (err) {
      setFeedback({ type: 'error', text: err.message });
    } finally {
      setActionLoading(false);
    }
  };

  const pendingCount = (reportedParties?.length || 0) + (reportedImages?.length || 0) + (reportedMessages?.length || 0);
  const totalBadges = parties.reduce((sum, p) => sum + (p.images_count || 0), 0);
  const totalMessages = parties.reduce((sum, p) => sum + (p.messages_count || 0), 0);

  const filteredParties = parties.filter((p) => {
    if (!registrySearch.trim()) return true;
    const q = registrySearch.toLowerCase();
    return p.name.toLowerCase().includes(q) || (p.description && p.description.toLowerCase().includes(q));
  });

  return (
    <div className="max-w-7xl mx-auto space-y-8 animate-fade-in">
      {/* Non-Admin Access Unlock Banner */}
      {!isAdmin && (
        <div className="bg-gradient-to-r from-amber-950/70 via-slate-900 to-indigo-950/70 border border-amber-500/40 rounded-3xl p-6 sm:p-8 flex flex-col md:flex-row items-center justify-between gap-6 shadow-2xl">
          <div className="flex items-center space-x-4">
            <div className="p-3.5 bg-amber-500/20 text-amber-400 rounded-2xl border border-amber-500/40 shadow-lg">
              <KeyRound className="w-8 h-8" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-100">Party Registry & User Dashboard (Admin)</h3>
              <p className="text-xs text-slate-300 mt-1 max-w-xl">
                You are currently viewing in guest/Fan mode. Unlock Admin privileges to create Parties, manage Fans, promote roles, and moderate content.
              </p>
            </div>
          </div>
          <button
            onClick={handleInstantAdminUnlock}
            disabled={actionLoading}
            className="px-5 py-3 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 text-xs font-extrabold rounded-2xl shadow-xl shadow-amber-500/25 flex items-center space-x-2 transition-all flex-shrink-0"
          >
            <ShieldCheck className="w-4 h-4" />
            <span>⚡ Unlock / Switch to Admin Mode</span>
          </button>
        </div>
      )}

      {/* Main Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900/60 p-6 sm:p-8 rounded-3xl border border-slate-800 backdrop-blur-sm shadow-xl">
        <div>
          <div className="flex items-center space-x-2 text-cyan-400 font-semibold text-xs uppercase tracking-wider mb-1.5">
            {isSuperAdmin ? <Crown className="w-4 h-4 text-purple-400" /> : <ShieldCheck className="w-4 h-4 text-amber-400" />}
            <span>{isSuperAdmin ? 'Super Admin Control Center' : 'Admin Control Center'}</span>
          </div>
          <h1 className="text-3xl font-extrabold text-slate-100 tracking-tight">
            Admin Management Hub
          </h1>
          <p className="text-sm text-slate-400 mt-1 max-w-xl">
            Register Parties, manage registered Fans & Honor levels, promote roles, and moderate reported Parties and content.
          </p>
        </div>

        {/* Action Button */}
        <div className="flex items-center space-x-3">
          <button
            onClick={() => handleOpenPartyModal()}
            className="px-5 py-3 bg-gradient-to-r from-cyan-500 via-sky-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-white text-xs font-extrabold rounded-2xl shadow-xl shadow-cyan-500/30 flex items-center space-x-2 transition-all hover:scale-105"
          >
            <PlusCircle className="w-5 h-5" />
            <span>+ Register New Party</span>
          </button>
        </div>
      </div>

      {/* Stats Cards Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div
          onClick={() => setActiveAdminTab('parties')}
          className={`border rounded-2xl p-4 sm:p-5 shadow-lg cursor-pointer transition-all ${
            activeAdminTab === 'parties' ? 'bg-cyan-950/40 border-cyan-500' : 'bg-slate-900 border-slate-800 hover:border-slate-700'
          }`}
        >
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">
            Registered Parties
          </span>
          <p className="text-2xl sm:text-3xl font-extrabold text-cyan-400 mt-1">
            {parties.length}
          </p>
        </div>

        <div
          onClick={() => setActiveAdminTab('users')}
          className={`border rounded-2xl p-4 sm:p-5 shadow-lg cursor-pointer transition-all ${
            activeAdminTab === 'users' ? 'bg-indigo-950/40 border-indigo-500' : 'bg-slate-900 border-slate-800 hover:border-slate-700'
          }`}
        >
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">
            Registered Accounts
          </span>
          <p className="text-2xl sm:text-3xl font-extrabold text-indigo-400 mt-1">
            {userTotal || usersList.length}
          </p>
        </div>

        <div
          onClick={() => setActiveAdminTab('moderation')}
          className={`border rounded-2xl p-4 sm:p-5 shadow-lg cursor-pointer transition-all ${
            pendingCount > 0
              ? 'bg-rose-950/30 border-rose-800/80 hover:border-rose-500'
              : activeAdminTab === 'moderation'
              ? 'bg-rose-950/20 border-rose-600'
              : 'bg-slate-900 border-slate-800 hover:border-slate-700'
          }`}
        >
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center justify-between">
            <span>Moderation Queue</span>
            {pendingCount > 0 && (
              <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
            )}
          </span>
          <p className={`text-2xl sm:text-3xl font-extrabold mt-1 ${pendingCount > 0 ? 'text-rose-400' : 'text-slate-400'}`}>
            {pendingCount}
          </p>
        </div>
      </div>

      {/* Tabs Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
        <div className="flex items-center space-x-2 flex-wrap gap-y-2">
          {/* Tab 1: Party Registry */}
          <button
            onClick={() => setActiveAdminTab('parties')}
            className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              activeAdminTab === 'parties'
                ? 'bg-cyan-500 text-slate-950 font-bold shadow-md shadow-cyan-500/20'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <SlidersHorizontal className="w-4 h-4" />
            <span>Party Registry ({parties.length})</span>
          </button>

          {/* Tab 2: User Dashboard */}
          <button
            onClick={() => setActiveAdminTab('users')}
            className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              activeAdminTab === 'users'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/25 font-bold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>User Dashboard ({userTotal || usersList.length})</span>
          </button>

          {/* Tab 3: Promotion Dashboard (Super Admin Exclusive) */}
          {isSuperAdmin && (
            <button
              onClick={() => setActiveAdminTab('promotion')}
              className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                activeAdminTab === 'promotion'
                  ? 'bg-gradient-to-r from-purple-600 to-fuchsia-600 text-white shadow-md shadow-purple-600/30 font-bold'
                  : 'text-purple-300 hover:text-purple-100 bg-purple-950/30 border border-purple-900/50'
              }`}
            >
              <Crown className="w-4 h-4 text-purple-300" />
              <span>Promotion Dashboard</span>
              <span className="px-1.5 py-0.2 rounded-md bg-purple-900/80 text-purple-200 text-[10px] font-bold">
                Super Admin
              </span>
            </button>
          )}

          {/* Tab 4: Content Moderation */}
          <button
            onClick={() => setActiveAdminTab('moderation')}
            className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              activeAdminTab === 'moderation'
                ? 'bg-rose-600 text-white shadow-md shadow-rose-600/25 font-bold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Flag className="w-4 h-4" />
            <span>Content Moderation</span>
            {pendingCount > 0 && (
              <span className="px-1.5 py-0.5 rounded-full bg-rose-950 text-rose-300 text-[10px] border border-rose-800/80">
                {pendingCount}
              </span>
            )}
          </button>
        </div>

        {activeAdminTab === 'parties' && (
          <div className="w-64 relative">
            <input
              type="text"
              placeholder="Search registry..."
              value={registrySearch}
              onChange={(e) => setRegistrySearch(e.target.value)}
              className="w-full pl-3 pr-3 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
            />
          </div>
        )}
      </div>

      {/* Feedback Toast */}
      {feedback && (
        <div
          className={`p-4 rounded-2xl border text-xs flex items-center justify-between animate-slide-down ${
            feedback.type === 'success'
              ? 'bg-emerald-950/60 border-emerald-800/60 text-emerald-300'
              : 'bg-rose-950/60 border-rose-800/60 text-rose-300'
          }`}
        >
          <div className="flex items-center space-x-2">
            {feedback.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
            <span>{feedback.text}</span>
          </div>
          <button onClick={() => setFeedback(null)} className="p-1 hover:bg-slate-800/60 rounded">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Tab 1: Party Registry Manager */}
      {activeAdminTab === 'parties' && (
        <div className="space-y-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-950/60 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    <th className="py-3.5 px-4">Party & Hero</th>
                    <th className="py-3.5 px-4">Status</th>
                    <th className="py-3.5 px-4">Description</th>
                    <th className="py-3.5 px-4">Tags</th>
                    <th className="py-3.5 px-4 text-center">Stats</th>
                    <th className="py-3.5 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 text-xs">
                  {filteredParties.map((party) => (
                    <tr key={party.id} className="hover:bg-slate-800/40 transition-colors">
                      {/* Hero & Name */}
                      <td className="py-3.5 px-4 flex items-center space-x-3.5 min-w-[220px]">
                        <img
                          src={party.hero_image}
                          alt={party.name}
                          className="w-14 h-10 rounded-lg object-cover border border-slate-800 flex-shrink-0"
                        />
                        <div className="min-w-0">
                          <p className="font-bold text-slate-100 truncate">{party.name}</p>
                          <p className="text-[10px] text-cyan-400 truncate">"{party.tapestry_title}"</p>
                          <p className="text-[10px] text-slate-500 font-mono">/{party.slug}</p>
                        </div>
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        {party.status === 'reported' ? (
                          <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-md bg-rose-950 text-rose-300 border border-rose-800 text-[10px] font-bold">
                            <Flag className="w-3 h-3 text-rose-400" />
                            <span>Reported (Hidden)</span>
                          </span>
                        ) : party.status === 'banned' ? (
                          <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-md bg-rose-950/80 text-rose-400 border border-rose-900 text-[10px] font-bold">
                            <Ban className="w-3 h-3 text-rose-400" />
                            <span>Banned</span>
                          </span>
                        ) : party.status === 'blessed' ? (
                          <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-md bg-emerald-950 text-emerald-300 border border-emerald-800 text-[10px] font-bold">
                            <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                            <span>Blessed</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 border border-slate-700 text-[10px]">
                            <span>Active</span>
                          </span>
                        )}
                      </td>

                      {/* Description */}
                      <td className="py-3.5 px-4 max-w-xs">
                        <p className="text-slate-300 line-clamp-2 leading-relaxed text-[11px]">
                          {party.description || 'No description provided.'}
                        </p>
                      </td>

                      {/* Tags */}
                      <td className="py-3.5 px-4">
                        <div className="flex flex-wrap gap-1 max-w-[180px]">
                          {(party.tags || []).map((tag) => (
                            <span
                              key={tag}
                              className="px-2 py-0.5 rounded bg-slate-800 text-cyan-300 text-[10px] font-medium"
                            >
                              #{tag}
                            </span>
                          ))}
                        </div>
                      </td>

                      {/* Stats */}
                      <td className="py-3.5 px-4 text-center text-slate-300">
                        <span className="font-bold text-cyan-400">{party.images_count}</span> images
                        <br />
                        <span className="font-bold text-indigo-400">{party.messages_count}</span> msgs
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end space-x-1.5">
                          <button
                            onClick={() => onSelectParty && onSelectParty(party)}
                            className="px-2.5 py-1.5 bg-cyan-500/10 hover:bg-cyan-500 hover:text-slate-950 text-cyan-300 border border-cyan-500/30 rounded-lg text-xs font-semibold flex items-center space-x-1 transition-colors"
                            title="Open Interactive Party Page"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>View</span>
                          </button>
                          {(isSuperAdmin || (party.status !== 'blessed' && party.status !== 'reported' && party.status !== 'banned')) && (
                            <button
                              onClick={() => setReportPartyModal({ isOpen: true, party, reason: 'Violates community guidelines' })}
                              className="p-1.5 bg-slate-800 hover:bg-rose-950/60 text-slate-300 hover:text-rose-300 border border-slate-700 hover:border-rose-800/80 rounded-lg transition-colors"
                              title="Report this Party"
                            >
                              <Flag className="w-3.5 h-3.5 text-rose-400" />
                            </button>
                          )}
                          <button
                            onClick={() => handleOpenPartyModal(party)}
                            className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition-colors"
                            title="Edit Party"
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteParty(party.id, party.name)}
                            className="p-1.5 bg-slate-800 hover:bg-rose-600 text-rose-300 hover:text-white rounded-lg transition-colors"
                            title="Delete Party"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: User Dashboard */}
      {activeAdminTab === 'users' && (
        <div className="space-y-4">
          {/* Controls Bar: Search, Filters, Sorting */}
          <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 bg-slate-900/90 p-4 rounded-2xl border border-slate-800">
            {/* Search Input */}
            <form onSubmit={handleUserSearchSubmit} className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
              <input
                type="text"
                placeholder="Search accounts by name or email..."
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 focus:outline-none focus:border-indigo-500"
              />
            </form>

            {/* Filter & Sort Controls */}
            <div className="flex items-center space-x-2.5 flex-wrap gap-y-2">
              <div className="flex items-center space-x-1.5 bg-slate-950 px-2.5 py-1.5 rounded-xl border border-slate-800 text-xs text-slate-300">
                <Filter className="w-3.5 h-3.5 text-indigo-400" />
                <select
                  value={userFilter}
                  onChange={(e) => {
                    setUserFilter(e.target.value);
                    setUserPage(1);
                  }}
                  className="bg-transparent text-xs text-slate-200 focus:outline-none cursor-pointer"
                >
                  <option value="all">All Accounts</option>
                  <option value="fan">Fans Only</option>
                  <option value="admin">Admins & Super Admins</option>
                  <option value="super_admin">Super Admins Only</option>
                  <option value="honor_good">Good Honor Fans</option>
                  <option value="honor_poor">Poor Honor Fans</option>
                  <option value="honor_bad">Bad Honor Fans</option>
                  <option value="active">Active Only</option>
                  <option value="banned">Banned Only</option>
                  <option value="flagged">Flagged (Violations &gt; 0)</option>
                </select>
              </div>

              <div className="flex items-center space-x-1.5 bg-slate-950 px-2.5 py-1.5 rounded-xl border border-slate-800 text-xs text-slate-300">
                <SlidersHorizontal className="w-3.5 h-3.5 text-cyan-400" />
                <select
                  value={userSort}
                  onChange={(e) => {
                    setUserSort(e.target.value);
                    setUserPage(1);
                  }}
                  className="bg-transparent text-xs text-slate-200 focus:outline-none cursor-pointer"
                >
                  <option value="newest">Newest First</option>
                  <option value="oldest">Oldest First</option>
                  <option value="honor">Honor Status</option>
                  <option value="violations">Most Reported Violations</option>
                  <option value="images">Most Images</option>
                  <option value="messages">Most Messages</option>
                  <option value="name">Name A-Z</option>
                </select>
              </div>

              <button
                onClick={fetchUsers}
                className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition-colors"
                title="Refresh user list"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${usersLoading ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>

          {/* Users Table */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-950/60 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    <th className="py-3.5 px-4">Account</th>
                    <th className="py-3.5 px-4">Role & Status</th>
                    <th className="py-3.5 px-4">Honor Level</th>
                    <th className="py-3.5 px-4 text-center">Images</th>
                    <th className="py-3.5 px-4 text-center">Messages</th>
                    <th className="py-3.5 px-4 text-center">Inappropriate Items</th>
                    <th className="py-3.5 px-4">Registered</th>
                    <th className="py-3.5 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 text-xs">
                  {usersLoading ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-slate-400">
                        <RefreshCw className="w-6 h-6 animate-spin text-indigo-400 mx-auto mb-2" />
                        <span>Loading accounts directory...</span>
                      </td>
                    </tr>
                  ) : usersList.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-slate-500">
                        No accounts found matching current filter.
                      </td>
                    </tr>
                  ) : (
                    usersList.map((u) => (
                      <tr key={u.id} className="hover:bg-slate-800/40 transition-colors">
                        {/* User info */}
                        <td className="py-3.5 px-4 flex items-center space-x-3 min-w-[200px]">
                          <img
                            src={u.avatar_url}
                            alt={u.name}
                            className="w-10 h-10 rounded-xl bg-slate-800 p-0.5 object-cover border border-slate-800 flex-shrink-0"
                          />
                          <div className="min-w-0">
                            <p className="font-bold text-slate-100 truncate">{u.name}</p>
                            <p className="text-[11px] text-slate-400 truncate">{u.email || 'No email provided'}</p>
                          </div>
                        </td>

                        {/* Status & Role */}
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <div className="flex flex-wrap items-center gap-1.5">
                            {u.is_super_admin === 1 ? (
                              <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-md bg-purple-950/80 text-purple-300 border border-purple-800/60 text-[10px] font-bold">
                                <Crown className="w-3 h-3 text-purple-400" />
                                <span>Super Admin</span>
                              </span>
                            ) : u.is_admin === 1 ? (
                              <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-md bg-amber-950/80 text-amber-300 border border-amber-800/60 text-[10px] font-bold">
                                <ShieldCheck className="w-3 h-3 text-amber-400" />
                                <span>Admin</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-md bg-indigo-950/80 text-indigo-300 border border-indigo-800/60 text-[10px] font-bold">
                                <Sparkles className="w-3 h-3 text-indigo-400" />
                                <span>Fan</span>
                              </span>
                            )}

                            {u.is_banned === 1 ? (
                              <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-md bg-rose-950/80 text-rose-300 border border-rose-800/60 text-[10px] font-bold">
                                <Ban className="w-3 h-3 text-rose-400" />
                                <span>Banned</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-md bg-emerald-950/80 text-emerald-300 border border-emerald-800/60 text-[10px] font-semibold">
                                <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                                <span>Active</span>
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Honor Status & Last Updated */}
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          {u.is_admin === 1 || u.is_super_admin === 1 ? (
                            <span className="text-[11px] text-slate-500 italic">Exempt (Admin)</span>
                          ) : (
                            <div className="space-y-0.5">
                              <div className="flex items-center space-x-1.5">
                                {u.honor === 'Good' ? (
                                  <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-md bg-emerald-950/80 text-emerald-300 border border-emerald-800/60 text-[10px] font-bold">
                                    <ShieldCheck className="w-3 h-3 text-emerald-400" />
                                    <span>Good Honor</span>
                                  </span>
                                ) : u.honor === 'Poor' ? (
                                  <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-md bg-amber-950/80 text-amber-300 border border-amber-800/60 text-[10px] font-bold">
                                    <AlertTriangle className="w-3 h-3 text-amber-400" />
                                    <span>Poor Honor</span>
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-md bg-rose-950/80 text-rose-300 border border-rose-800/60 text-[10px] font-bold">
                                    <ShieldX className="w-3 h-3 text-rose-400" />
                                    <span>Bad Honor</span>
                                  </span>
                                )}
                              </div>
                              <p className="text-[10px] text-slate-400">
                                Updated: {new Date(u.honor_updated_at || u.created_at || Date.now()).toLocaleDateString()}
                              </p>
                            </div>
                          )}
                        </td>

                        {/* Uploaded Images */}
                        <td className="py-3.5 px-4 text-center">
                          <span className="inline-flex items-center space-x-1 px-2 py-1 rounded-lg bg-slate-950 text-cyan-300 border border-slate-800 text-xs font-bold">
                            <ImageIcon className="w-3.5 h-3.5 text-cyan-400" />
                            <span>{u.uploaded_image_count}</span>
                          </span>
                        </td>

                        {/* Uploaded Messages */}
                        <td className="py-3.5 px-4 text-center">
                          <span className="inline-flex items-center space-x-1 px-2 py-1 rounded-lg bg-slate-950 text-indigo-300 border border-slate-800 text-xs font-bold">
                            <MessageSquare className="w-3.5 h-3.5 text-indigo-400" />
                            <span>{u.uploaded_message_count}</span>
                          </span>
                        </td>

                        {/* Reported Inappropriate Violations */}
                        <td className="py-3.5 px-4 text-center">
                          {u.reported_inappropriate_count > 0 ? (
                            <span className="inline-flex items-center space-x-1 px-2 py-1 rounded-lg bg-rose-950 text-rose-300 border border-rose-800 text-xs font-bold">
                              <Flag className="w-3.5 h-3.5 text-rose-400" />
                              <span>{u.reported_inappropriate_count} Violations</span>
                            </span>
                          ) : (
                            <span className="text-slate-500 font-semibold">0</span>
                          )}
                        </td>

                        {/* Registered date */}
                        <td className="py-3.5 px-4 text-slate-400 text-[11px] whitespace-nowrap">
                          {new Date(u.created_at || Date.now()).toLocaleDateString()}
                        </td>

                        {/* Ban / Unban Actions */}
                        <td className="py-3.5 px-4 text-right">
                          {u.id === user.id ? (
                            <span className="text-[11px] text-slate-500 italic pr-2">Your Account</span>
                          ) : u.is_super_admin === 1 ? (
                            <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-purple-950/40 text-purple-300 border border-purple-900/60 text-[11px] font-semibold">
                              <Crown className="w-3 h-3 text-purple-400" />
                              <span>Protected</span>
                            </span>
                          ) : u.is_admin === 1 && !isSuperAdmin ? (
                            <span
                              className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-slate-800/60 text-slate-400 border border-slate-700/60 text-[11px]"
                              title="Admins cannot ban other Admins. Only Super Admins can ban Admins."
                            >
                              <span>Admin Protected</span>
                            </span>
                          ) : u.is_banned === 1 ? (
                            <button
                              onClick={() => setBanModal({ isOpen: true, user: u, action: 'unban' })}
                              className="px-3 py-1.5 bg-emerald-950 hover:bg-emerald-900 text-emerald-300 border border-emerald-800/80 rounded-xl text-xs font-bold flex items-center space-x-1.5 ml-auto transition-colors shadow-sm"
                            >
                              <UserCheck className="w-3.5 h-3.5 text-emerald-400" />
                              <span>Unban User</span>
                            </button>
                          ) : (
                            <button
                              onClick={() => setBanModal({ isOpen: true, user: u, action: 'ban' })}
                              className="px-3 py-1.5 bg-rose-950/70 hover:bg-rose-900 text-rose-300 border border-rose-800/80 rounded-xl text-xs font-bold flex items-center space-x-1.5 ml-auto transition-colors shadow-sm"
                            >
                              <UserX className="w-3.5 h-3.5 text-rose-400" />
                              <span>Ban User</span>
                            </button>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            <div className="p-4 bg-slate-950/60 border-t border-slate-800 flex items-center justify-between">
              <span className="text-xs text-slate-400">
                Showing {usersList.length} of {userTotal} registered accounts
              </span>

              <div className="flex items-center space-x-2">
                <button
                  disabled={userPage <= 1 || usersLoading}
                  onClick={() => setUserPage((p) => Math.max(1, p - 1))}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-300 rounded-xl text-xs font-semibold flex items-center space-x-1 transition-colors"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                  <span>Prev</span>
                </button>
                <span className="text-xs font-bold text-slate-200 px-2">
                  Page {userPage} of {userTotalPages}
                </span>
                <button
                  disabled={userPage >= userTotalPages || usersLoading}
                  onClick={() => setUserPage((p) => Math.min(userTotalPages, p + 1))}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-300 rounded-xl text-xs font-semibold flex items-center space-x-1 transition-colors"
                >
                  <span>Next</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: Promotion Dashboard (Super Admin Exclusive) */}
      {activeAdminTab === 'promotion' && (
        <div className="space-y-4">
          {/* Header Description */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-gradient-to-r from-purple-950/60 via-slate-900 to-indigo-950/60 p-5 rounded-2xl border border-purple-500/30">
            <div className="flex items-center space-x-3.5">
              <div className="p-3 bg-purple-500/20 text-purple-300 rounded-2xl border border-purple-500/40">
                <Crown className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-base font-extrabold text-slate-100 flex items-center gap-2">
                  <span>Role Promotion Dashboard</span>
                  <span className="px-2 py-0.5 rounded-full bg-purple-950 text-purple-300 text-[10px] border border-purple-800 font-bold">
                    Super Admin Exclusive
                  </span>
                </h2>
                <p className="text-xs text-slate-300 mt-0.5">
                  Promote Fans to full Admin privileges or demote Admins back to Fan status.
                </p>
              </div>
            </div>

            <button
              onClick={fetchUsers}
              className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold flex items-center space-x-1.5 self-start sm:self-auto transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${usersLoading ? 'animate-spin' : ''}`} />
              <span>Refresh List</span>
            </button>
          </div>

          {/* Controls Bar */}
          <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 bg-slate-900/90 p-4 rounded-2xl border border-slate-800">
            <form onSubmit={handleUserSearchSubmit} className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
              <input
                type="text"
                placeholder="Search accounts to promote/demote..."
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 focus:outline-none focus:border-purple-500"
              />
            </form>

            <div className="flex items-center space-x-2.5">
              <div className="flex items-center space-x-1.5 bg-slate-950 px-2.5 py-1.5 rounded-xl border border-slate-800 text-xs text-slate-300">
                <Filter className="w-3.5 h-3.5 text-purple-400" />
                <select
                  value={userFilter}
                  onChange={(e) => {
                    setUserFilter(e.target.value);
                    setUserPage(1);
                  }}
                  className="bg-transparent text-xs text-slate-200 focus:outline-none cursor-pointer"
                >
                  <option value="all">All Accounts</option>
                  <option value="fan">Fans Only</option>
                  <option value="admin">Current Admins</option>
                </select>
              </div>

              <div className="flex items-center space-x-1.5 bg-slate-950 px-2.5 py-1.5 rounded-xl border border-slate-800 text-xs text-slate-300">
                <SlidersHorizontal className="w-3.5 h-3.5 text-purple-400" />
                <select
                  value={userSort}
                  onChange={(e) => {
                    setUserSort(e.target.value);
                    setUserPage(1);
                  }}
                  className="bg-transparent text-xs text-slate-200 focus:outline-none cursor-pointer"
                >
                  <option value="newest">Newest First</option>
                  <option value="name">Name A-Z</option>
                  <option value="honor">Honor Status</option>
                  <option value="violations">Most Violations</option>
                  <option value="images">Most Images</option>
                </select>
              </div>
            </div>
          </div>

          {/* Promotion Table */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-950/60 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    <th className="py-3.5 px-4">Account</th>
                    <th className="py-3.5 px-4">Current Role & Honor</th>
                    <th className="py-3.5 px-4 text-center">Activity</th>
                    <th className="py-3.5 px-4">Registered</th>
                    <th className="py-3.5 px-4 text-right">Role Update Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 text-xs">
                  {usersLoading ? (
                    <tr>
                      <td colSpan={5} className="py-12 text-center text-slate-400">
                        <RefreshCw className="w-6 h-6 animate-spin text-purple-400 mx-auto mb-2" />
                        <span>Loading accounts directory...</span>
                      </td>
                    </tr>
                  ) : usersList.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-12 text-center text-slate-500">
                        No accounts found matching current filter.
                      </td>
                    </tr>
                  ) : (
                    usersList.map((u) => (
                      <tr key={u.id} className="hover:bg-slate-800/40 transition-colors">
                        {/* User */}
                        <td className="py-3.5 px-4 flex items-center space-x-3 min-w-[200px]">
                          <img
                            src={u.avatar_url}
                            alt={u.name}
                            className="w-10 h-10 rounded-xl bg-slate-800 p-0.5 object-cover border border-slate-800 flex-shrink-0"
                          />
                          <div className="min-w-0">
                            <p className="font-bold text-slate-100 truncate">{u.name}</p>
                            <p className="text-[11px] text-slate-400 truncate">{u.email || 'No email provided'}</p>
                          </div>
                        </td>

                        {/* Current Role & Honor */}
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          {u.is_super_admin === 1 ? (
                            <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-md bg-purple-950/80 text-purple-300 border border-purple-800/60 text-[10px] font-bold">
                              <Crown className="w-3 h-3 text-purple-400" />
                              <span>Super Admin</span>
                            </span>
                          ) : u.is_admin === 1 ? (
                            <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-md bg-amber-950/80 text-amber-300 border border-amber-800/60 text-[10px] font-bold">
                              <ShieldCheck className="w-3 h-3 text-amber-400" />
                              <span>Admin</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-md bg-indigo-950/80 text-indigo-300 border border-indigo-800/60 text-[10px] font-bold">
                              <Sparkles className="w-3 h-3 text-indigo-400" />
                              <span>Fan ({u.honor || 'Good'} Honor)</span>
                            </span>
                          )}
                        </td>

                        {/* Activity */}
                        <td className="py-3.5 px-4 text-center text-slate-400 text-[11px]">
                          <span className="text-cyan-400 font-semibold">{u.uploaded_image_count}</span> imgs •{' '}
                          <span className="text-indigo-400 font-semibold">{u.uploaded_message_count}</span> msgs
                        </td>

                        {/* Registered */}
                        <td className="py-3.5 px-4 text-slate-400 text-[11px] whitespace-nowrap">
                          {new Date(u.created_at || Date.now()).toLocaleDateString()}
                        </td>

                        {/* Role Update Action */}
                        <td className="py-3.5 px-4 text-right">
                          {u.id === user.id ? (
                            <span className="text-[11px] text-slate-500 italic pr-2">Your Super Admin Account</span>
                          ) : u.is_super_admin === 1 ? (
                            <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-purple-950/40 text-purple-300 border border-purple-900/60 text-[11px] font-semibold">
                              <Crown className="w-3 h-3 text-purple-400" />
                              <span>Super Admin (Fixed)</span>
                            </span>
                          ) : u.is_admin === 1 ? (
                            <button
                              onClick={() => handleUpdateUserRole(u, 'fan')}
                              disabled={actionLoading}
                              className="px-3.5 py-1.5 bg-slate-800 hover:bg-rose-950/60 text-slate-300 hover:text-rose-300 border border-slate-700 hover:border-rose-800/80 rounded-xl text-xs font-bold inline-flex items-center space-x-1.5 transition-colors shadow-sm"
                              title="Demote this admin to a Fan"
                            >
                              <ArrowDownCircle className="w-3.5 h-3.5 text-amber-400" />
                              <span>Demote to Fan</span>
                            </button>
                          ) : (
                            <button
                              onClick={() => handleUpdateUserRole(u, 'admin')}
                              disabled={actionLoading}
                              className="px-3.5 py-1.5 bg-gradient-to-r from-purple-600 via-indigo-600 to-cyan-600 hover:from-purple-500 hover:to-cyan-500 text-white rounded-xl text-xs font-bold inline-flex items-center space-x-1.5 transition-all shadow-md shadow-purple-600/25"
                              title="Promote this Fan to full Admin privileges"
                            >
                              <ArrowUpCircle className="w-3.5 h-3.5 text-purple-200" />
                              <span>Promote to Admin</span>
                            </button>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            <div className="p-4 bg-slate-950/60 border-t border-slate-800 flex items-center justify-between">
              <span className="text-xs text-slate-400">
                Showing {usersList.length} of {userTotal} registered accounts
              </span>

              <div className="flex items-center space-x-2">
                <button
                  disabled={userPage <= 1 || usersLoading}
                  onClick={() => setUserPage((p) => Math.max(1, p - 1))}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-300 rounded-xl text-xs font-semibold flex items-center space-x-1 transition-colors"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                  <span>Prev</span>
                </button>
                <span className="text-xs font-bold text-slate-200 px-2">
                  Page {userPage} of {userTotalPages}
                </span>
                <button
                  disabled={userPage >= userTotalPages || usersLoading}
                  onClick={() => setUserPage((p) => Math.min(userTotalPages, p + 1))}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-300 rounded-xl text-xs font-semibold flex items-center space-x-1 transition-colors"
                >
                  <span>Next</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 4: Content Moderation Queue */}
      {activeAdminTab === 'moderation' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-200 flex items-center gap-2">
              <Flag className="w-5 h-5 text-rose-400" />
              <span>Pending Review Queue ({pendingCount})</span>
            </h2>
            <button
              onClick={loadData}
              className="p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-xl transition-colors"
              title="Refresh Queue"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>

          {loading ? (
            <div className="h-48 flex items-center justify-center bg-slate-900 border border-slate-800 rounded-3xl">
              <RefreshCw className="w-6 h-6 text-cyan-400 animate-spin" />
            </div>
          ) : pendingCount === 0 ? (
            <div className="p-12 text-center bg-slate-900/40 border border-dashed border-slate-800 rounded-3xl space-y-2">
              <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto" />
              <h3 className="text-base font-bold text-slate-200">Moderation Queue is Clean!</h3>
              <p className="text-xs text-slate-400">No reported Parties, images, or messages currently pending review.</p>
            </div>
          ) : (
            <div className="space-y-8">
              {/* Section 1: Reported Parties */}
              {reportedParties.length > 0 && (
                <div className="space-y-4">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-rose-400 flex items-center gap-2">
                    <Flag className="w-4 h-4 text-rose-400" />
                    <span>Reported Parties ({reportedParties.length})</span>
                    <span className="text-[10px] text-slate-400 font-normal lowercase">(temporarily hidden from guests & Fans)</span>
                  </h3>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {reportedParties.map((p) => (
                      <div
                        key={p.id}
                        className="bg-slate-900 border-2 border-rose-900/80 rounded-2xl p-5 space-y-4 shadow-xl"
                      >
                        <div className="flex items-start space-x-4">
                          <img
                            src={p.hero_image}
                            alt={p.name}
                            className="w-28 h-20 rounded-xl object-cover border border-slate-800 flex-shrink-0"
                          />
                          <div className="min-w-0 flex-1 space-y-1">
                            <h4 className="text-sm font-bold text-slate-100 truncate">{p.name}</h4>
                            <p className="text-[11px] text-cyan-400 truncate">"{p.tapestry_title}"</p>
                            <p className="text-xs text-slate-300 line-clamp-2 leading-relaxed">{p.description}</p>
                          </div>
                        </div>

                        <div className="p-3 bg-rose-950/40 border border-rose-900/60 rounded-xl text-xs space-y-1">
                          <div className="flex items-center justify-between text-rose-300 font-semibold">
                            <span>Reported by: {p.reporter_name || 'Fan'}</span>
                            <span className="text-[10px] text-slate-400">{new Date(p.reported_at || Date.now()).toLocaleDateString()}</span>
                          </div>
                          <p className="text-rose-200 italic">"{p.report_reason}"</p>
                        </div>

                        {p.reported_by_id === user?.id && !isSuperAdmin ? (
                          <div className="flex items-center space-x-1.5 px-3 py-2 bg-amber-950/40 border border-amber-800/60 rounded-xl text-[11px] text-amber-300 font-semibold mt-2">
                            <ShieldAlert className="w-4 h-4 flex-shrink-0 text-amber-400" />
                            <span>Reported by you. Another Admin must review this report.</span>
                          </div>
                        ) : (
                          <div className="flex items-center justify-end space-x-2 pt-2 border-t border-slate-800">
                            <button
                              onClick={() => openReview(p, 'party', 'agree')}
                              className="px-3.5 py-2 bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-rose-600/25 transition-colors"
                            >
                              Agree & Tombstone (Ban Party)
                            </button>
                            <button
                              onClick={() => openReview(p, 'party', 'disagree')}
                              className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-emerald-600/25 transition-colors"
                            >
                              Disagree & Bless Party
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Section 2: Reported Images & Messages Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Reported Images */}
                <div className="space-y-4">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
                    <ImageIcon className="w-4 h-4 text-cyan-400" />
                    <span>Reported Images ({reportedImages.length})</span>
                  </h3>

                  {reportedImages.length === 0 ? (
                    <p className="text-xs text-slate-500 italic bg-slate-900/60 p-4 rounded-xl border border-slate-800">
                      No reported images.
                    </p>
                  ) : (
                    reportedImages.map((img) => (
                      <div
                        key={img.id}
                        className="bg-slate-900 border border-rose-950 rounded-2xl p-4 space-y-3 shadow-lg"
                      >
                        <div className="flex items-start space-x-3">
                          <img
                            src={img.url}
                            alt="Reported"
                            className="w-24 h-24 rounded-xl object-cover border border-slate-800 flex-shrink-0"
                          />
                          <div className="min-w-0 flex-1 space-y-1">
                            <p className="text-xs font-bold text-slate-200">
                              Author: <span className="text-cyan-400">{img.user_name}</span>
                            </p>
                            <p className="text-[11px] text-slate-400">
                              Reporter: <span className="text-amber-300">{img.reporter_name || 'Fan'}</span>
                            </p>
                            <div className="p-2 bg-rose-950/40 border border-rose-900/60 rounded-lg text-[11px] text-rose-300">
                              <span className="font-bold">Reason:</span> {img.report_reason}
                            </div>
                          </div>
                        </div>

                        {img.reported_by_id === user?.id && !isSuperAdmin ? (
                          <div className="flex items-center space-x-1.5 px-3 py-1.5 bg-amber-950/40 border border-amber-800/60 rounded-xl text-[11px] text-amber-300 font-semibold">
                            <ShieldAlert className="w-3.5 h-3.5 flex-shrink-0 text-amber-400" />
                            <span>Reported by you. Another Admin must review this report.</span>
                          </div>
                        ) : (
                          <div className="flex items-center justify-end space-x-2 pt-2 border-t border-slate-800">
                            <button
                              onClick={() => openReview(img, 'image', 'agree')}
                              className="px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold rounded-xl shadow-sm"
                            >
                              Agree & Tombstone
                            </button>
                            <button
                              onClick={() => openReview(img, 'image', 'disagree')}
                              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl shadow-sm"
                            >
                              Disagree & Bless
                            </button>
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>

                {/* Reported Messages */}
                <div className="space-y-4">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
                    <MessageSquare className="w-4 h-4 text-indigo-400" />
                    <span>Reported Messages ({reportedMessages.length})</span>
                  </h3>

                  {reportedMessages.length === 0 ? (
                    <p className="text-xs text-slate-500 italic bg-slate-900/60 p-4 rounded-xl border border-slate-800">
                      No reported messages.
                    </p>
                  ) : (
                    reportedMessages.map((msg) => (
                      <div
                        key={msg.id}
                        className="bg-slate-900 border border-rose-950 rounded-2xl p-4 space-y-3 shadow-lg"
                      >
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-bold text-slate-200">
                              Author: <span className="text-cyan-400">{msg.user_name}</span>
                            </span>
                          </div>

                          <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 text-xs text-slate-200 italic">
                            "{msg.text}"
                          </div>

                          <div className="p-2 bg-rose-950/40 border border-rose-900/60 rounded-lg text-[11px] text-rose-300">
                            <span className="font-bold">Reported by {msg.reporter_name || 'Fan'}:</span> {msg.report_reason}
                          </div>
                        </div>

                        {msg.reported_by_id === user?.id && !isSuperAdmin ? (
                          <div className="flex items-center space-x-1.5 px-3 py-1.5 bg-amber-950/40 border border-amber-800/60 rounded-xl text-[11px] text-amber-300 font-semibold">
                            <ShieldAlert className="w-3.5 h-3.5 flex-shrink-0 text-amber-400" />
                            <span>Reported by you. Another Admin must review this report.</span>
                          </div>
                        ) : (
                          <div className="flex items-center justify-end space-x-2 pt-2 border-t border-slate-800">
                            <button
                              onClick={() => openReview(msg, 'message', 'agree')}
                              className="px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold rounded-xl shadow-sm"
                            >
                              Agree & Tombstone
                            </button>
                            <button
                              onClick={() => openReview(msg, 'message', 'disagree')}
                              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl shadow-sm"
                            >
                              Disagree & Bless
                            </button>
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Modal: Report Party Confirmation */}
      {reportPartyModal.isOpen && reportPartyModal.party && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-fade-in">
          <div className="relative w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center space-x-2.5">
                <div className="p-2 bg-rose-500/10 text-rose-400 rounded-xl border border-rose-500/20">
                  <Flag className="w-5 h-5" />
                </div>
                <h3 className="text-base font-bold text-slate-100">Report Party</h3>
              </div>
              <button
                onClick={() => setReportPartyModal({ isOpen: false, party: null, reason: 'Violates community guidelines' })}
                className="p-1 text-slate-400 hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              Reporting <strong>"{reportPartyModal.party.name}"</strong> will immediately hide the Party and make it inaccessible to guests and Fans pending Admin review.
            </p>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Reason for Reporting:
              </label>
              <textarea
                rows={2}
                value={reportPartyModal.reason}
                onChange={(e) => setReportPartyModal({ ...reportPartyModal, reason: e.target.value })}
                className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 focus:outline-none focus:border-rose-500 resize-none"
              />
            </div>

            <div className="flex items-center justify-end space-x-2 pt-2">
              <button
                type="button"
                onClick={() => setReportPartyModal({ isOpen: false, party: null, reason: 'Violates community guidelines' })}
                className="px-3.5 py-2 bg-slate-800 text-slate-300 text-xs font-semibold rounded-xl"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSubmitPartyReport}
                disabled={actionLoading}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-rose-600/25 flex items-center space-x-1.5"
              >
                {actionLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : null}
                <span>Submit Party Report</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Ban / Unban User Confirmation */}
      {banModal.isOpen && banModal.user && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-fade-in">
          <div className="relative w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center space-x-2.5">
                <div className={`p-2 rounded-xl ${banModal.action === 'ban' ? 'bg-rose-500/10 text-rose-400' : 'bg-emerald-500/10 text-emerald-400'}`}>
                  {banModal.action === 'ban' ? <UserX className="w-5 h-5" /> : <UserCheck className="w-5 h-5" />}
                </div>
                <h3 className="text-base font-bold text-slate-100">
                  {banModal.action === 'ban' ? 'Suspend Account' : 'Restore Account'}
                </h3>
              </div>
              <button
                onClick={() => setBanModal({ isOpen: false, user: null, action: 'ban' })}
                className="p-1 text-slate-400 hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              {banModal.action === 'ban'
                ? `Are you sure you want to ban "${banModal.user.name}"? They will be immediately blocked from logging in to the website until unbanned.`
                : `Are you sure you want to unban "${banModal.user.name}"? They will regain access to authenticate into the platform.`}
            </p>

            <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 text-xs space-y-1">
              <p className="text-slate-300 font-semibold">{banModal.user.name} ({banModal.user.email})</p>
              <p className="text-slate-500 text-[11px]">
                Role: {banModal.user.role || 'Fan'} • Honor: {banModal.user.honor || 'Good'} • Images: {banModal.user.uploaded_image_count} • Messages: {banModal.user.uploaded_message_count} • Violations: {banModal.user.reported_inappropriate_count}
              </p>
            </div>

            <div className="flex items-center justify-end space-x-2 pt-2">
              <button
                type="button"
                onClick={() => setBanModal({ isOpen: false, user: null, action: 'ban' })}
                className="px-3.5 py-2 bg-slate-800 text-slate-300 text-xs font-semibold rounded-xl"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmBanToggle}
                disabled={actionLoading}
                className={`px-4 py-2 text-white text-xs font-bold rounded-xl shadow-lg flex items-center space-x-1.5 ${
                  banModal.action === 'ban'
                    ? 'bg-rose-600 hover:bg-rose-500 shadow-rose-600/25'
                    : 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-600/25'
                }`}
              >
                {actionLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : null}
                <span>{banModal.action === 'ban' ? 'Confirm Ban' : 'Confirm Unban'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Register / Edit Party */}
      {isPartyModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-fade-in">
          <div className="relative w-full max-w-3xl bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden p-6 sm:p-8 max-h-[90vh] overflow-y-auto space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center space-x-2.5">
                <div className="p-2 bg-cyan-500/10 text-cyan-400 rounded-xl">
                  <PlusCircle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-100">
                    {editingParty ? `Edit "${editingParty.name}"` : 'Register New Party'}
                  </h3>
                  <p className="text-xs text-slate-400">Configure Party details, hero image, tapestry title, and interactive settings</p>
                </div>
              </div>
              <button
                onClick={() => setIsPartyModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveParty} className="space-y-5">
              {/* Hero Image Studio & Live Preview */}
              <div className="space-y-3 bg-slate-950/60 p-4 rounded-2xl border border-slate-800">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold text-cyan-300 uppercase tracking-wider">
                    Hero Image (Primary Banner) <span className="text-rose-400">*</span>
                  </label>
                  <span className="text-[10px] text-slate-500">1920 × 1080 Recommended</span>
                </div>

                {/* Live Mockup Preview of Hero Banner */}
                <div className="relative h-44 rounded-xl overflow-hidden border border-slate-700 bg-slate-950 shadow-inner group">
                  {formData.hero_image ? (
                    <img
                      src={formData.hero_image}
                      alt="Hero Preview"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-slate-600 text-xs">
                      No Hero Image Selected
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/40 to-transparent" />
                  <div className="absolute bottom-3 left-4 right-4">
                    <span className="px-2 py-0.5 rounded bg-cyan-950/80 text-cyan-300 text-[10px] font-bold border border-cyan-800/80 mb-1 inline-block">
                      LIVE PREVIEW
                    </span>
                    <p className="text-base font-extrabold text-white truncate drop-shadow">
                      {formData.name || 'Party Name Preview'}
                    </p>
                  </div>
                </div>

                {/* Upload & Presets Controls */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                  {/* File Upload Button */}
                  <div>
                    <input
                      ref={heroFileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={(e) => e.target.files && handleHeroFileUpload(e.target.files[0])}
                      className="hidden"
                    />
                    <button
                      type="button"
                      onClick={() => heroFileInputRef.current?.click()}
                      disabled={uploadingHero}
                      className="w-full py-2.5 px-3 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold border border-slate-700 flex items-center justify-center space-x-2 transition-colors"
                    >
                      {uploadingHero ? (
                        <RefreshCw className="w-4 h-4 animate-spin text-cyan-400" />
                      ) : (
                        <UploadCloud className="w-4 h-4 text-cyan-400" />
                      )}
                      <span>{uploadingHero ? 'Uploading to Server...' : 'Upload File from Computer'}</span>
                    </button>
                  </div>

                  {/* Image Path / URL input */}
                  <div>
                    <input
                      type="text"
                      placeholder="Image path or URL..."
                      value={formData.hero_image}
                      onChange={(e) => setFormData({ ...formData, hero_image: e.target.value })}
                      className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 focus:border-cyan-500 focus:outline-none"
                    />
                  </div>
                </div>

                {/* Sample Presets */}
                <div>
                  <span className="text-[10px] text-slate-500 block mb-1.5">Or Choose Curated Preset:</span>
                  <div className="grid grid-cols-4 gap-2">
                    {HERO_PRESETS.map((preset) => (
                      <button
                        key={preset.name}
                        type="button"
                        onClick={() => setFormData({ ...formData, hero_image: preset.url })}
                        className={`relative rounded-lg overflow-hidden border p-0.5 text-left transition-all ${
                          formData.hero_image === preset.url ? 'border-cyan-400 ring-1 ring-cyan-400' : 'border-slate-800 opacity-60 hover:opacity-100'
                        }`}
                      >
                        <img src={preset.url} alt={preset.name} className="w-full h-8 object-cover rounded" />
                        <span className="text-[9px] text-slate-300 block truncate mt-0.5 px-0.5">{preset.name}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Name, Tapestry Title, and Slug */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Party Name <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 focus:border-cyan-500 focus:outline-none"
                    placeholder="e.g. Neon Horizon Fest 2026"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Tapestry Title <span className="text-[10px] text-cyan-400 font-normal">(Admin Only)</span>
                  </label>
                  <input
                    type="text"
                    value={formData.tapestry_title}
                    onChange={(e) => setFormData({ ...formData, tapestry_title: e.target.value })}
                    className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 focus:border-cyan-500 focus:outline-none"
                    placeholder={formData.name ? `${formData.name} Tapestry` : 'Tapestry Header Title'}
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Custom Slug (Optional)
                  </label>
                  <input
                    type="text"
                    value={formData.slug}
                    onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                    className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 focus:border-cyan-500 focus:outline-none"
                    placeholder="neon-horizon-fest"
                  />
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Description Text Box <span className="text-rose-400">*</span>
                </label>
                <textarea
                  rows={3}
                  required
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 focus:border-cyan-500 focus:outline-none resize-none"
                  placeholder="Describe the party purpose, rules, and vibe..."
                />
              </div>

              {/* Tags */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Tags (Comma-separated) <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.tags}
                  onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
                  className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 focus:border-cyan-500 focus:outline-none"
                  placeholder="Tech, Art, Music, Future"
                />
              </div>

              {/* Gallery Images Uploader (Direct File Uploads Required) */}
              <div className="space-y-3 bg-slate-950/60 p-4 rounded-2xl border border-slate-800">
                <div className="flex items-center justify-between">
                  <div>
                    <label className="block text-xs font-bold text-slate-200">
                      Gallery Images (Uploaded Files Only)
                    </label>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Upload photos directly from your computer. Direct external links are disallowed.
                    </p>
                  </div>

                  {/* Hidden multi-file input */}
                  <input
                    ref={galleryFileInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={(e) => e.target.files && handleGalleryFilesUpload(e.target.files)}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => galleryFileInputRef.current?.click()}
                    disabled={uploadingGallery}
                    className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-slate-700 rounded-xl text-xs font-semibold flex items-center space-x-1.5 transition-colors shadow-sm"
                  >
                    {uploadingGallery ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin text-cyan-400" />
                    ) : (
                      <UploadCloud className="w-3.5 h-3.5 text-cyan-400" />
                    )}
                    <span>{uploadingGallery ? 'Uploading...' : '+ Upload Images'}</span>
                  </button>
                </div>

                {/* Uploaded Gallery Thumbnails Grid */}
                {formData.gallery_images && formData.gallery_images.length > 0 ? (
                  <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2.5 pt-2">
                    {formData.gallery_images.map((imgUrl, idx) => (
                      <div
                        key={idx}
                        className="relative group aspect-square rounded-xl overflow-hidden border border-slate-700 bg-slate-950"
                      >
                        <img
                          src={imgUrl}
                          alt={`Uploaded Gallery ${idx + 1}`}
                          className="w-full h-full object-cover"
                        />
                        <button
                          type="button"
                          onClick={() => handleRemoveGalleryImage(idx)}
                          className="absolute top-1 right-1 p-1 bg-rose-600 hover:bg-rose-500 text-white rounded-lg opacity-0 group-hover:opacity-100 transition-opacity shadow-md"
                          title="Remove Image"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div
                    onClick={() => galleryFileInputRef.current?.click()}
                    className="p-4 border border-dashed border-slate-800 rounded-xl text-center text-slate-500 text-xs cursor-pointer hover:border-slate-700 transition-colors"
                  >
                    No gallery images uploaded yet. Click "+ Upload Images" above to add photos.
                  </div>
                )}
              </div>

              {/* Social Links */}
              <div className="pt-2 border-t border-slate-800">
                <span className="text-xs font-bold text-slate-300 uppercase tracking-wider block mb-2">
                  Social Links
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <input
                    type="text"
                    placeholder="Website (e.g. example.com or https://...)"
                    value={formData.website}
                    onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                    className="p-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 focus:border-cyan-500"
                  />
                  <input
                    type="text"
                    placeholder="Twitter/X (e.g. x.com/party)"
                    value={formData.twitter}
                    onChange={(e) => setFormData({ ...formData, twitter: e.target.value })}
                    className="p-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 focus:border-cyan-500"
                  />
                  <input
                    type="text"
                    placeholder="Bluesky (e.g. https://bsky.app/profile/username.bsky.social or username.bsky.social)"
                    value={formData.bluesky}
                    onChange={(e) => setFormData({ ...formData, bluesky: e.target.value })}
                    className="p-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 focus:border-cyan-500"
                  />
                  <input
                    type="text"
                    placeholder="Instagram (e.g. instagram.com/party)"
                    value={formData.instagram}
                    onChange={(e) => setFormData({ ...formData, instagram: e.target.value })}
                    className="p-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 focus:border-cyan-500"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end space-x-2 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsPartyModalOpen(false)}
                  className="px-4 py-2 bg-slate-800 text-slate-300 text-xs font-semibold rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading || uploadingHero || uploadingGallery}
                  className="px-5 py-2 bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-cyan-500/25 flex items-center space-x-1.5"
                >
                  {actionLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : null}
                  <span>{editingParty ? 'Save Changes' : 'Register Party'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Review Modal */}
      {reviewModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-fade-in">
          <div className="relative w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
                {reviewModal.action === 'agree' ? (
                  <>
                    <XCircle className="w-5 h-5 text-rose-400" />
                    <span>Confirm Tombstone & Ban</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                    <span>Bless & Restore Access</span>
                  </>
                )}
              </h3>
              <button
                onClick={() => setReviewModal({ ...reviewModal, isOpen: false })}
                className="p-1 text-slate-400 hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-400 leading-relaxed">
              {reviewModal.action === 'agree'
                ? `This ${reviewModal.type} will be marked as Banned and permanently hidden from public users.`
                : `This ${reviewModal.type} will be blessed and restored to public view. The reporter's Honor will decrease.`}
            </p>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Moderation Explanation:
              </label>
              <textarea
                rows={2}
                value={reviewModal.reason}
                onChange={(e) => setReviewModal({ ...reviewModal, reason: e.target.value })}
                className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 focus:outline-none focus:border-cyan-500 resize-none"
              />
            </div>

            <div className="flex items-center justify-end space-x-2 pt-2">
              <button
                type="button"
                onClick={() => setReviewModal({ ...reviewModal, isOpen: false })}
                className="px-3.5 py-2 bg-slate-800 text-slate-300 text-xs font-semibold rounded-xl"
              >
                Cancel
              </button>
              <button
                type="submit"
                onClick={handleSubmitReview}
                disabled={actionLoading}
                className={`px-4 py-2 text-white text-xs font-bold rounded-xl shadow-lg flex items-center space-x-1.5 ${
                  reviewModal.action === 'agree'
                    ? 'bg-rose-600 hover:bg-rose-500 shadow-rose-600/25'
                    : 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-600/25'
                }`}
              >
                {actionLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : null}
                <span>{reviewModal.action === 'agree' ? 'Tombstone (Ban)' : 'Bless & Demote Reporter Honor'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
