import React, { useState } from 'react';
import { Dish, DishDraft, ConflictState, RemoteUpdateState } from '../types.js';
import { BrokenImageFallback } from './BrokenImageFallback.js';
import {
  Save,
  RotateCcw,
  AlertTriangle,
  Radio,
  Check,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';

interface DishCardProps {
  dish: Dish;
  draft?: DishDraft;
  isSaving: boolean;
  errorMessage?: string;
  conflict?: ConflictState;
  remoteUpdate?: RemoteUpdateState;
  onUpdateDraft: (dishId: string, updates: Partial<DishDraft>) => void;
  onDiscardDraft: (dishId: string) => void;
  onSaveDish: (dishId: string) => void;
  onReloadFromConflict: (dishId: string) => void;
  onApplyRemoteUpdate: (dishId: string) => void;
  onDismissRemoteUpdate: (dishId: string) => void;
}

export const DishCard: React.FC<DishCardProps> = ({
  dish,
  draft,
  isSaving,
  errorMessage,
  conflict,
  remoteUpdate,
  onUpdateDraft,
  onDiscardDraft,
  onSaveDish,
  onReloadFromConflict,
  onApplyRemoteUpdate,
  onDismissRemoteUpdate,
}) => {
  const [imgError, setImgError] = useState(false);
  const [showReloadConfirm, setShowReloadConfirm] = useState(false);

  // Active form values: draft values if user has modified, otherwise saved values
  const currentName = draft ? draft.dishName : dish.dishName;
  const currentPublished = draft ? draft.isPublished : dish.isPublished;

  const hasUnsavedChanges = Boolean(draft);
  const nameChanged = hasUnsavedChanges && draft?.dishName !== dish.dishName;
  const statusChanged = hasUnsavedChanges && draft?.isPublished !== dish.isPublished;

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onUpdateDraft(dish.dishId, { dishName: e.target.value });
  };

  const handleStatusToggle = () => {
    onUpdateDraft(dish.dishId, { isPublished: !currentPublished });
  };

  return (
    <div
      className={`group relative bg-white rounded-2xl border transition-all duration-200 overflow-hidden flex flex-col shadow-sm hover:shadow-md ${
        conflict
          ? 'border-rose-400 ring-2 ring-rose-100 shadow-rose-100/50'
          : hasUnsavedChanges
          ? 'border-amber-400 ring-2 ring-amber-100/70 shadow-amber-50'
          : 'border-slate-200 hover:border-slate-300'
      }`}
    >
      {/* 1. Image & Header Badges */}
      <div className="relative w-full h-48 bg-slate-100 overflow-hidden">
        {imgError ? (
          <BrokenImageFallback dishName={currentName} />
        ) : (
          <img
            src={dish.imageUrl}
            alt={currentName}
            onError={() => setImgError(true)}
            className="w-full h-full object-cover object-center transition-transform duration-300 group-hover:scale-105"
            loading="lazy"
          />
        )}

        {/* Top Floating Badges */}
        <div className="absolute top-3 left-3 flex items-center gap-1.5 flex-wrap">
          <span className="px-2 py-0.5 text-xs font-semibold rounded-md bg-slate-900/80 text-white backdrop-blur-md shadow-sm">
            #{dish.dishId}
          </span>
          <span className="px-2 py-0.5 text-xs font-semibold rounded-md bg-slate-900/70 text-slate-200 backdrop-blur-md shadow-sm">
            v{dish.version}
          </span>
          {hasUnsavedChanges && (
            <span className="px-2 py-0.5 text-xs font-bold rounded-md bg-amber-500 text-white shadow-sm animate-pulse">
              Unsaved Draft
            </span>
          )}
        </div>

        {/* Top Right Published Status Indicator */}
        <div className="absolute top-3 right-3">
          <span
            className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold shadow-sm backdrop-blur-md ${
              currentPublished
                ? 'bg-emerald-500/90 text-white'
                : 'bg-slate-800/80 text-slate-200'
            }`}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                currentPublished ? 'bg-emerald-200' : 'bg-slate-400'
              }`}
            />
            {currentPublished ? 'Published' : 'Draft Only'}
          </span>
        </div>
      </div>

      {/* 2. Card Content & Draft Editing Form */}
      <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
        <div className="space-y-4">
          {/* Dish Name Edit Field */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label
                htmlFor={`dish-name-${dish.dishId}`}
                className="text-xs font-semibold text-slate-600 uppercase tracking-wider"
              >
                Dish Name
              </label>
              {nameChanged && (
                <span className="text-[11px] font-medium text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                  Original: &ldquo;{dish.dishName}&rdquo;
                </span>
              )}
            </div>
            <input
              id={`dish-name-${dish.dishId}`}
              type="text"
              value={currentName}
              onChange={handleNameChange}
              disabled={isSaving}
              placeholder="e.g. Paneer Butter Masala"
              className={`w-full px-3.5 py-2 text-sm rounded-xl border bg-white focus:outline-none focus:ring-2 transition-all ${
                nameChanged
                  ? 'border-amber-300 focus:border-amber-400 focus:ring-amber-200/50 bg-amber-50/20'
                  : 'border-slate-200 focus:border-orange-500 focus:ring-orange-200/50'
              } disabled:opacity-60 disabled:cursor-not-allowed`}
            />
          </div>

          {/* Published Status Toggle */}
          <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100">
            <div className="flex flex-col">
              <span className="text-sm font-medium text-slate-800">
                Published to Menu
              </span>
              <span className="text-xs text-slate-500">
                {statusChanged ? (
                  <span className="text-amber-700 font-medium">
                    Changed from {dish.isPublished ? 'Published' : 'Draft'}
                  </span>
                ) : currentPublished ? (
                  'Live on menu for customers'
                ) : (
                  'Hidden from public view'
                )}
              </span>
            </div>

            <button
              type="button"
              role="switch"
              aria-checked={currentPublished}
              onClick={handleStatusToggle}
              disabled={isSaving}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-orange-500/40 disabled:opacity-50 ${
                currentPublished ? 'bg-emerald-500' : 'bg-slate-300'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                  currentPublished ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* 3. 409 CONFLICT STATE BANNER */}
          {conflict && (
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-900 space-y-2.5 animate-in fade-in">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <div className="text-xs">
                  <p className="font-semibold text-rose-950">Update Conflict Detected (409)</p>
                  <p className="mt-0.5 text-rose-800">
                    Another update saved this dish to <strong>v{conflict.currentVersion}</strong>.
                    Your draft expected <strong>v{conflict.expectedVersion}</strong>.
                  </p>
                  <p className="mt-1 text-rose-700 font-medium">
                    Server has: &ldquo;{conflict.currentDish.dishName}&rdquo; (
                    {conflict.currentDish.isPublished ? 'Published' : 'Draft'}).
                  </p>
                  <p className="mt-0.5 text-rose-600 italic">
                    Your local draft is preserved. You can discard it to load the server version, or modify your draft.
                  </p>
                </div>
              </div>

              {!showReloadConfirm ? (
                <button
                  type="button"
                  onClick={() => setShowReloadConfirm(true)}
                  className="w-full text-xs font-semibold py-1.5 px-3 rounded-lg bg-rose-600 hover:bg-rose-700 text-white transition-colors flex items-center justify-center gap-1.5"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Reload Server Version v{conflict.currentVersion}
                </button>
              ) : (
                <div className="p-2 bg-rose-100/70 border border-rose-300 rounded-lg text-xs space-y-2">
                  <p className="font-semibold text-rose-900">
                    ⚠️ Warning: This will discard your unsaved draft!
                  </p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setShowReloadConfirm(false);
                        onReloadFromConflict(dish.dishId);
                      }}
                      className="flex-1 py-1 px-2 font-semibold bg-rose-700 text-white rounded hover:bg-rose-800 text-[11px]"
                    >
                      Confirm Discard & Reload
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowReloadConfirm(false)}
                      className="py-1 px-2 font-medium bg-white text-rose-800 rounded border border-rose-300 text-[11px]"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 4. OPTIONAL BONUS: REMOTE UPDATE AVAILABLE BANNER */}
          {remoteUpdate && !conflict && (
            <div className="p-3.5 rounded-xl bg-sky-50 border border-sky-200 text-sky-950 space-y-2 animate-in fade-in">
              <div className="flex items-start gap-2">
                <Radio className="w-4 h-4 text-sky-600 shrink-0 mt-0.5 animate-pulse" />
                <div className="text-xs">
                  <p className="font-semibold text-sky-950">Remote Update Available</p>
                  <p className="mt-0.5 text-sky-800">
                    A newer saved version (<strong>v{remoteUpdate.remoteVersion}</strong>) arrived at{' '}
                    {remoteUpdate.receivedAt}. Because you have an unsaved draft, your draft was preserved.
                  </p>
                  <p className="mt-1 text-sky-700">
                    Remote value: &ldquo;{remoteUpdate.remoteDish.dishName}&rdquo; (
                    {remoteUpdate.remoteDish.isPublished ? 'Published' : 'Draft'})
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => onApplyRemoteUpdate(dish.dishId)}
                  className="flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold bg-sky-600 hover:bg-sky-700 text-white transition-colors"
                >
                  Apply Remote (Discards Draft)
                </button>
                <button
                  type="button"
                  onClick={() => onDismissRemoteUpdate(dish.dishId)}
                  className="py-1.5 px-3 rounded-lg text-xs font-medium bg-white border border-sky-300 text-sky-800 hover:bg-sky-50 transition-colors"
                >
                  Keep Draft
                </button>
              </div>
            </div>
          )}

          {/* 5. VALIDATION / NETWORK ERROR BANNER */}
          {errorMessage && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-900 text-xs flex items-start gap-2 animate-in fade-in">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div className="flex-1">
                <span className="font-semibold block">Save Failed:</span>
                <span className="text-rose-800 leading-relaxed">{errorMessage}</span>
                <p className="mt-1 text-[11px] text-rose-600 font-medium">
                  Your draft has been preserved. You can correct the input or retry.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* 6. Card Actions (Save & Discard) */}
        <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2.5">
          <button
            type="button"
            onClick={() => onDiscardDraft(dish.dishId)}
            disabled={(!hasUnsavedChanges && !conflict) || isSaving}
            className={`px-3.5 py-2 text-xs font-semibold rounded-xl flex items-center gap-1.5 transition-colors ${
              hasUnsavedChanges || conflict
                ? 'text-slate-700 bg-slate-100 hover:bg-slate-200 hover:text-slate-900 cursor-pointer'
                : 'text-slate-300 bg-slate-50 cursor-not-allowed opacity-50'
            }`}
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Discard
          </button>

          <button
            type="button"
            onClick={() => onSaveDish(dish.dishId)}
            disabled={!hasUnsavedChanges || isSaving}
            className={`flex-1 px-4 py-2 text-xs font-semibold rounded-xl flex items-center justify-center gap-1.5 transition-all shadow-sm ${
              hasUnsavedChanges && !isSaving
                ? 'bg-orange-600 hover:bg-orange-500 text-white cursor-pointer hover:shadow-orange-200 shadow'
                : 'bg-slate-100 text-slate-400 cursor-not-allowed'
            }`}
          >
            {isSaving ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                Saving...
              </>
            ) : hasUnsavedChanges ? (
              <>
                <Save className="w-3.5 h-3.5" />
                Save Changes
              </>
            ) : (
              <>
                <Check className="w-3.5 h-3.5 text-slate-400" />
                Saved
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
