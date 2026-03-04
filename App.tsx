import React, { useState, useEffect } from 'react';
import { PlantAnalysisResult, HistoryItem, PlantFolder } from './types';
import {
  analyzeImage,
  DiseaseReport,
  fetchHistory,
  saveScanToDB,
  deleteScanFromDB,
  moveScanFolder,
  fetchFolders,
  createFolderInDB,
  deleteFolderFromDB,
} from './services/backendService';
import { useAuth } from './contexts/AuthContext';
import { AuthModal } from './components/AuthModal';
import { LandingPage } from './components/LandingPage';
import { ImageUpload } from './components/ImageUpload';
import { AnalysisResult } from './components/AnalysisResult';
import { HistoryView } from './components/HistoryView';
import { ChatInterface } from './components/ChatInterface';
import { CameraCapture } from './components/CameraCapture';
import { AdminLogin } from './components/AdminLogin';
import { AdminDashboard } from './components/AdminDashboard';
import { CropRecommendation } from './components/CropRecommendation';
import { ScanAnimation } from './components/ScanAnimation';
import { Sprout, Loader2, Leaf, Sun, History as HistoryIcon, ArrowLeft, LogOut, Wheat } from 'lucide-react';

/**
 * Maps a DiseaseReport (from the local backend) to a PlantAnalysisResult
 * (which the existing UI components expect).
 */
const mapReportToResult = (report: DiseaseReport): PlantAnalysisResult => ({
  isPlant: report.isPlant,
  plantName: report.plantName,
  confidence: report.confidence,
  alternatives: report.alternatives || [],
  issues: report.issues,
  diagnosis: report.diagnosis,
  treatmentPlan: report.treatmentPlan || [],
  preventionTips: report.preventionTips || [],
  expertResources: report.expertResources || [],
});

const App: React.FC = () => {
  const [analyzing, setAnalyzing] = useState(false);
  const [results, setResults] = useState<PlantAnalysisResult[] | null>(null);
  const [currentImage, setCurrentImage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminChecked, setAdminChecked] = useState(false);
  const [showCropRec, setShowCropRec] = useState(false);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [folders, setFolders] = useState<PlantFolder[]>([]);

  // Auth State
  const { user, logout, isCheckingSession: authLoading } = useAuth();
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);

  // Load history + folders from MySQL when user logs in / changes
  useEffect(() => {
    if (authLoading) return;

    // Reset views on user switch
    setResults(null);
    setCurrentImage(null);
    setShowHistory(false);
    setShowCamera(false);
    setShowCropRec(false);

    if (!user) {
      // Guest — clear any stale data
      setHistory([]);
      setFolders([]);
      return;
    }

    // Logged in — fetch from MySQL
    // Small delay ensures the auth cookie from login response is fully set
    const timer = setTimeout(async () => {
      try {
        const [h, f] = await Promise.all([fetchHistory(), fetchFolders()]);
        setHistory(h);
        setFolders(f);
      } catch (err) {
        console.error('[App] Failed to load history/folders:', err);
      }
    }, 100);

    return () => clearTimeout(timer);
  }, [user, authLoading]);

  // ── History helpers (MySQL) ──────────────────────────────────────────────

  const clearHistory = () => {
    // No bulk-delete API — just reload (user can delete individually in HistoryView)
    if (confirm("Reload history from database?")) {
      if (user) fetchHistory().then(setHistory).catch(console.error);
      else setHistory([]);
    }
  };

  // ── Folder helpers (MySQL) ───────────────────────────────────────────────

  const createFolder = async (name: string) => {
    if (!user) return;
    try {
      const newFolder = await createFolderInDB(name);
      setFolders(prev => [newFolder, ...prev]);
    } catch (e) {
      console.error('Failed to create folder', e);
    }
  };

  const deleteFolder = async (folderId: string) => {
    if (!user) return;
    if (!confirm("Delete this folder? Scans inside will remain in history but be ungrouped.")) return;
    try {
      await deleteFolderFromDB(folderId);
      setFolders(prev => prev.filter(f => f.id !== folderId));
      // Ungroup scans locally without a full reload
      setHistory(prev => prev.map(item =>
        item.folderId === folderId ? { ...item, folderId: undefined } : item
      ));
    } catch (e) {
      console.error('Failed to delete folder', e);
    }
  };

  const moveItemsToFolder = async (itemIds: string[], folderId: string | undefined) => {
    if (!user) return;
    try {
      // Fire all PATCH requests in parallel
      await Promise.all(itemIds.map(id => moveScanFolder(id, folderId ?? null)));
      // Update local state
      setHistory(prev => prev.map(item =>
        itemIds.includes(item.id) ? { ...item, folderId } : item
      ));
    } catch (e) {
      console.error('Failed to move items to folder', e);
    }
  };

  const deleteItem = async (itemId: string) => {
    if (!user) return;
    try {
      await deleteScanFromDB(itemId);
      setHistory(prev => prev.filter(item => item.id !== itemId));
    } catch (e) {
      console.error('Failed to delete scan', e);
    }
  };

  const handleImageSelect = async (base64Image: string) => {
    setAnalyzing(true);
    setCurrentImage(base64Image);
    setError(null);
    setShowHistory(false);
    setShowCropRec(false);
    try {
      const reports = await analyzeImage(base64Image);
      const data = reports.map(mapReportToResult);
      setResults(data);

      // Only save to DB if the user is logged in
      if (user) {
        const saved = await saveScanToDB(base64Image, reports); // saves image + results
        setHistory(prev => [saved, ...prev]);
      }
    } catch (err: any) {
      setError(err.message || "Something went wrong. Please try again.");
    } finally {
      setAnalyzing(false);
    }
  };

  const handleReset = () => {
    setResults(null);
    setCurrentImage(null);
    setError(null);
    setShowHistory(false);
    setShowCamera(false);
    setShowCropRec(false);
  };

  const handleHistorySelect = (item: HistoryItem) => {
    setResults(item.results);
    // Use the saved image URL from DB if available (e.g. /uploads/{user_id}/{scan_id}.jpg)
    setCurrentImage(item.imageUrl || null);
    setShowHistory(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Close profile menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest('.profile-menu-container')) {
        setShowProfileMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // ── Admin session check ────────────────────────────────────────────────
  useEffect(() => {
    fetch('/api/admin/me', { credentials: 'include' })
      .then(r => r.ok ? r.json() : null)
      .then(a => { setIsAdmin(!!a); setAdminChecked(true); })
      .catch(() => setAdminChecked(true));
  }, []);

  // ── Admin Route Gate ────────────────────────────────────────────────
  if (window.location.pathname.startsWith('/admin')) {
    if (!adminChecked) return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <div className="w-10 h-10 border-4 border-emerald-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
    if (!isAdmin) return <AdminLogin onSuccess={() => setIsAdmin(true)} />;
    return <AdminDashboard onLogout={() => { setIsAdmin(false); window.location.href = '/'; }} />;
  }

  // ── Mandatory Auth Gate ────────────────────────────────────────────────
  // While the cookie session is being verified, show a spinner
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-emerald-50">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-emerald-700 font-medium text-sm">Loading UZHAVAN AI...</p>
        </div>
      </div>
    );
  }

  // Once session check is complete — show landing page to guests (auth is MANDATORY)
  if (!user) {
    return <LandingPage />;
  }

  // ── Camera Fullscreen ────────────────────────────────────────────────
  if (showCamera) {
    return (
      <CameraCapture
        onCapture={(base64) => {
          setShowCamera(false);
          handleImageSelect(base64);
        }}
        onClose={() => setShowCamera(false)}
      />
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-teal-50 to-white text-gray-800 font-sans">

      {/* Navigation / Header */}
      <nav className="p-4 sm:p-6 sticky top-0 z-50 bg-white/80 backdrop-blur-xl border-b border-emerald-100/50 shadow-sm transition-all duration-300 animate-slide-down">
        <div className="max-w-6xl mx-auto flex items-center justify-between">

          {/* New Logo Implementation with Animations */}
          <div className="flex items-center gap-3 cursor-pointer group select-none" onClick={handleReset}>
            {/* Logo Icon */}
            <div className="bg-gradient-to-br from-emerald-400 to-emerald-600 p-2.5 rounded-2xl text-white shadow-lg shadow-emerald-200 group-hover:shadow-emerald-300 transition-all duration-500 ease-out group-hover:scale-105 group-hover:rotate-6">
              <Leaf size={26} strokeWidth={2.5} className="fill-white/10" />
            </div>

            {/* Logo Text */}
            <div className="flex flex-col">
              <div className="text-2xl font-bold tracking-tight leading-none text-gray-900 transition-all duration-300">
                <span className="group-hover:text-emerald-600 transition-colors">UZHAVAN</span>
                <span className="text-emerald-600 group-hover:text-gray-900 transition-colors"> AI</span>
              </div>
              <span className="text-[0.65rem] font-bold text-gray-400 tracking-[0.2em] uppercase leading-none mt-1 group-hover:tracking-[0.25em] group-hover:text-emerald-500/80 transition-all duration-500">
                AI Crop Disease Expert
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-4">
            {!analyzing && (results || showHistory || showCropRec) && (
              <button
                onClick={handleReset}
                className="flex items-center gap-2 text-sm font-medium text-gray-500 hover:text-emerald-600 transition-all duration-200 hover:-translate-x-1"
              >
                <ArrowLeft size={18} />
                <span className="hidden sm:inline">Back to Scan</span>
                <span className="sm:hidden">Back</span>
              </button>
            )}

            {/* Crop Advice Tab */}
            <button
              onClick={() => {
                setShowCropRec(!showCropRec);
                setShowHistory(false);
                setResults(null);
                setCurrentImage(null);
                setError(null);
              }}
              className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold transition-all duration-300 transform active:scale-95 ${showCropRec
                ? 'bg-amber-100 text-amber-700 ring-2 ring-amber-200 shadow-sm'
                : 'bg-white text-gray-600 hover:bg-amber-50 hover:text-amber-600 hover:shadow-md hover:-translate-y-0.5 border border-transparent hover:border-amber-100'
                }`}
            >
              <Wheat size={18} />
              <span className="hidden sm:inline">Crop Advice</span>
            </button>


            <button
              onClick={() => {
                setShowHistory(!showHistory);
                setShowCropRec(false);
                setResults(null);
                setCurrentImage(null);
                setError(null);
              }}
              className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold transition-all duration-300 transform active:scale-95 ${showHistory
                ? 'bg-blue-100 text-blue-700 ring-2 ring-blue-200 shadow-sm'
                : 'bg-white text-gray-600 hover:bg-blue-50 hover:text-blue-600 hover:shadow-md hover:-translate-y-0.5 border border-transparent hover:border-blue-100'
                }`}
            >
              <HistoryIcon size={18} />
              <span className="hidden sm:inline">History</span>
            </button>

            {/* Sign In button — shown only to guests */}
            {!user && !authLoading && (
              <button
                onClick={() => setShowAuthModal(true)}
                className="px-4 py-2 rounded-full text-sm font-semibold bg-emerald-600 text-white hover:bg-emerald-700 shadow-md shadow-emerald-200 transition-all duration-200 active:scale-95"
              >
                Sign In
              </button>
            )}

            {/* User Profile — shown when logged in */}
            <div className="relative profile-menu-container">
              {user && (
                <button
                  onClick={() => setShowProfileMenu(!showProfileMenu)}
                  className="flex items-center gap-2 pl-2 pr-1 py-1 rounded-full bg-white border border-gray-100 hover:shadow-md hover:ring-2 hover:ring-emerald-100 transition-all duration-300"
                >
                  <span className="text-sm font-medium text-gray-700 hidden sm:block pl-2">{user.name.split(' ')[0]}</span>
                  <img src={user.avatar} alt={user.name} className="w-8 h-8 rounded-full bg-gray-200 border border-white" />
                </button>
              )}

              {/* Profile Dropdown */}
              {showProfileMenu && user && (
                <div className="absolute right-0 top-full mt-2 w-56 bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden animate-fade-in-up z-50 origin-top-right">
                  <div className="p-4 border-b border-gray-100 bg-gray-50/50">
                    <p className="font-bold text-gray-800">{user.name}</p>
                    <p className="text-xs text-gray-500 truncate">{user.email}</p>
                  </div>
                  <div className="p-2">
                    <button
                      onClick={() => {
                        logout();
                        setShowProfileMenu(false);
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-xl transition-colors font-medium"
                    >
                      <LogOut size={16} />
                      Sign Out
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </nav >

      {/* Main Content */}
      < main className="container mx-auto px-4 py-8" >

        {/* State: Loading */}
        {analyzing && <ScanAnimation />}

        {/* State: Error */}
        {
          !analyzing && error && (
            <div className="max-w-md mx-auto text-center p-8 bg-white rounded-3xl shadow-xl border border-red-100 animate-fade-in">
              <div className="bg-red-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 text-red-500">
                <Loader2 size={32} />
              </div>
              <h3 className="text-xl font-bold text-gray-800 mb-2">Oops!</h3>
              <p className="text-gray-600 mb-6">{error}</p>
              <button
                onClick={() => setError(null)}
                className="bg-gray-900 text-white px-6 py-2 rounded-full hover:bg-black transition-colors"
              >
                Try Again
              </button>
            </div>
          )
        }

        {/* State: History View */}
        {
          !analyzing && showHistory && (
            !user ? (
              // Guest — prompt to sign in
              <div className="flex flex-col items-center justify-center min-h-[60vh] animate-fade-in-up text-center">
                <div className="bg-white rounded-3xl shadow-xl border border-emerald-100 p-12 max-w-md">
                  <div className="bg-emerald-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6">
                    <HistoryIcon size={28} className="text-emerald-600" />
                  </div>
                  <h3 className="text-xl font-bold text-gray-800 mb-2">Sign in to view history</h3>
                  <p className="text-gray-500 text-sm mb-6">Your scan history is saved securely in the database. Sign in to access it from any device.</p>
                  <button
                    onClick={() => setShowAuthModal(true)}
                    className="bg-emerald-600 text-white px-6 py-2.5 rounded-full font-semibold hover:bg-emerald-700 transition-all shadow-md shadow-emerald-200"
                  >
                    Sign In
                  </button>
                </div>
              </div>
            ) : (
              <HistoryView
                history={history}
                folders={folders}
                onSelect={handleHistorySelect}
                onClear={clearHistory}
                onClose={() => setShowHistory(false)}
                onCreateFolder={createFolder}
                onDeleteFolder={deleteFolder}
                onMoveItems={moveItemsToFolder}
                onDeleteItem={deleteItem}
              />
            )
          )
        }

        {/* State: Crop Recommendation View */}
        {
          !analyzing && showCropRec && !showHistory && (
            <CropRecommendation />
          )
        }

        {/* State: Upload View (Default) */}
        {
          !analyzing && !results && !error && !showHistory && !showCropRec && (
            <div className="flex flex-col items-center justify-center min-h-[70vh] animate-fade-in-up">
              <div className="text-center mb-12 max-w-2xl">
                <span className="inline-block py-1 px-3 rounded-full bg-emerald-100 text-emerald-800 text-sm font-semibold mb-4 border border-emerald-200">
                  AI Crop Disease Expert
                </span>
                <h1 className="text-5xl font-bold text-gray-900 mb-6 leading-tight">
                  Heal your crops with <span className="text-emerald-600">UZHAVAN</span> AI.
                </h1>
                <p className="text-xl text-gray-500 leading-relaxed">
                  UZHAVAN AI identifies plant diseases instantly using MobileNetV3 and provides expert advice. <br />
                  <span className="font-semibold text-emerald-600">Supports single plants or whole gardens!</span>
                </p>
              </div>

              <ImageUpload
                onImageSelect={handleImageSelect}
                onOpenAR={() => setShowCamera(true)}
              />

              <div className="mt-16 text-center">
                <p className="text-sm text-gray-400 font-medium uppercase tracking-widest mb-4">Trusted by plant lovers</p>
                <div className="flex justify-center items-center gap-8 opacity-50 grayscale hover:grayscale-0 transition-all duration-500">
                  <div className="flex items-center gap-1"><Leaf size={16} /><span>NatureHome</span></div>
                  <div className="flex items-center gap-1"><Sprout size={16} /><span>GreenThumb</span></div>
                  <div className="flex items-center gap-1"><Sun size={16} /><span>FloraDaily</span></div>
                </div>
              </div>
            </div>
          )
        }

        {/* State: Result View */}
        {
          !analyzing && results && !showHistory && !showCropRec && (
            <AnalysisResult results={results} onReset={handleReset} image={currentImage} />
          )
        }

      </main >

      {/* Floating Chat Interface (Hidden in AR Mode) */}
      {!showCamera && <ChatInterface />}

      {/* Auth Modal — shown to guests when they click Sign In */}
      <AuthModal isOpen={showAuthModal} onClose={() => setShowAuthModal(false)} />

      {
        !showCamera && (
          <footer className="text-center py-10 text-gray-500 text-sm space-y-3">
            <div className="max-w-md mx-auto bg-emerald-50 border border-emerald-100 rounded-2xl p-5">
              <p className="text-lg font-semibold text-emerald-800 leading-relaxed" style={{ fontFamily: "'Noto Sans Tamil', sans-serif" }}>
                உழுதுண்டு வாழ்வாரே வாழ்வார் மற்றெல்லாம்<br />
                தொழுதுண்டு பின்செல் பவர்
              </p>
              <p className="text-xs text-emerald-600 mt-2 italic">— திருவள்ளுவர் (Thiruvalluvar, Kural 1033)</p>
              <p className="text-xs text-gray-500 mt-1">"Those who eat by the labour of ploughing are truly alive; all others follow behind and eat."</p>
            </div>
            <p className="text-gray-400">&copy; {new Date().getFullYear()} UZHAVAN AI. AI advice should be used as a guide.</p>
          </footer>
        )
      }
    </div >
  );
};

export default App;