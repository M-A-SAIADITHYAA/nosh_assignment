import React from 'react';
import { UtensilsCrossed } from 'lucide-react';

interface BrokenImageFallbackProps {
  dishName: string;
}

export const BrokenImageFallback: React.FC<BrokenImageFallbackProps> = ({ dishName }) => {
  return (
    <div className="w-full h-48 bg-gradient-to-br from-slate-100 to-slate-200 border-b border-slate-200 flex flex-col items-center justify-center p-4 text-center select-none">
      <div className="w-12 h-12 rounded-full bg-slate-300/70 flex items-center justify-center text-slate-500 mb-2 shadow-inner">
        <UtensilsCrossed className="w-6 h-6 stroke-[1.5]" />
      </div>
      <p className="text-xs font-semibold text-slate-700 line-clamp-1">{dishName || 'Dish'}</p>
      <span className="text-[11px] text-slate-500 mt-0.5">Image could not be loaded</span>
    </div>
  );
};
