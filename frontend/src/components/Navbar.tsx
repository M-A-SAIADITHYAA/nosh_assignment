import React from 'react';
import { ConnectionStatus } from '../types.js';
import { Utensils, RefreshCw, Radio } from 'lucide-react';

interface NavbarProps {
  totalCount: number;
  publishedCount: number;
  unsavedDraftsCount: number;
  connectionStatus: ConnectionStatus;
  isLoading: boolean;
  onRefreshAll: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  totalCount,
  publishedCount,
  unsavedDraftsCount,
  connectionStatus,
  isLoading,
  onRefreshAll,
}) => {
  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        {/* Brand & Subtitle */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-orange-600 to-amber-500 flex items-center justify-center text-white shadow-md shadow-orange-500/20">
            <Utensils className="w-5 h-5 stroke-[2.2]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold text-slate-900 tracking-tight">
                Nosh Dish Dashboard
              </h1>
              <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-orange-100 text-orange-800 border border-orange-200">
                Safe OCC Updates
              </span>
            </div>
            <p className="text-xs text-slate-500 font-medium">
              Local draft editing with optimistic concurrency control and backend validation
            </p>
          </div>
        </div>

        {/* Live Status, Metrics & Actions */}
        <div className="flex items-center gap-3 flex-wrap">
          {/* Live Sync Status Pill */}
          <div
            className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
              connectionStatus === 'connected'
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                : connectionStatus === 'reconnecting'
                ? 'bg-amber-50 text-amber-800 border-amber-200'
                : 'bg-slate-100 text-slate-600 border-slate-200'
            }`}
          >
            <span
              className={`w-2 h-2 rounded-full ${
                connectionStatus === 'connected'
                  ? 'bg-emerald-500 animate-pulse'
                  : connectionStatus === 'reconnecting'
                  ? 'bg-amber-500 animate-ping'
                  : 'bg-slate-400'
              }`}
            />
            <Radio className="w-3.5 h-3.5" />
            <span>
              {connectionStatus === 'connected'
                ? 'Live Sync Active (SSE)'
                : connectionStatus === 'reconnecting'
                ? 'Reconnecting Live Stream...'
                : 'Live Sync Disconnected'}
            </span>
          </div>

          {/* Quick Metrics */}
          <div className="hidden sm:flex items-center divide-x divide-slate-200 text-xs text-slate-600 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 font-medium">
            <span className="pr-2.5">
              Total: <strong className="text-slate-900 font-semibold">{totalCount}</strong>
            </span>
            <span className="px-2.5">
              Published: <strong className="text-emerald-700 font-semibold">{publishedCount}</strong>
            </span>
            <span className="pl-2.5">
              Unsaved Drafts:{' '}
              <strong
                className={
                  unsavedDraftsCount > 0 ? 'text-amber-700 font-bold' : 'text-slate-500 font-medium'
                }
              >
                {unsavedDraftsCount}
              </strong>
            </span>
          </div>

          {/* Refresh Button */}
          <button
            type="button"
            onClick={onRefreshAll}
            disabled={isLoading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 shadow-xs hover:border-slate-300 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-orange-600' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>
    </header>
  );
};
