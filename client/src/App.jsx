import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import Navbar from './components/Navbar';
import AuthModal from './components/AuthModal';
import ReportModal from './components/ReportModal';
import PartyDirectory from './components/PartyDirectory';
import PartyDetailView from './components/PartyDetailView';
import AdminDashboard from './components/AdminDashboard';

function MainApp() {
  const { user, isAdmin } = useAuth();
  const [activeTab, setActiveTab] = useState('parties');
  const [selectedParty, setSelectedParty] = useState(null);
  const [sseConnected, setSseConnected] = useState(false);

  // Auto-redirect guards
  useEffect(() => {
    if (!isAdmin && (activeTab === 'registry' || activeTab === 'admin')) {
      setActiveTab('parties');
    }
  }, [isAdmin, activeTab]);

  // Moderation Report Modal state
  const [reportState, setReportState] = useState({
    isOpen: false,
    targetEntity: null,
    onReportSubmitted: null
  });

  // Global Server-Sent Events (SSE) listener
  useEffect(() => {
    let eventSource = null;
    let retryTimeout = null;

    const connectSSE = () => {
      try {
        eventSource = new EventSource('/api/messages/stream');

        eventSource.onopen = () => {
          setSseConnected(true);
        };

        eventSource.addEventListener('message', (event) => {
          try {
            const data = JSON.parse(event.data);
          } catch (e) {
            console.error('Error parsing SSE event data:', e);
          }
        });

        eventSource.addEventListener('content_reported', (event) => {
          try {
            const data = JSON.parse(event.data);
            window.dispatchEvent(new CustomEvent('tapestry_moderation_event', { detail: { type: 'content_reported', payload: data.payload || data } }));
          } catch (e) {
            console.error('Error parsing content_reported SSE event:', e);
          }
        });

        eventSource.addEventListener('content_reviewed', (event) => {
          try {
            const data = JSON.parse(event.data);
            window.dispatchEvent(new CustomEvent('tapestry_moderation_event', { detail: { type: 'content_reviewed', payload: data.payload || data } }));
          } catch (e) {
            console.error('Error parsing content_reviewed SSE event:', e);
          }
        });

        eventSource.onerror = () => {
          setSseConnected(false);
          eventSource.close();
          retryTimeout = setTimeout(connectSSE, 5000);
        };
      } catch (err) {
        console.error('SSE initialization error:', err);
        setSseConnected(false);
        retryTimeout = setTimeout(connectSSE, 5000);
      }
    };

    connectSSE();

    return () => {
      if (eventSource) eventSource.close();
      if (retryTimeout) clearTimeout(retryTimeout);
    };
  }, []);

  const handleSelectParty = (party) => {
    setSelectedParty(party);
    setActiveTab('party-detail');
  };

  const handleOpenReport = (entity, onSubmitted) => {
    setReportState({
      isOpen: true,
      targetEntity: entity,
      onReportSubmitted: onSubmitted || null
    });
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-950 text-slate-100 selection:bg-cyan-500 selection:text-white">
      {/* Top Navigation */}
      <Navbar
        activeTab={activeTab === 'party-detail' ? 'parties' : activeTab}
        setActiveTab={(tab) => {
          if (tab !== 'party-detail') setSelectedParty(null);
          setActiveTab(tab);
        }}
        sseConnected={sseConnected}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10">
        {activeTab === 'parties' && (
          <PartyDirectory
            onSelectParty={handleSelectParty}
            onOpenCreateParty={() => setActiveTab('registry')}
          />
        )}

        {activeTab === 'party-detail' && selectedParty && (
          <PartyDetailView
            party={selectedParty}
            onBack={() => {
              setSelectedParty(null);
              setActiveTab('parties');
            }}
            onOpenReport={handleOpenReport}
            sseConnected={sseConnected}
          />
        )}

        {(activeTab === 'registry' || activeTab === 'admin') && isAdmin && (
          <AdminDashboard
            onSelectParty={handleSelectParty}
            onPartyUpdated={() => {}}
          />
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-900 bg-slate-950/80 py-6 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <p>© 2026 Tapestry Web Server • Parties, Sharp Compositing & Content Moderation</p>
          <div className="flex items-center space-x-4 text-slate-400">
            <span>Node.js / Express</span>
            <span>•</span>
            <span>SQLite</span>
            <span>•</span>
            <span>React + Vite</span>
          </div>
        </div>
      </footer>

      {/* Modals */}
      <AuthModal />
      <ReportModal
        isOpen={reportState.isOpen}
        targetEntity={reportState.targetEntity}
        onClose={() => setReportState({ isOpen: false, targetEntity: null, onReportSubmitted: null })}
        onReportSubmitted={(entity) => {
          if (reportState.onReportSubmitted) {
            reportState.onReportSubmitted(entity);
          }
        }}
      />
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <MainApp />
    </AuthProvider>
  );
}
