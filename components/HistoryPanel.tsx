
import React from 'react';
import type { HistoryItem } from '../types';
import { HistoryIcon, TrashIcon } from './icons';

interface HistoryPanelProps {
  history: HistoryItem[];
  onLoad: (item: HistoryItem) => void;
  onDelete: (id: string) => void;
  onClearAll: () => void;
}

export const HistoryPanel: React.FC<HistoryPanelProps> = ({ history, onLoad, onDelete, onClearAll }) => {
  const sortedHistory = [...history].sort((a, b) => b.timestamp - a.timestamp);

  return (
    <div className="flex flex-col bg-brand-surface rounded-lg border border-brand-primary h-full">
      <div className="flex justify-between items-center p-3 border-b border-brand-primary flex-shrink-0">
        <div className="flex items-center gap-2">
            <HistoryIcon />
            <h2 className="text-lg font-semibold">History</h2>
        </div>
        {history.length > 0 && (
            <button
                onClick={onClearAll}
                className="text-xs text-brand-subtle hover:text-red-400 transition-colors font-semibold"
                title="Clear all history"
            >
                Clear All
            </button>
        )}
      </div>
      <div className="flex-grow overflow-y-auto">
        {sortedHistory.length === 0 ? (
            <div className="p-4 text-center text-sm text-brand-subtle h-full flex items-center justify-center">
                <p>Your analysis history will appear here.</p>
            </div>
        ) : (
            <ul className="divide-y divide-brand-primary">
                {sortedHistory.map((item) => (
                    <li key={item.id} className="p-3 hover:bg-brand-primary/30 group">
                        <div className="flex justify-between items-start gap-2">
                            <div className="flex-grow min-w-0">
                                <p className="text-sm font-semibold truncate text-brand-text" title={item.source}>
                                    {item.source}
                                </p>
                                <p className="text-xs text-brand-subtle mt-1">
                                    {new Date(item.timestamp).toLocaleString()} &bull; {item.endpoints.length} endpoint(s)
                                </p>
                            </div>
                            <div className="flex-shrink-0 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button
                                    onClick={() => onDelete(item.id)}
                                    className="p-1.5 rounded-md text-brand-subtle hover:bg-brand-primary hover:text-red-400"
                                    title="Delete item"
                                >
                                    <TrashIcon className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                        <button
                            onClick={() => onLoad(item)}
                            className="mt-2 w-full text-center text-xs font-semibold bg-brand-primary hover:bg-brand-secondary/80 text-white py-1.5 rounded-md transition-colors"
                        >
                            Load Analysis
                        </button>
                    </li>
                ))}
            </ul>
        )}
      </div>
    </div>
  );
};
