import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  Search,
  Tag,
  LayoutGrid,
  Table as TableIcon,
  PlusCircle,
  Sparkles,
  Layers,
  MessageSquare,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Filter,
  RefreshCw,
  ExternalLink,
  ShieldCheck
} from 'lucide-react';

export default function PartyDirectory({ onSelectParty, onOpenCreateParty }) {
  const { isAdmin } = useAuth();

  const [parties, setParties] = useState([]);
  const [availableTags, setAvailableTags] = useState([]);
  const [search, setSearch] = useState('');
  const [selectedTag, setSelectedTag] = useState('');
  const [sort, setSort] = useState('newest');
  const [viewMode, setViewMode] = useState('grid'); // 'grid' | 'table'
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalParties, setTotalParties] = useState(0);
  const [loading, setLoading] = useState(true);

  // Fetch tags
  useEffect(() => {
    async function loadTags() {
      try {
        const res = await fetch('/api/parties/tags');
        const data = await res.json();
        setAvailableTags(data.tags || []);
      } catch (err) {
        console.error('Failed to load tags:', err);
      }
    }
    loadTags();
  }, []);

  // Fetch parties
  const fetchParties = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '9',
        sort
      });
      if (search.trim()) params.append('search', search.trim());
      if (selectedTag) params.append('tag', selectedTag);

      const res = await fetch(`/api/parties?${params.toString()}`);
      const data = await res.json();

      setParties(data.parties || []);
      setTotalPages(data.totalPages || 1);
      setTotalParties(data.total || 0);
    } catch (err) {
      console.error('Failed to load parties:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchParties();
  }, [page, sort, selectedTag]);

  // Debounced search trigger
  useEffect(() => {
    const timer = setTimeout(() => {
      setPage(1);
      fetchParties();
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  return (
    <div className="max-w-7xl mx-auto space-y-8 animate-fade-in">
      {/* Hero Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900/60 p-6 sm:p-8 rounded-3xl border border-slate-800 backdrop-blur-sm shadow-xl">
        <div>
          <div className="flex items-center space-x-2 text-cyan-400 font-semibold text-xs uppercase tracking-wider mb-1.5">
            <Sparkles className="w-4 h-4" />
            <span>Discover & Join Spaces</span>
          </div>
          <h1 className="text-3xl font-extrabold text-slate-100 tracking-tight">
            Parties Directory
          </h1>
          <p className="text-sm text-slate-400 mt-1 max-w-xl leading-relaxed">
            Browse collaborative parties, view dedicated tapestries, upload your badged photos, and join real-time live feeds.
          </p>
        </div>

        {isAdmin && (
          <button
            onClick={onOpenCreateParty}
            className="px-4 py-3 bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-white text-xs font-bold rounded-2xl shadow-lg shadow-cyan-500/25 flex items-center space-x-2 transition-all flex-shrink-0"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Create New Party</span>
          </button>
        )}
      </div>

      {/* Filters & Search Toolbar */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-lg space-y-4">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          {/* Search Bar */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search parties by name or description..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500 transition-colors"
            />
          </div>

          {/* Sort & View Mode Switches */}
          <div className="flex items-center space-x-2">
            <select
              value={sort}
              onChange={(e) => {
                setSort(e.target.value);
                setPage(1);
              }}
              className="px-3 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
            >
              <option value="newest">Sort: Newest First</option>
              <option value="images">Sort: Most Images</option>
              <option value="messages">Sort: Most Messages</option>
              <option value="name">Sort: Alphabetical (A-Z)</option>
            </select>

            <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800">
              <button
                onClick={() => setViewMode('grid')}
                className={`p-1.5 rounded-lg transition-colors ${
                  viewMode === 'grid'
                    ? 'bg-cyan-500 text-slate-950 font-bold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
                title="Grid Cards View"
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode('table')}
                className={`p-1.5 rounded-lg transition-colors ${
                  viewMode === 'table'
                    ? 'bg-cyan-500 text-slate-950 font-bold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
                title="Table View"
              >
                <TableIcon className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Tag Filters Strip */}
        {availableTags.length > 0 && (
          <div className="flex items-center space-x-2 overflow-x-auto pt-2 border-t border-slate-800/80 pb-1">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1 flex-shrink-0">
              <Tag className="w-3 h-3" />
              Tags:
            </span>
            <button
              onClick={() => {
                setSelectedTag('');
                setPage(1);
              }}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-all flex-shrink-0 ${
                !selectedTag
                  ? 'bg-cyan-500 text-slate-950 font-bold shadow-sm'
                  : 'bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800'
              }`}
            >
              All
            </button>
            {availableTags.map((t) => (
              <button
                key={t.name}
                onClick={() => {
                  setSelectedTag(selectedTag === t.name ? '' : t.name);
                  setPage(1);
                }}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-all flex-shrink-0 flex items-center space-x-1.5 ${
                  selectedTag === t.name
                    ? 'bg-cyan-500 text-slate-950 font-bold shadow-sm'
                    : 'bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800'
                }`}
              >
                <span>{t.name}</span>
                <span className="text-[10px] opacity-70">({t.count})</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Directory Content */}
      {loading ? (
        <div className="h-64 flex flex-col items-center justify-center bg-slate-900/40 border border-slate-800 rounded-3xl">
          <RefreshCw className="w-8 h-8 text-cyan-400 animate-spin mb-3" />
          <p className="text-xs text-slate-400">Loading parties directory...</p>
        </div>
      ) : parties.length === 0 ? (
        <div className="p-12 text-center bg-slate-900/40 border border-dashed border-slate-800 rounded-3xl space-y-3">
          <Sparkles className="w-10 h-10 text-slate-600 mx-auto" />
          <h3 className="text-base font-bold text-slate-200">No Parties Found</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            Try adjusting your search criteria or clearing tag filters.
          </p>
        </div>
      ) : viewMode === 'grid' ? (
        /* Grid Cards View */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {parties.map((party) => (
            <div
              key={party.id}
              onClick={() => onSelectParty(party)}
              className="group bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden hover:border-cyan-500/60 transition-all duration-300 shadow-xl flex flex-col cursor-pointer hover:-translate-y-1"
            >
              {/* Hero Image */}
              <div className="relative aspect-[16/9] overflow-hidden bg-slate-950">
                <img
                  src={party.hero_image}
                  alt={party.name}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/40 to-transparent" />

                {/* Badge tags overlay */}
                <div className="absolute bottom-3 left-3 right-3 flex flex-wrap gap-1.5">
                  {(party.tags || []).slice(0, 3).map((tag) => (
                    <span
                      key={tag}
                      className="px-2 py-0.5 rounded-md bg-slate-900/80 backdrop-blur-sm border border-slate-700/80 text-[10px] font-bold text-cyan-300"
                    >
                      #{tag}
                    </span>
                  ))}
                  {(party.tags || []).length > 3 && (
                    <span className="px-2 py-0.5 rounded-md bg-slate-900/80 backdrop-blur-sm border border-slate-700/80 text-[10px] font-bold text-slate-400">
                      +{(party.tags || []).length - 3}
                    </span>
                  )}
                </div>
              </div>

              {/* Body */}
              <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
                <div>
                  <h3 className="text-base font-bold text-slate-100 group-hover:text-cyan-300 transition-colors line-clamp-1">
                    {party.name}
                  </h3>
                  <p className="text-xs text-slate-400 mt-1.5 line-clamp-2 leading-relaxed">
                    {party.description || 'No description provided.'}
                  </p>
                </div>

                {/* Stats & Enter Action */}
                <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between">
                  <div className="flex items-center space-x-3 text-xs text-slate-400">
                    <span className="flex items-center space-x-1" title="Contributed Images">
                      <Layers className="w-3.5 h-3.5 text-cyan-400" />
                      <span>{party.images_count}</span>
                    </span>
                    <span className="flex items-center space-x-1" title="Live Feed Messages">
                      <MessageSquare className="w-3.5 h-3.5 text-indigo-400" />
                      <span>{party.messages_count}</span>
                    </span>
                  </div>

                  <span className="inline-flex items-center space-x-1 text-xs font-bold text-cyan-400 group-hover:translate-x-1 transition-transform">
                    <span>Enter Party</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* Table View */
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-950/60 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  <th className="py-3.5 px-4">Party</th>
                  <th className="py-3.5 px-4">Tags</th>
                  <th className="py-3.5 px-4 text-center">Images</th>
                  <th className="py-3.5 px-4 text-center">Messages</th>
                  <th className="py-3.5 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 text-xs">
                {parties.map((party) => (
                  <tr
                    key={party.id}
                    onClick={() => onSelectParty(party)}
                    className="hover:bg-slate-800/50 cursor-pointer transition-colors group"
                  >
                    <td className="py-3.5 px-4 flex items-center space-x-3.5">
                      <img
                        src={party.hero_image}
                        alt={party.name}
                        className="w-12 h-12 rounded-xl object-cover border border-slate-800 flex-shrink-0"
                      />
                      <div className="min-w-0">
                        <p className="font-bold text-slate-200 group-hover:text-cyan-300 truncate">
                          {party.name}
                        </p>
                        <p className="text-[11px] text-slate-400 truncate max-w-xs">
                          {party.description}
                        </p>
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="flex flex-wrap gap-1">
                        {(party.tags || []).slice(0, 3).map((tag) => (
                          <span
                            key={tag}
                            className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 text-[10px]"
                          >
                            #{tag}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-center font-semibold text-slate-300">
                      {party.images_count}
                    </td>
                    <td className="py-3.5 px-4 text-center font-semibold text-slate-300">
                      {party.messages_count}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <span className="inline-flex items-center space-x-1 px-3 py-1 bg-slate-800 group-hover:bg-cyan-500 group-hover:text-slate-950 text-slate-200 font-bold rounded-lg transition-colors">
                        <span>Open</span>
                        <ArrowRight className="w-3 h-3" />
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Pagination Footer */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-4 border-t border-slate-800/80">
          <span className="text-xs text-slate-400">
            Showing page <span className="text-slate-200 font-bold">{page}</span> of{' '}
            <span className="text-slate-200 font-bold">{totalPages}</span> ({totalParties} Parties)
          </span>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="p-2 bg-slate-900 hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed text-slate-300 border border-slate-800 rounded-xl transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="p-2 bg-slate-900 hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed text-slate-300 border border-slate-800 rounded-xl transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
