import React, { useState, useMemo } from 'react';
import { HistoryItem, PlantFolder } from '../types';
import {
  Calendar,
  ChevronRight,
  Sprout,
  AlertTriangle,
  CheckCircle,
  Trash2,
  Clock,
  Folder,
  Plus,
  FolderOpen,
  ArrowLeft,
  MoreVertical,
  X,
  Leaf,
  LayoutGrid,
  Flower2,
  Download
} from 'lucide-react';
import { DownloadModal } from './AnalysisResult';

interface HistoryViewProps {
  history: HistoryItem[];
  folders: PlantFolder[];
  onSelect: (item: HistoryItem) => void;
  onClear: () => void;
  onClose: () => void;
  onCreateFolder: (name: string) => void;
  onDeleteFolder: (id: string) => void;
  onMoveItems: (itemIds: string[], folderId: string | undefined) => void;
  onDeleteItem: (id: string) => void;
}

export const HistoryView: React.FC<HistoryViewProps> = ({
  history,
  folders,
  onSelect,
  onClear,
  onClose,
  onCreateFolder,
  onDeleteFolder,
  onMoveItems,
  onDeleteItem
}) => {
  const [activeTab, setActiveTab] = useState<'collections' | 'varieties'>('collections');
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [selectedSpecies, setSelectedSpecies] = useState<string | null>(null);

  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [moveItemMode, setMoveItemMode] = useState<string | null>(null); // itemId
  const [downloadItem, setDownloadItem] = useState<HistoryItem | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // State for Adding Items to Folder Modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedToAdd, setSelectedToAdd] = useState<Set<string>>(new Set());

  const currentFolder = folders.find(f => f.id === currentFolderId);

  // Calculate Species Groups automatically from history
  const speciesGroups = useMemo(() => {
    const groups: Record<string, number> = {};
    history.forEach(item => {
      // Iterate through all plants in the result
      if (item.results && item.results.length > 0) {
        item.results.forEach(plant => {
          if (plant.isPlant) {
            const name = plant.plantName;
            groups[name] = (groups[name] || 0) + 1;
          }
        });
      }
    });
    return Object.entries(groups).sort((a, b) => b[1] - a[1]); // Sort by count desc
  }, [history]);

  // Determine what items to show based on state
  let displayedItems = history;
  let viewTitle = activeTab === 'collections' ? "My Collections" : "Plant Varieties";
  let isDetailView = false;

  if (currentFolderId) {
    // Inside a manual folder
    displayedItems = history.filter(h => h.folderId === currentFolderId);
    viewTitle = currentFolder?.name || "Collection";
    isDetailView = true;
  } else if (selectedSpecies) {
    // Inside an auto-generated species group
    displayedItems = history.filter(h => h.results.some(r => r.plantName === selectedSpecies));
    viewTitle = selectedSpecies;
    isDetailView = true;
  } else if (activeTab === 'varieties') {
    // Root of Varieties tab - we only show the grid, no loose items
    displayedItems = [];
  } else {
    // Root of Collections tab - show all history (as "Recent Scans")
    displayedItems = history;
  }

  const handleCreateFolder = () => {
    if (newFolderName.trim()) {
      onCreateFolder(newFolderName.trim());
      setNewFolderName('');
      setIsCreatingFolder(false);
    }
  };

  const handleMoveItem = (itemId: string, targetFolderId: string | undefined) => {
    onMoveItems([itemId], targetFolderId);
    setMoveItemMode(null);
  };

  const handleBatchAdd = () => {
    if (currentFolderId && selectedToAdd.size > 0) {
      onMoveItems(Array.from(selectedToAdd), currentFolderId);
      setShowAddModal(false);
      setSelectedToAdd(new Set());
    }
  };

  const toggleSelection = (id: string) => {
    const newSet = new Set(selectedToAdd);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedToAdd(newSet);
  };

  const handleBack = () => {
    setCurrentFolderId(null);
    setSelectedSpecies(null);
  };

  // Filter items available to add to the current folder
  const availableToAdd = useMemo(() => {
    return history.filter(h => h.folderId !== currentFolderId);
  }, [history, currentFolderId]);

  if (history.length === 0 && folders.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 animate-fade-in text-center">
        <div className="bg-emerald-50 p-6 rounded-full mb-6">
          <Clock size={48} className="text-emerald-300" />
        </div>
        <h2 className="text-2xl font-bold text-gray-800 mb-2">No History Yet</h2>
        <p className="text-gray-500 mb-8 max-w-sm">
          Your plant analysis history and collections will appear here.
        </p>
        <button
          onClick={onClose}
          className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium py-3 px-8 rounded-full transition-colors shadow-lg shadow-emerald-200"
        >
          Scan Your First Plant
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto animate-fade-in pb-20">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div className="flex items-center gap-3">
          {isDetailView && (
            <button
              onClick={handleBack}
              className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-500"
            >
              <ArrowLeft size={24} />
            </button>
          )}
          <div>
            <h2 className="text-3xl font-bold text-gray-800 flex items-center gap-2">
              {currentFolderId ? (
                <FolderOpen size={28} className="text-emerald-500" />
              ) : selectedSpecies ? (
                <Flower2 size={28} className="text-emerald-500" />
              ) : null}
              {viewTitle}
            </h2>
            <p className="text-gray-500 mt-1">
              {isDetailView ? `${displayedItems.length} items` : "Manage your plant history"}
            </p>
          </div>
        </div>

        {/* Top Actions */}
        <div className="flex items-center gap-3">
          {/* View Tabs - Only show at root level */}
          {!isDetailView && (
            <div className="flex bg-gray-100 p-1 rounded-xl">
              <button
                onClick={() => setActiveTab('collections')}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${activeTab === 'collections' ? 'bg-white text-emerald-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                  }`}
              >
                <LayoutGrid size={16} /> Collections
              </button>
              <button
                onClick={() => setActiveTab('varieties')}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${activeTab === 'varieties' ? 'bg-white text-emerald-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                  }`}
              >
                <Leaf size={16} /> Varieties
              </button>
            </div>
          )}

          {/* Folder specific actions */}
          {currentFolderId && (
            <>
              <button
                onClick={() => setShowAddModal(true)}
                className="flex items-center gap-2 bg-emerald-600 text-white hover:bg-emerald-700 px-4 py-2 rounded-lg transition-colors text-sm font-medium shadow-md shadow-emerald-200"
              >
                <Plus size={16} />
                <span className="hidden sm:inline">Add Items</span>
              </button>
              <button
                onClick={() => {
                  onDeleteFolder(currentFolderId);
                  setCurrentFolderId(null);
                }}
                className="flex items-center gap-2 text-red-500 hover:text-red-600 hover:bg-red-50 px-4 py-2 rounded-lg transition-colors text-sm font-medium"
              >
                <Trash2 size={16} />
                <span className="hidden sm:inline">Delete</span>
              </button>
            </>
          )}

          {/* Delete/Clear Actions */}
          {!isDetailView && activeTab === 'collections' && (
            <button
              onClick={onClear}
              className="flex items-center gap-2 text-red-500 hover:text-red-600 hover:bg-red-50 px-3 py-2 rounded-lg transition-colors text-sm font-medium ml-2"
              title="Clear all history"
            >
              <Trash2 size={16} />
            </button>
          )}
        </div>
      </div>

      {/* VIEW: Collections (Manual Folders) */}
      {!isDetailView && activeTab === 'collections' && (
        <div className="mb-10 animate-fade-in">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-700">My Folders</h3>
            <button
              onClick={() => setIsCreatingFolder(true)}
              className="text-emerald-600 font-medium text-sm flex items-center gap-1 hover:bg-emerald-50 px-2 py-1 rounded-md transition-colors"
            >
              <Plus size={16} /> New Collection
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {/* New Folder Input Card */}
            {isCreatingFolder && (
              <div className="bg-white p-4 rounded-2xl shadow-sm border-2 border-emerald-500 flex flex-col justify-center gap-2 animate-fade-in">
                <input
                  autoFocus
                  type="text"
                  placeholder="Name..."
                  className="w-full text-sm font-semibold border-b border-gray-200 focus:outline-none focus:border-emerald-500 pb-1"
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleCreateFolder()}
                />
                <div className="flex gap-2 justify-end mt-1">
                  <button onClick={() => setIsCreatingFolder(false)} className="text-gray-400 hover:text-gray-600"><X size={14} /></button>
                  <button onClick={handleCreateFolder} className="text-emerald-600 hover:text-emerald-700 font-bold text-xs">OK</button>
                </div>
              </div>
            )}

            {/* Folder Cards */}
            {folders.map(folder => {
              const itemCount = history.filter(h => h.folderId === folder.id).length;
              return (
                <div
                  key={folder.id}
                  onClick={() => setCurrentFolderId(folder.id)}
                  className="bg-white p-4 rounded-2xl shadow-sm border border-emerald-50 hover:shadow-md hover:border-emerald-200 cursor-pointer transition-all group flex flex-col items-center text-center justify-center min-h-[120px]"
                >
                  <div className="bg-emerald-100 text-emerald-600 p-3 rounded-full mb-3 group-hover:scale-110 transition-transform">
                    <Folder size={24} />
                  </div>
                  <h4 className="font-bold text-gray-800 text-sm truncate w-full px-2">{folder.name}</h4>
                  <span className="text-xs text-gray-400 mt-1">{itemCount} items</span>
                </div>
              );
            })}

            {folders.length === 0 && !isCreatingFolder && (
              <div
                onClick={() => setIsCreatingFolder(true)}
                className="border-2 border-dashed border-gray-200 rounded-2xl p-4 flex flex-col items-center justify-center text-gray-400 cursor-pointer hover:border-emerald-300 hover:text-emerald-500 transition-all min-h-[120px]"
              >
                <Plus size={24} className="mb-2" />
                <span className="text-xs font-medium">Create Collection</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* VIEW: Varieties (Auto-grouped) */}
      {!isDetailView && activeTab === 'varieties' && (
        <div className="animate-fade-in">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {speciesGroups.map(([name, count]) => (
              <div
                key={name}
                onClick={() => setSelectedSpecies(name)}
                className="bg-white p-4 rounded-2xl shadow-sm border border-emerald-50 hover:shadow-md hover:border-emerald-200 cursor-pointer transition-all group flex flex-col items-center text-center justify-center min-h-[120px]"
              >
                <div className="bg-teal-100 text-teal-600 p-3 rounded-full mb-3 group-hover:scale-110 transition-transform">
                  <Flower2 size={24} />
                </div>
                <h4 className="font-bold text-gray-800 text-sm truncate w-full px-2">{name}</h4>
                <span className="text-xs text-gray-400 mt-1">{count} {count === 1 ? 'scan' : 'scans'}</span>
              </div>
            ))}

            {speciesGroups.length === 0 && (
              <div className="col-span-full text-center py-12 text-gray-400">
                <p>No plants identified yet.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Scans List (Shown in Detail View OR below Folders in Collections tab) */}
      {(isDetailView || activeTab === 'collections') && (
        <div className="space-y-4">
          {!isDetailView && <h3 className="text-lg font-semibold text-gray-700 mb-4 mt-8">Recent Scans</h3>}

          {displayedItems.length === 0 && isDetailView && (
            <div className="text-center py-12 text-gray-400">
              <Sprout size={48} className="mx-auto mb-4 opacity-20" />
              <p>This collection is empty.</p>
              {currentFolderId && (
                <button
                  onClick={() => setShowAddModal(true)}
                  className="mt-4 text-emerald-600 font-bold hover:underline"
                >
                  Add items from history
                </button>
              )}
            </div>
          )}

          {displayedItems.map((item) => {
            const date = new Date(item.timestamp).toLocaleDateString(undefined, {
              year: 'numeric',
              month: 'short',
              day: 'numeric',
            });

            // Safely handle results array
            if (!item.results || item.results.length === 0) return null;

            // Use the first plant as the primary display item
            const primaryPlant = item.results[0];
            const issues = Object.values(primaryPlant.issues || {});
            const issueCount = issues.filter((i: any) => i.detected).length;
            const isHealthy = issueCount === 0;
            const itemFolder = folders.find(f => f.id === item.folderId);
            const plantCount = item.results.length;

            return (
              <div
                key={item.id}
                className="bg-white p-5 rounded-2xl shadow-sm border border-emerald-50 hover:shadow-md hover:border-emerald-200 transition-all group relative"
              >
                {/* Main Content Click Area */}
                <div onClick={() => onSelect(item)} className="cursor-pointer">
                  {/* Thumbnail — shows saved plant image from DB if available */}
                  {item.imageUrl && (
                    <div className="w-full h-28 rounded-xl overflow-hidden mb-3 bg-gray-100">
                      <img
                        src={item.imageUrl}
                        alt={item.results[0]?.plantName || 'Plant scan'}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        onError={(e) => {
                          (e.target as HTMLImageElement).parentElement!.style.display = 'none';
                        }}
                      />
                    </div>
                  )}
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-2 text-xs font-medium text-gray-400 bg-gray-50 px-2 py-1 rounded-md">
                        <Calendar size={12} />
                        {date}
                      </div>
                      {/* Show folder badge if in root collection view and item has a folder */}
                      {!isDetailView && itemFolder && (
                        <div className="flex items-center gap-1 text-xs font-medium text-emerald-600 bg-emerald-50 px-2 py-1 rounded-md">
                          <Folder size={12} />
                          {itemFolder.name}
                        </div>
                      )}
                      {plantCount > 1 && (
                        <div className="flex items-center gap-1 text-xs font-medium text-teal-600 bg-teal-50 px-2 py-1 rounded-md">
                          <LayoutGrid size={12} />
                          +{plantCount - 1} more
                        </div>
                      )}
                    </div>
                    {isHealthy ? (
                      <span className="flex items-center gap-1 text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full">
                        <CheckCircle size={12} /> Healthy
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-xs font-bold text-amber-600 bg-amber-50 px-2 py-1 rounded-full">
                        <AlertTriangle size={12} /> {issueCount} {issueCount === 1 ? 'Issue' : 'Issues'}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center shrink-0 ${isHealthy ? 'bg-emerald-100 text-emerald-600' : 'bg-amber-100 text-amber-600'}`}>
                      <Sprout size={24} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-lg font-bold text-gray-800 truncate group-hover:text-emerald-700 transition-colors">
                        {primaryPlant.plantName}
                      </h3>
                      {/* Disease name badge — shown when diseaseName exists */}
                      {(primaryPlant.diseaseName || '') !== '' && (
                        <p className="text-xs font-semibold mt-0.5 truncate">
                          {primaryPlant.issues?.diseases?.detected
                            ? <span className="text-red-500">⚠ {primaryPlant.diseaseName}</span>
                            : <span className="text-emerald-500">✓ {primaryPlant.diseaseName}</span>
                          }
                        </p>
                      )}
                      {/* Fallback for old scans that have no diseaseName stored */}
                      {(!primaryPlant.diseaseName || primaryPlant.diseaseName === '') && (
                        <p className="text-xs font-medium mt-0.5 truncate">
                          {primaryPlant.issues?.diseases?.detected
                            ? <span className="text-red-500">⚠ Disease Detected</span>
                            : <span className="text-emerald-500">✓ Healthy</span>
                          }
                        </p>
                      )}
                      <p className="text-sm text-gray-500 truncate mt-1">
                        {primaryPlant.diagnosis}
                      </p>
                    </div>
                    <div className="text-gray-300 group-hover:text-emerald-500 transition-colors">
                      <ChevronRight size={20} />
                    </div>
                  </div>
                </div>

                {/* Move to Folder Action */}
                <div className="absolute top-4 right-4 z-10">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setMoveItemMode(moveItemMode === item.id ? null : item.id);
                    }}
                    className="p-1.5 rounded-full text-gray-300 hover:text-gray-600 hover:bg-gray-100 transition-colors"
                    title="Organize"
                  >
                    <MoreVertical size={16} />
                  </button>

                  {moveItemMode === item.id && (
                    <div className="absolute right-0 mt-2 w-52 bg-white rounded-2xl
                                    shadow-2xl border border-gray-100 z-20 overflow-hidden animate-fade-in">

                      {/* Section 1: Move to Collection */}
                      <div className="px-3 pt-3 pb-1">
                        <p className="text-[10px] font-bold text-gray-400 uppercase
                                      tracking-widest px-1 mb-1.5">
                          Move to Collection
                        </p>
                        <div className="max-h-36 overflow-y-auto space-y-0.5">
                          <button
                            onClick={e => { e.stopPropagation(); handleMoveItem(item.id, undefined); }}
                            className={`w-full text-left px-3 py-2 text-sm rounded-lg hover:bg-gray-50
                                        flex items-center gap-2 transition-colors
                                        ${!item.folderId ? 'text-emerald-600 font-semibold' : 'text-gray-600'}`}
                          >
                            <X size={13} className="shrink-0" /> Remove from folder
                          </button>
                          {folders.map(f => (
                            <button
                              key={f.id}
                              onClick={e => { e.stopPropagation(); handleMoveItem(item.id, f.id); }}
                              className={`w-full text-left px-3 py-2 text-sm rounded-lg hover:bg-emerald-50
                                          flex items-center gap-2 transition-colors
                                          ${item.folderId === f.id ? 'text-emerald-600 font-semibold' : 'text-gray-600'}`}
                            >
                              <Folder size={13} className="shrink-0" />
                              <span className="truncate">{f.name}</span>
                            </button>
                          ))}
                          {folders.length === 0 && (
                            <p className="px-3 py-2 text-xs text-gray-400 italic">No collections yet</p>
                          )}
                        </div>
                      </div>

                      {/* Divider */}
                      <div className="h-px bg-gray-100 mx-3 my-2" />

                      {/* Section 2: Download */}
                      <div className="px-3 pb-2">
                        <p className="text-[10px] font-bold text-gray-400 uppercase
                                      tracking-widest px-1 mb-1.5">
                          Download
                        </p>
                        <button
                          onClick={e => {
                            e.stopPropagation();
                            setMoveItemMode(null);
                            setDownloadItem(item);
                          }}
                          className="w-full text-left px-3 py-2.5 text-sm rounded-lg hover:bg-blue-50
                                     flex items-center gap-2.5 text-gray-700 hover:text-blue-700
                                     transition-colors font-medium"
                        >
                          <Download size={14} className="text-blue-500 shrink-0" />
                          Download Report
                        </button>
                      </div>

                      {/* Divider */}
                      <div className="h-px bg-gray-100 mx-3 my-2" />

                      {/* Section 3: Delete */}
                      <div className="px-3 pb-3">
                        {confirmDeleteId === item.id ? (
                          <div className="bg-red-50 rounded-xl p-3">
                            <p className="text-xs font-semibold text-red-700 mb-2 text-center">
                              Delete this scan?
                            </p>
                            <div className="flex gap-2">
                              <button
                                onClick={e => {
                                  e.stopPropagation();
                                  setConfirmDeleteId(null);
                                  setMoveItemMode(null);
                                  onDeleteItem(item.id);
                                }}
                                className="flex-1 py-1.5 text-xs font-bold bg-red-600 text-white
                                           rounded-lg hover:bg-red-700 transition-colors"
                              >
                                Yes, Delete
                              </button>
                              <button
                                onClick={e => { e.stopPropagation(); setConfirmDeleteId(null); }}
                                className="flex-1 py-1.5 text-xs font-medium bg-white text-gray-600
                                           border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <button
                            onClick={e => {
                              e.stopPropagation();
                              setConfirmDeleteId(item.id);
                            }}
                            className="w-full text-left px-3 py-2.5 text-sm rounded-lg hover:bg-red-50
                                       flex items-center gap-2.5 text-red-500 hover:text-red-700
                                       transition-colors font-medium"
                          >
                            <Trash2 size={14} className="shrink-0" />
                            Delete Scan
                          </button>
                        )}
                      </div>

                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add Items Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden animate-scale-up flex flex-col max-h-[80vh]">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50">
              <h3 className="text-xl font-bold text-gray-800">Add to {currentFolder?.name}</h3>
              <button onClick={() => setShowAddModal(false)} className="text-gray-400 hover:text-gray-600"><X size={24} /></button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {availableToAdd.length === 0 ? (
                <div className="text-center py-10 text-gray-400">
                  <p>No other items available in history.</p>
                </div>
              ) : (
                availableToAdd.map(item => {
                  const plant = item.results[0]; // Use first plant for listing
                  const isSelected = selectedToAdd.has(item.id);
                  return (
                    <div
                      key={item.id}
                      onClick={() => toggleSelection(item.id)}
                      className={`flex items-center gap-4 p-4 rounded-xl border cursor-pointer transition-all ${isSelected ? 'bg-emerald-50 border-emerald-500 shadow-sm' : 'bg-white border-gray-100 hover:border-emerald-200'}`}
                    >
                      <div className={`w-5 h-5 rounded-md border flex items-center justify-center shrink-0 ${isSelected ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-gray-300 bg-white'}`}>
                        {isSelected && <CheckCircle size={14} />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-bold text-gray-800 truncate">{plant.plantName}</h4>
                        <p className="text-xs text-gray-500 flex items-center gap-1">
                          <Clock size={10} /> {new Date(item.timestamp).toLocaleDateString()}
                        </p>
                      </div>
                      {item.folderId && (
                        <div className="text-xs bg-gray-100 text-gray-500 px-2 py-1 rounded-md max-w-[80px] truncate">
                          {folders.find(f => f.id === item.folderId)?.name}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            <div className="p-4 border-t border-gray-100 bg-gray-50 flex justify-end gap-3">
              <button
                onClick={() => setShowAddModal(false)}
                className="px-5 py-2 rounded-xl text-gray-600 font-medium hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleBatchAdd}
                disabled={selectedToAdd.size === 0}
                className="px-5 py-2 rounded-xl bg-emerald-600 text-white font-bold hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-emerald-200"
              >
                Add {selectedToAdd.size > 0 ? `(${selectedToAdd.size})` : ''}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Download Modal (triggered from 3-dots menu) */}
      {downloadItem && (
        <DownloadModal
          result={downloadItem.results[0]}
          imageUrl={downloadItem.imageUrl}
          onClose={() => setDownloadItem(null)}
        />
      )}
    </div>
  );
};