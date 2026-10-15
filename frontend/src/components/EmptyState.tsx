import React from 'react';
import { SearchX } from 'lucide-react';

interface EmptyStateProps {
  searchQuery: string;
  onClear: () => void;
}

export const EmptyState: React.FC<EmptyStateProps> = ({ searchQuery, onClear }) => {
  return (
    <div className="py-20 flex flex-col items-center justify-center text-center px-4 max-w-md mx-auto">
      <div className="w-16 h-16 rounded-2xl bg-orange-100/70 border border-orange-200 flex items-center justify-center text-orange-600 mb-4 shadow-sm">
        <SearchX className="w-8 h-8 stroke-[1.5]" />
      </div>
      <h3 className="text-lg font-semibold text-slate-900">No dishes matched your filters</h3>
      <p className="text-sm text-slate-500 mt-1">
        {searchQuery ? (
          <>
            No dish found matching &ldquo;<span className="font-medium text-slate-700">{searchQuery}</span>&rdquo;.
          </>
        ) : (
          'There are currently no dishes to display.'
        )}
      </p>
      <button
        onClick={onClear}
        className="mt-5 px-4 py-2 text-sm font-medium text-orange-700 bg-orange-50 hover:bg-orange-100 border border-orange-200 rounded-lg transition-colors"
      >
        Reset filters
      </button>
    </div>
  );
};
