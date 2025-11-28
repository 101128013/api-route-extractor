import React, { useMemo, useState } from 'react';

interface RequestResponseViewerProps {
  response?: {
    status: number;
    statusText: string;
    headers: Record<string, string>;
    body: string;
    duration: number;
  };
  error?: string;
  isLoading: boolean;
}

type ViewerTab = 'body' | 'headers' | 'raw';

export const RequestResponseViewer: React.FC<RequestResponseViewerProps> = ({
  response,
  error,
  isLoading,
}) => {
  const [activeTab, setActiveTab] = useState<ViewerTab>('body');

  const prettyBody = useMemo(() => {
    if (!response?.body) return '';
    try {
      return JSON.stringify(JSON.parse(response.body), null, 2);
    } catch {
      return response.body;
    }
  }, [response?.body]);

  const renderContent = () => {
    if (isLoading) {
      return <div className="text-brand-subtle text-sm">Sending request...</div>;
    }

    if (error) {
      return <pre className="text-red-400 text-xs whitespace-pre-wrap break-all">{error}</pre>;
    }

    if (!response) {
      return <div className="text-brand-subtle text-sm">No response yet.</div>;
    }

    switch (activeTab) {
      case 'body':
        return <pre className="text-xs whitespace-pre-wrap break-all">{prettyBody}</pre>;
      case 'headers':
        return (
          <div className="space-y-1 text-xs">
            {Object.entries(response.headers).map(([key, value]) => (
              <div key={key} className="flex gap-2">
                <span className="text-brand-secondary font-semibold w-40">{key}</span>
                <span className="text-brand-text flex-1">{value}</span>
              </div>
            ))}
          </div>
        );
      case 'raw':
        return <pre className="text-xs whitespace-pre-wrap break-all">{response.body}</pre>;
    }
  };

  return (
    <section className="bg-brand-bg border border-brand-primary/30 rounded-lg p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h4 className="text-sm font-semibold text-brand-text">Response</h4>
          {response && (
            <p className="text-xs text-brand-subtle">
              {response.status} {response.statusText} · {response.duration}ms
            </p>
          )}
        </div>
        <div className="flex gap-2 text-xs">
          {(['body', 'headers', 'raw'] as ViewerTab[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-2 py-1 rounded border ${
                activeTab === tab
                  ? 'border-brand-secondary text-brand-secondary'
                  : 'border-transparent text-brand-subtle hover:text-brand-text'
              }`}
            >
              {tab.toUpperCase()}
            </button>
          ))}
        </div>
      </div>
      <div className="bg-black/40 rounded p-3 min-h-[200px] text-brand-text">{renderContent()}</div>
    </section>
  );
};

