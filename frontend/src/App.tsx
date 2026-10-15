import { useState, useMemo } from 'react';
import { useDishDashboard } from './hooks/useDishDashboard.js';
import { Navbar } from './components/Navbar.js';
import { DishCard } from './components/DishCard.js';
import { ToastContainer } from './components/Toast.js';
import { EmptyState } from './components/EmptyState.js';
import { Search, AlertCircle, RefreshCw } from 'lucide-react';

type FilterType = 'all' | 'published' | 'draft' | 'unsaved';

export function App() {
  const {
    dishes,
    drafts,
    saving,
    errors,
    conflicts,
    remoteUpdates,
    isLoading,
    globalError,
    connectionStatus,
    toasts,
    updateDraft,
    discardDraft,
    saveDish,
    reloadDishFromConflict,
    applyRemoteUpdate,
    dismissRemoteUpdate,
    removeToast,
    refreshAll,
  } = useDishDashboard();

  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<FilterType>('all');

  const dishList = useMemo(() => Object.values(dishes), [dishes]);

  const totalCount = dishList.length;
  const publishedCount = useMemo(
    () => dishList.filter((d) => d.isPublished).length,
    [dishList]
  );
  const unsavedDraftsCount = useMemo(
    () => Object.keys(drafts).length,
    [drafts]
  );

  // Filtered dishes
  const filteredDishes = useMemo(() => {
    return dishList.filter((dish) => {
      // 1. Search Query filter (matches ID or Name)
      const matchesSearch =
        dish.dishName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        dish.dishId.toLowerCase().includes(searchQuery.toLowerCase());

      if (!matchesSearch) return false;

      // Current draft values for filter check
      const isDraftModified = Boolean(drafts[dish.dishId]);
      const currentPublished = isDraftModified
        ? drafts[dish.dishId].isPublished
        : dish.isPublished;

      // 2. Filter tabs
      if (activeFilter === 'published') return currentPublished;
      if (activeFilter === 'draft') return !currentPublished;
      if (activeFilter === 'unsaved') return isDraftModified;

      return true;
    });
  }, [dishList, searchQuery, activeFilter, drafts]);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      {/* 1. Header Navbar */}
      <Navbar
        totalCount={totalCount}
        publishedCount={publishedCount}
        unsavedDraftsCount={unsavedDraftsCount}
        connectionStatus={connectionStatus}
        isLoading={isLoading}
        onRefreshAll={refreshAll}
      />

      {/* 2. Main Content Container */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex-1 w-full space-y-6">
        {/* Global Error Banner */}
        {globalError && (
          <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-900 flex items-center justify-between shadow-xs">
            <div className="flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
              <div>
                <h3 className="text-sm font-semibold">Unable to fetch dishes</h3>
                <p className="text-xs text-rose-700 mt-0.5">{globalError}</p>
              </div>
            </div>
            <button
              onClick={refreshAll}
              className="px-3 py-1.5 text-xs font-semibold bg-rose-600 text-white rounded-xl hover:bg-rose-700 transition-colors flex items-center gap-1.5"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Retry Connection
            </button>
          </div>
        )}

        {/* Search & Filter Toolbar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs">
          {/* Search Box */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search dishes by name or ID (#1)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-sm bg-slate-50 rounded-xl border border-slate-200 focus:bg-white focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all"
            />
          </div>

          {/* Filter Tabs */}
          <div className="flex items-center gap-1.5 bg-slate-100/80 p-1 rounded-xl self-start sm:self-auto overflow-x-auto w-full sm:w-auto">
            <button
              type="button"
              onClick={() => setActiveFilter('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
                activeFilter === 'all'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              All Dishes ({totalCount})
            </button>
            <button
              type="button"
              onClick={() => setActiveFilter('published')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
                activeFilter === 'published'
                  ? 'bg-white text-emerald-800 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Published ({publishedCount})
            </button>
            <button
              type="button"
              onClick={() => setActiveFilter('draft')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
                activeFilter === 'draft'
                  ? 'bg-white text-slate-800 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Draft Only ({totalCount - publishedCount})
            </button>
            <button
              type="button"
              onClick={() => setActiveFilter('unsaved')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap flex items-center gap-1.5 ${
                activeFilter === 'unsaved'
                  ? 'bg-white text-amber-800 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {unsavedDraftsCount > 0 && (
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
              )}
              Unsaved Drafts ({unsavedDraftsCount})
            </button>
          </div>
        </div>

        {/* 3. Dishes Grid */}
        {isLoading && dishList.length === 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3, 4, 5, 6].map((key) => (
              <div
                key={key}
                className="bg-white rounded-2xl border border-slate-200 h-96 animate-pulse p-4 space-y-4"
              >
                <div className="w-full h-44 bg-slate-200 rounded-xl" />
                <div className="h-4 bg-slate-200 rounded w-3/4" />
                <div className="h-8 bg-slate-100 rounded-xl" />
                <div className="h-10 bg-slate-100 rounded-xl" />
              </div>
            ))}
          </div>
        ) : filteredDishes.length === 0 ? (
          <EmptyState
            searchQuery={searchQuery}
            onClear={() => {
              setSearchQuery('');
              setActiveFilter('all');
            }}
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredDishes.map((dish) => (
              <DishCard
                key={dish.dishId}
                dish={dish}
                draft={drafts[dish.dishId]}
                isSaving={Boolean(saving[dish.dishId])}
                errorMessage={errors[dish.dishId]}
                conflict={conflicts[dish.dishId]}
                remoteUpdate={remoteUpdates[dish.dishId]}
                onUpdateDraft={updateDraft}
                onDiscardDraft={discardDraft}
                onSaveDish={saveDish}
                onReloadFromConflict={reloadDishFromConflict}
                onApplyRemoteUpdate={applyRemoteUpdate}
                onDismissRemoteUpdate={dismissRemoteUpdate}
              />
            ))}
          </div>
        )}
      </main>

      {/* 4. Footer with Architecture Summary */}
      <footer className="mt-12 border-t border-slate-200 bg-white py-6 text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row items-center justify-between gap-3 text-center md:text-left">
          <p>
            <strong>Nosh Dish Dashboard:</strong> Local draft state • Optimistic Concurrency Control
            (OCC) • Atomic SQLite updates • Live SSE synchronization
          </p>
          <div className="flex items-center gap-4 text-slate-400">
            <span>HTTP/HTTPS Image Validation</span>
            <span>•</span>
            <span>Zero-loss Drafts</span>
            <span>•</span>
            <span>Explicit Status Saves</span>
          </div>
        </div>
      </footer>

      {/* 5. Toast Notifications Container */}
      <ToastContainer toasts={toasts} onDismiss={removeToast} />
    </div>
  );
}

export default App;
