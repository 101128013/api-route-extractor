import React from 'react';
import { SettingsIcon } from './icons';

interface HeaderProps {
  onOpenSettings: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onOpenSettings }) => {
  return (
    <header className="bg-brand-surface border-b border-brand-primary px-6 py-3 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 bg-gradient-to-br from-brand-secondary to-blue-600 rounded-lg flex items-center justify-center shadow-lg shadow-brand-secondary/20">
          <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
        </div>
        <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-brand-subtle">
          API Route Extractor
        </h1>
      </div>
      
      <button
        onClick={onOpenSettings}
        className="p-2 text-brand-subtle hover:text-white hover:bg-brand-primary rounded-md transition-colors"
        title="Settings"
      >
        <SettingsIcon />
      </button>
    </header>
  );
};
