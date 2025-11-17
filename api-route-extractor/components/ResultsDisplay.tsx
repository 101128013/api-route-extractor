
import React from 'react';
import type { ApiEndpoint } from '../types';
import { EndpointCard } from './EndpointCard';
import { EmptyStateIcon, ErrorIcon, SpinnerIcon, DownloadIcon } from './icons';


interface ResultsDisplayProps {
  endpoints: ApiEndpoint[];
  isLoading: boolean;
  error: string | null;
  source: string | null;
  analysisCode: string | null;
  onUpdateEndpoint: (index: number, updatedEndpoint: ApiEndpoint) => void;
}

export const ResultsDisplay: React.FC<ResultsDisplayProps> = ({ endpoints, isLoading, error, source, analysisCode, onUpdateEndpoint }) => {

  const handleDownload = () => {
    if (endpoints.length === 0 || isLoading || error) {
      return;
    }

    const jsonContent = JSON.stringify(endpoints, null, 2);
    const blob = new Blob([jsonContent], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'api-routes-map.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };


  const renderContent = () => {
    if (isLoading) {
      return (
        <div className="flex flex-col items-center justify-center h-full text-brand-subtle">
            <SpinnerIcon />
            <p className="mt-4 text-lg">Analyzing code with Gemini...</p>
        </div>
      );
    }

    if (error) {
      return (
        <div className="flex flex-col items-center justify-center h-full text-brand-secondary p-4 text-center">
            <ErrorIcon />
            <p className="mt-4 text-lg font-semibold">Analysis Failed</p>
            <p className="mt-2 text-brand-text">{error}</p>
        </div>
      );
    }

    if (endpoints.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center h-full text-brand-subtle text-center p-4">
            <EmptyStateIcon />
            <p className="mt-4 text-lg">No endpoints found yet</p>
            <p className="mt-1 text-sm">Paste some code or enter a URL and click "Extract" to begin.</p>
        </div>
      );
    }

    return (
      <div className="space-y-3">
        {endpoints.map((endpoint, index) => (
          <EndpointCard 
            key={`${endpoint.path}-${index}`} 
            endpoint={endpoint} 
            analysisCode={analysisCode} 
            index={index}
            onUpdate={onUpdateEndpoint}
          />
        ))}
      </div>
    );
  };

  return (
    <div className="flex flex-col bg-brand-surface rounded-lg border border-brand-primary h-full">
      <div className="flex justify-between items-center p-3 border-b border-brand-primary">
        <h2 className="text-lg font-semibold">Extracted Endpoints</h2>
        <div className="flex items-center gap-2">
            {source && !isLoading && !error && (
                <span className="text-xs text-brand-subtle bg-brand-primary px-2 py-1 rounded-md truncate max-w-xs" title={source}>Source: {source}</span>
            )}
            {endpoints.length > 0 && !isLoading && !error && (
                <button
                    onClick={handleDownload}
                    className="flex items-center gap-2 p-1.5 rounded-md hover:bg-brand-primary text-brand-subtle hover:text-white transition-colors"
                    title="Download API map as JSON"
                    aria-label="Download API map as JSON"
                >
                    <DownloadIcon />
                    <span className="text-xs hidden sm:inline">Download</span>
                </button>
            )}
        </div>
      </div>
      <div className="p-4 flex-grow overflow-y-auto">
        {renderContent()}
      </div>
    </div>
  );
};