
import React from 'react';
import type { ApiEndpoint } from '../types';
import { EndpointCard } from './EndpointCard';
import { EmptyStateIcon, ErrorIcon, SpinnerIcon, DownloadIcon, SparklesIcon, CodeBracketIcon, ChevronDownIcon } from './icons';
import { generateOpenApiSpec, generatePostmanCollection, downloadFile } from '../services/ExportService';


import type { Collection, RequestHistoryItem } from '../types';

interface ResultsDisplayProps {
  endpoints: ApiEndpoint[];
  isLoading: boolean;
  error: string | null;
  source: string | null;
  analysisCode: string | null;
  onUpdateEndpoint: (index: number, updatedEndpoint: ApiEndpoint) => void;
  totalCost: number;
  variables?: Record<string, string>;
  collections?: Collection[];
  selectedCollectionId?: string | null;
  onCollectionSelect?: (id: string | null) => void;
  onRequestExecuted?: (endpoint: ApiEndpoint, request: any, response: any, success: boolean, error?: string) => void;
  onOpenTests?: (endpoint: ApiEndpoint) => void;
  onOpenHistory?: (endpoint: ApiEndpoint) => void;
  onOpenWorkbench?: (endpoint: ApiEndpoint) => void;
}

export const ResultsDisplay: React.FC<ResultsDisplayProps> = ({ 
  endpoints, 
  isLoading, 
  error, 
  source, 
  analysisCode, 
  onUpdateEndpoint, 
  totalCost, 
  variables,
  collections = [],
  selectedCollectionId,
  onCollectionSelect,
  onRequestExecuted,
  onOpenTests,
  onOpenHistory,
  onOpenWorkbench,
}) => {

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

  const handleExportOpenApi = () => {
    const spec = generateOpenApiSpec(endpoints);
    downloadFile(spec, 'openapi.json', 'application/json');
  };

  const handleExportPostman = () => {
    const collection = generatePostmanCollection(endpoints);
    downloadFile(collection, 'postman_collection.json', 'application/json');
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
            variables={variables}
            onRequestExecuted={onRequestExecuted}
            onOpenTests={onOpenTests}
            onOpenHistory={onOpenHistory}
            onOpenWorkbench={onOpenWorkbench}
          />
        ))}
      </div>
    );
  };

  return (
    <div className="flex flex-col bg-brand-surface rounded-lg border border-brand-primary h-full">
      <div className="flex flex-col p-3 border-b border-brand-primary">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-bold text-brand-text flex items-center gap-2">
              <SparklesIcon className="text-brand-secondary" />
              Extracted Endpoints ({endpoints.length})
            </h2>
            {collections && collections.length > 0 && onCollectionSelect && (
              <select
                value={selectedCollectionId || ''}
                onChange={(e) => onCollectionSelect(e.target.value || null)}
                className="bg-brand-surface border border-brand-primary rounded px-3 py-1 text-sm text-brand-text"
              >
                <option value="">All Endpoints</option>
                {collections.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            )}
            <span className="text-sm text-brand-subtle bg-brand-primary/20 px-2 py-1 rounded-full border border-brand-primary/50">
              Cost: ${totalCost.toFixed(5)} USD / ${(totalCost * 1.40).toFixed(5)} CAD
            </span>
          </div>
          <div className="flex gap-2">
              {endpoints.length > 0 && !isLoading && !error && (
                <>
                  <button
                      onClick={handleExportOpenApi}
                      className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-brand-text bg-brand-surface border border-brand-primary rounded-md hover:bg-brand-primary transition-colors"
                  >
                      <DownloadIcon /> OpenAPI
                  </button>
                  <button
                      onClick={handleExportPostman}
                      className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-brand-text bg-brand-surface border border-brand-primary rounded-md hover:bg-brand-primary transition-colors"
                  >
                      <DownloadIcon /> Postman
                  </button>
                </>
              )}
          </div>
        </div>
        <div className="flex justify-between items-center">
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
      
      {analysisCode && (
        <div className="px-4 py-2 border-b border-brand-primary bg-brand-bg/50">
            <details className="group">
                <summary className="flex items-center gap-2 cursor-pointer text-xs text-brand-subtle hover:text-brand-text transition-colors select-none">
                    <CodeBracketIcon />
                    <span>View Analyzed Source ({analysisCode.length} chars)</span>
                    <ChevronDownIcon className="w-4 h-4 transition-transform group-open:rotate-180" />
                </summary>
                <div className="mt-2 p-3 bg-black/30 rounded-md border border-brand-primary overflow-x-auto">
                    <pre className="text-xs font-mono text-brand-subtle whitespace-pre-wrap break-all max-h-60 overflow-y-auto">
                        {analysisCode.slice(0, 10000)}
                        {analysisCode.length > 10000 && <span className="text-brand-secondary italic">... (truncated)</span>}
                    </pre>
                </div>
            </details>
        </div>
      )}

      <div className="p-4 flex-grow overflow-y-auto">
        {renderContent()}
      </div>
    </div>
  );
};