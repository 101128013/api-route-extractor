
import React from 'react';

const ApiIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-brand-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M8 9l3 3-3 3m5 0h3M4 21h16a2 2 0 002-2V5a2 2 0 00-2-2H4a2 2 0 00-2 2v14a2 2 0 002 2z" />
    </svg>
);


export const Header: React.FC = () => {
  return (
    <header className="bg-brand-surface/50 backdrop-blur-sm border-b border-brand-primary p-4 sticky top-0 z-10">
      <div className="container mx-auto flex items-center gap-4">
        <ApiIcon />
        <h1 className="text-2xl font-bold text-white tracking-tight">API Route Extractor</h1>
      </div>
    </header>
  );
};
