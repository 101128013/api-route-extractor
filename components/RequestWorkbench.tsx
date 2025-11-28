import React, { useMemo, useState } from 'react';
import type { ApiEndpoint, RequestDraft, RequestBodyMode, FormDataEntry, KeyValuePair } from '../types';
import { RequestBodyModePicker } from './requestWorkbench/RequestBodyModePicker';
import { RequestKeyValueEditor } from './requestWorkbench/RequestKeyValueEditor';
import { RequestResponseViewer } from './requestWorkbench/RequestResponseViewer';
import { AuthRecommendations } from './requestWorkbench/AuthRecommendations';
import { MethodSelector } from './requestWorkbench/MethodSelector';
import { RequestCodePreview } from './requestWorkbench/RequestCodePreview';
import { SendIcon, HistoryIcon, PlusIcon } from './icons';

export interface WorkbenchRequestState {
  draft: RequestDraft;
  setDraft: (draft: RequestDraft) => void;
  setBodyMode: (mode: RequestBodyMode) => void;
  setFormData: (entries: FormDataEntry[]) => void;
  setUrlEncoded: (entries: KeyValuePair[]) => void;
}

interface RequestWorkbenchProps {
  isOpen: boolean;
  endpoint?: ApiEndpoint;
  requestState: WorkbenchRequestState;
  onSend: () => void;
  isSending: boolean;
  response?: {
    status: number;
    statusText: string;
    headers: Record<string, string>;
    body: string;
    duration: number;
  };
  error?: string;
  environments?: { id: string; name: string }[];
  activeEnvironmentId?: string | null;
  onClose: () => void;
  onSaveDraft?: () => void;
  onLoadFromHistory?: () => void;
  savedDrafts?: RequestDraft[];
  onLoadSavedDraft?: (id: string) => void;
  onDeleteDraft?: (id: string) => void;
}

export const RequestWorkbench: React.FC<RequestWorkbenchProps> = ({
  isOpen,
  endpoint,
  requestState,
  onSend,
  isSending,
  response,
  error,
  environments = [],
  activeEnvironmentId,
  onClose,
  onSaveDraft,
  onLoadFromHistory,
  savedDrafts,
  onLoadSavedDraft,
  onDeleteDraft,
}) => {
  const { draft } = requestState;
  const [selectedDraftId, setSelectedDraftId] = useState('');

  const activeEnvName = useMemo(() => {
    if (!activeEnvironmentId) return 'None';
    return environments.find((env) => env.id === activeEnvironmentId)?.name || 'Unknown';
  }, [activeEnvironmentId, environments]);

  const handleSavedDraftChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const id = e.target.value;
    setSelectedDraftId(id);
    if (id) {
      onLoadSavedDraft?.(id);
    }
  };

  const handleDeleteDraftClick = () => {
    if (selectedDraftId) {
      onDeleteDraft?.(selectedDraftId);
      setSelectedDraftId('');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-end z-[60]">
      <div className="bg-brand-surface border-l border-brand-primary/30 w-[720px] h-full flex flex-col shadow-2xl">
        <header className="p-4 border-b border-brand-primary/20 flex items-center justify-between">
          <div>
            <p className="text-xs uppercase text-brand-subtle">Workbench</p>
            <h2 className="text-xl font-semibold text-brand-text">
              {endpoint ? `${endpoint.method} ${endpoint.path}` : 'New Request'}
            </h2>
            <p className="text-xs text-brand-subtle mt-1">Environment: {activeEnvName}</p>
          </div>
          <div className="flex gap-2">
            {savedDrafts && savedDrafts.length > 0 && onLoadSavedDraft && (
              <div className="flex items-center gap-2">
                <select
                  value={selectedDraftId}
                  onChange={handleSavedDraftChange}
                  className="bg-black/40 border border-brand-primary/40 rounded px-2 py-1 text-xs text-brand-text"
                >
                  <option value="">Saved drafts</option>
                  {savedDrafts.map((saved) => (
                    <option key={saved.id} value={saved.id}>
                      {saved.name || saved.id}
                    </option>
                  ))}
                </select>
                {onDeleteDraft && (
                  <button
                    onClick={handleDeleteDraftClick}
                    disabled={!selectedDraftId}
                    className="text-xs text-brand-subtle hover:text-red-400 disabled:opacity-50"
                  >
                    Delete
                  </button>
                )}
              </div>
            )}
            {onLoadFromHistory && (
              <button
                onClick={onLoadFromHistory}
                className="flex items-center gap-1 px-3 py-1.5 text-sm text-brand-text bg-brand-bg border border-brand-primary rounded hover:bg-brand-primary/10"
              >
                <HistoryIcon />
                Load
              </button>
            )}
            {onSaveDraft && (
              <button
                onClick={onSaveDraft}
                className="flex items-center gap-1 px-3 py-1.5 text-sm text-brand-text bg-brand-bg border border-brand-primary rounded hover:bg-brand-primary/10"
              >
                <PlusIcon />
                Save Draft
              </button>
            )}
            <button
              onClick={onClose}
              className="px-3 py-1.5 text-sm text-brand-subtle hover:text-brand-text border border-transparent hover:border-brand-primary rounded"
            >
              Close
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <section className="bg-brand-bg border border-brand-primary/30 rounded-lg p-4 space-y-3">
            <div className="flex gap-3 items-center">
              <MethodSelector
                method={draft.method}
                onChange={(method) => requestState.setDraft({ ...draft, method })}
              />
              <input
                type="text"
                value={draft.url}
                onChange={(e) => requestState.setDraft({ ...draft, url: e.target.value })}
                className="flex-1 bg-black/40 border border-brand-primary/40 rounded px-3 py-2 text-sm text-brand-text"
                placeholder="https://api.example.com/resource"
              />
              <button
                onClick={onSend}
                disabled={isSending}
                className="flex items-center gap-2 px-4 py-2 bg-brand-secondary rounded-md text-white text-sm font-semibold disabled:opacity-50"
              >
                <SendIcon />
                {isSending ? 'Sending...' : 'Send'}
              </button>
            </div>
            <div className="text-xs text-brand-subtle">
              Supports variable syntax like <code className="px-1 bg-black/30 rounded">https://api.example.com/{{version}}/users</code>
            </div>
          </section>

          <RequestBodyModePicker
            mode={draft.bodyMode}
            rawBody={draft.rawBody || ''}
            formData={draft.formData || []}
            urlEncoded={draft.urlEncoded || []}
            onModeChange={requestState.setBodyMode}
            onRawBodyChange={(rawBody) => requestState.setDraft({ ...draft, rawBody })}
            onFormDataChange={requestState.setFormData}
            onUrlEncodedChange={requestState.setUrlEncoded}
          />

          <RequestKeyValueEditor
            title="Headers"
            entries={draft.headers}
            kind="header"
            onChange={(headers) => requestState.setDraft({ ...draft, headers })}
          />

          <RequestKeyValueEditor
            title="Query Params"
            entries={draft.params}
            kind="param"
            onChange={(params) => requestState.setDraft({ ...draft, params })}
          />

          <AuthRecommendations
            endpoint={endpoint}
            selectedAuthConfigIds={draft.authConfigIds}
            onAuthToggle={(config) => {
              const exists = draft.authConfigIds.includes(config);
              const updated = exists
                ? draft.authConfigIds.filter((id) => id !== config)
                : [...draft.authConfigIds, config];
              requestState.setDraft({ ...draft, authConfigIds: updated });
            }}
          />

          <RequestResponseViewer response={response} error={error} isLoading={isSending} />
          <RequestCodePreview draft={draft} />
        </div>
      </div>
    </div>
  );
};

