import React, { useState, useEffect } from 'react';
import { HistoryService } from '../services/HistoryService';
import type { RequestHistoryItem } from '../types';
import { HistoryIcon, XIcon, TrashIcon, PlayIcon, ChevronDownIcon } from './icons';

interface RequestHistoryProps {
  isOpen: boolean;
  onClose: () => void;
  endpointId?: string;
  onReplay?: (item: RequestHistoryItem) => void;
}

export const RequestHistory: React.FC<RequestHistoryProps> = ({
  isOpen,
  onClose,
  endpointId,
  onReplay,
}) => {
  const [history, setHistory] = useState<RequestHistoryItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const [stats, setStats] = useState(HistoryService.getHistoryStats());

  useEffect(() => {
    if (isOpen) {
      const items = endpointId
        ? HistoryService.getHistoryForEndpoint(endpointId)
        : HistoryService.getHistory();
      setHistory(items);
      setStats(HistoryService.getHistoryStats());
    }
  }, [isOpen, endpointId]);

  const handleSearch = (query: string) => {
    setSearchQuery(query);
    if (query.trim()) {
      const results = HistoryService.searchHistory(query);
      setHistory(results);
    } else {
      const items = endpointId
        ? HistoryService.getHistoryForEndpoint(endpointId)
        : HistoryService.getHistory();
      setHistory(items);
    }
  };

  const handleDelete = (id: string) => {
    HistoryService.deleteHistoryItem(id);
    const items = endpointId
      ? HistoryService.getHistoryForEndpoint(endpointId)
      : HistoryService.getHistory();
    setHistory(items);
    setStats(HistoryService.getHistoryStats());
  };

  const handleClear = () => {
    if (confirm('Clear all request history?')) {
      HistoryService.clearHistory();
      setHistory([]);
      setStats(HistoryService.getHistoryStats());
    }
  };

  const toggleExpand = (id: string) => {
    const newExpanded = new Set(expandedItems);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedItems(newExpanded);
  };

  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
  };

  const getStatusColor = (status: number) => {
    if (status >= 200 && status < 300) return 'text-green-400';
    if (status >= 400 && status < 500) return 'text-yellow-400';
    if (status >= 500) return 'text-red-400';
    return 'text-brand-subtle';
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-brand-surface border border-brand-primary rounded-lg shadow-xl w-[900px] h-[700px] flex flex-col">
        <div className="p-4 border-b border-brand-primary flex justify-between items-center">
          <div className="flex items-center gap-2">
            <HistoryIcon />
            <h2 className="text-xl font-semibold text-brand-text">Request History</h2>
            <span className="text-sm text-brand-subtle">
              ({stats.total} total, {stats.successful} successful, {stats.failed} failed)
            </span>
          </div>
          <div className="flex items-center gap-2">
            {history.length > 0 && (
              <button
                onClick={handleClear}
                className="text-sm text-red-400 hover:text-red-300"
              >
                Clear All
              </button>
            )}
            <button onClick={onClose} className="text-brand-subtle hover:text-brand-text">
              <XIcon />
            </button>
          </div>
        </div>

        <div className="p-4 border-b border-brand-primary">
          <input
            type="text"
            placeholder="Search history..."
            value={searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
            className="w-full bg-brand-bg border border-brand-primary rounded px-3 py-2 text-brand-text"
          />
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {history.length === 0 ? (
            <div className="text-center text-brand-subtle py-8">
              <p>No request history yet.</p>
            </div>
          ) : (
            history.map((item) => (
              <div
                key={item.id}
                className="bg-brand-bg border border-brand-primary rounded-lg p-3"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 flex-1">
                    <span className={`font-bold ${getStatusColor(item.response.status)}`}>
                      {item.response.status}
                    </span>
                    <span className="text-sm font-mono text-brand-text">
                      {item.request.method} {item.request.url}
                    </span>
                    <span className="text-xs text-brand-subtle">
                      {formatDuration(item.response.duration)}
                    </span>
                    <span className="text-xs text-brand-subtle">
                      {new Date(item.timestamp).toLocaleString()}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {onReplay && (
                      <button
                        onClick={() => onReplay(item)}
                        className="p-1 text-brand-subtle hover:text-brand-secondary"
                        title="Replay Request"
                      >
                        <PlayIcon />
                      </button>
                    )}
                    <button
                      onClick={() => toggleExpand(item.id)}
                      className="p-1 text-brand-subtle hover:text-brand-text"
                    >
                      <ChevronDownIcon
                        className={`w-4 h-4 transition-transform ${
                          expandedItems.has(item.id) ? 'rotate-180' : ''
                        }`}
                      />
                    </button>
                    <button
                      onClick={() => handleDelete(item.id)}
                      className="p-1 text-red-400 hover:text-red-300"
                      title="Delete"
                    >
                      <TrashIcon className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {expandedItems.has(item.id) && (
                  <div className="mt-3 space-y-2 border-t border-brand-primary pt-3">
                    <div>
                      <h4 className="text-sm font-semibold text-brand-text mb-1">Request</h4>
                      <div className="bg-black/30 rounded p-2 text-xs font-mono text-brand-subtle overflow-x-auto">
                        <div>Method: {item.request.method}</div>
                        <div>URL: {item.request.url}</div>
                        {Object.keys(item.request.headers).length > 0 && (
                          <div>
                            Headers:
                            <pre className="mt-1">
                              {JSON.stringify(item.request.headers, null, 2)}
                            </pre>
                          </div>
                        )}
                        {item.request.body && (
                          <div>
                            Body:
                            <pre className="mt-1">{item.request.body}</pre>
                          </div>
                        )}
                      </div>
                    </div>
                    <div>
                      <h4 className="text-sm font-semibold text-brand-text mb-1">Response</h4>
                      <div className="bg-black/30 rounded p-2 text-xs font-mono text-brand-subtle overflow-x-auto max-h-48 overflow-y-auto">
                        <div>Status: {item.response.status} {item.response.statusText}</div>
                        <div>Duration: {formatDuration(item.response.duration)}</div>
                        {Object.keys(item.response.headers).length > 0 && (
                          <div>
                            Headers:
                            <pre className="mt-1">
                              {JSON.stringify(item.response.headers, null, 2)}
                            </pre>
                          </div>
                        )}
                        <div>
                          Body:
                          <pre className="mt-1 whitespace-pre-wrap break-all">
                            {item.response.body.length > 1000
                              ? item.response.body.substring(0, 1000) + '...'
                              : item.response.body}
                          </pre>
                        </div>
                      </div>
                    </div>
                    {item.testResults && item.testResults.length > 0 && (
                      <div>
                        <h4 className="text-sm font-semibold text-brand-text mb-1">Test Results</h4>
                        {item.testResults.map((test, idx) => (
                          <div
                            key={idx}
                            className={`p-2 rounded text-xs ${
                              test.passed ? 'bg-green-500/20' : 'bg-red-500/20'
                            }`}
                          >
                            {test.testName}: {test.passed ? '✓ Passed' : '✗ Failed'}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

