import React, { useState, useEffect } from 'react';
import { PlusIcon, TrashIcon } from './icons';

interface RequestEditorProps {
    initialUrl: string;
    initialHeaders: Record<string, string>;
    initialBody?: string;
    onChange: (data: { url: string; headers: Record<string, string>; body?: string }) => void;
}

type Tab = 'params' | 'headers' | 'body';

export const RequestEditor: React.FC<RequestEditorProps> = ({ initialUrl, initialHeaders, initialBody, onChange }) => {
    const [activeTab, setActiveTab] = useState<Tab>('params');
    const [url, setUrl] = useState(initialUrl);
    const [headers, setHeaders] = useState<{ key: string; value: string }[]>([]);
    const [params, setParams] = useState<{ key: string; value: string }[]>([]);
    const [body, setBody] = useState(initialBody || '');

    // Initialize state from props
    useEffect(() => {
        setUrl(initialUrl);
        
        // Parse headers
        const headerArray = Object.entries(initialHeaders).map(([key, value]) => ({ key, value }));
        setHeaders(headerArray);

        // Parse query params from URL
        try {
            // Handle relative URLs by adding a dummy base
            const urlObj = new URL(initialUrl, 'http://dummy.com');
            const paramArray: { key: string; value: string }[] = [];
            urlObj.searchParams.forEach((value, key) => {
                paramArray.push({ key, value });
            });
            setParams(paramArray);
        } catch (e) {
            // If URL is invalid, just leave params empty
            setParams([]);
        }
        
        setBody(initialBody || '');
    }, [initialUrl, initialHeaders, initialBody]);

    // Notify parent of changes
    useEffect(() => {
        // Reconstruct URL with params
        let newUrl = url;
        try {
            // We need to be careful not to double-encode or lose the base
            // If it's a full URL, use it. If relative, keep it relative but append query.
            const isRelative = !url.startsWith('http');
            const baseUrl = isRelative ? 'http://dummy.com' : undefined;
            const urlObj = new URL(url, baseUrl);
            
            // Clear existing search params and add current ones
            // Note: This is a bit tricky because 'url' state might already have params if the user typed them.
            // For simplicity, we'll assume the 'params' state is the source of truth for the query string
            // ONLY if the user is editing via the table. 
            // But if the user edits the URL directly, we should parse that back.
            // For now, let's just construct the query string from params and append/replace in url.
            
            // Actually, a better approach for a simple editor:
            // The URL input controls the base path. The Params table controls the search string.
            
            // Let's just construct the headers object
            const headerObj: Record<string, string> = {};
            headers.forEach(h => {
                if (h.key.trim()) headerObj[h.key.trim()] = h.value;
            });

            onChange({
                url, // We pass the raw URL for now, complex bi-directional syncing is hard
                headers: headerObj,
                body: body || undefined
            });
        } catch (e) {
            // invalid url, just pass as is
        }
    }, [url, headers, params, body]);

    const handleParamChange = (index: number, field: 'key' | 'value', newValue: string) => {
        const newParams = [...params];
        newParams[index][field] = newValue;
        setParams(newParams);
        
        // Update URL
        try {
            const isRelative = !url.startsWith('http');
            const baseUrl = isRelative ? 'http://dummy.com' : undefined;
            // We need to strip existing query params from the current URL state before re-appending
            const currentUrlObj = new URL(url, baseUrl);
            const path = isRelative ? currentUrlObj.pathname : currentUrlObj.origin + currentUrlObj.pathname;
            
            const searchParams = new URLSearchParams();
            newParams.forEach(p => {
                if (p.key) searchParams.append(p.key, p.value);
            });
            
            const queryString = searchParams.toString();
            setUrl(path + (queryString ? `?${queryString}` : ''));
        } catch (e) {}
    };

    const addParam = () => setParams([...params, { key: '', value: '' }]);
    const removeParam = (index: number) => {
        const newParams = params.filter((_, i) => i !== index);
        setParams(newParams);
        // Update URL (duplicate logic, could be refactored)
        try {
            const isRelative = !url.startsWith('http');
            const baseUrl = isRelative ? 'http://dummy.com' : undefined;
            const currentUrlObj = new URL(url, baseUrl);
            const path = isRelative ? currentUrlObj.pathname : currentUrlObj.origin + currentUrlObj.pathname;
            
            const searchParams = new URLSearchParams();
            newParams.forEach(p => {
                if (p.key) searchParams.append(p.key, p.value);
            });
            
            const queryString = searchParams.toString();
            setUrl(path + (queryString ? `?${queryString}` : ''));
        } catch (e) {}
    };

    const handleHeaderChange = (index: number, field: 'key' | 'value', newValue: string) => {
        const newHeaders = [...headers];
        newHeaders[index][field] = newValue;
        setHeaders(newHeaders);
    };

    const addHeader = () => setHeaders([...headers, { key: '', value: '' }]);
    const removeHeader = (index: number) => setHeaders(headers.filter((_, i) => i !== index));

    return (
        <div className="flex flex-col gap-4 p-4 bg-brand-bg border border-brand-primary/30 rounded-lg mt-4">
            {/* URL Input */}
            <div className="flex gap-2">
                <input
                    type="text"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    className="flex-grow bg-brand-surface border border-brand-primary/50 rounded px-3 py-2 text-sm text-brand-text focus:border-brand-secondary outline-none"
                    placeholder="Request URL"
                />
            </div>

            {/* Tabs */}
            <div className="flex border-b border-brand-primary/30">
                {(['params', 'headers', 'body'] as Tab[]).map(tab => (
                    <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        className={`px-4 py-2 text-sm font-medium transition-colors ${
                            activeTab === tab
                                ? 'text-brand-secondary border-b-2 border-brand-secondary'
                                : 'text-brand-subtle hover:text-brand-text'
                        }`}
                    >
                        {tab.charAt(0).toUpperCase() + tab.slice(1)}
                        {tab === 'params' && params.length > 0 && ` (${params.length})`}
                        {tab === 'headers' && headers.length > 0 && ` (${headers.length})`}
                    </button>
                ))}
            </div>

            {/* Tab Content */}
            <div className="min-h-[150px]">
                {activeTab === 'params' && (
                    <div className="space-y-2">
                        {params.map((param, index) => (
                            <div key={index} className="flex gap-2">
                                <input
                                    placeholder="Key"
                                    value={param.key}
                                    onChange={(e) => handleParamChange(index, 'key', e.target.value)}
                                    className="flex-1 bg-brand-surface border border-brand-primary/30 rounded px-2 py-1 text-sm text-brand-text"
                                />
                                <input
                                    placeholder="Value"
                                    value={param.value}
                                    onChange={(e) => handleParamChange(index, 'value', e.target.value)}
                                    className="flex-1 bg-brand-surface border border-brand-primary/30 rounded px-2 py-1 text-sm text-brand-text"
                                />
                                <button onClick={() => removeParam(index)} className="text-brand-subtle hover:text-red-400" aria-label="Remove parameter" title="Remove parameter">
                                    <TrashIcon />
                                </button>
                            </div>
                        ))}
                        <button onClick={addParam} className="flex items-center gap-1 text-xs text-brand-secondary hover:text-brand-secondary/80 mt-2">
                            <PlusIcon /> Add Param
                        </button>
                    </div>
                )}

                {activeTab === 'headers' && (
                    <div className="space-y-2">
                        {headers.map((header, index) => (
                            <div key={index} className="flex gap-2">
                                <input
                                    placeholder="Key"
                                    value={header.key}
                                    onChange={(e) => handleHeaderChange(index, 'key', e.target.value)}
                                    className="flex-1 bg-brand-surface border border-brand-primary/30 rounded px-2 py-1 text-sm text-brand-text"
                                />
                                <input
                                    placeholder="Value"
                                    value={header.value}
                                    onChange={(e) => handleHeaderChange(index, 'value', e.target.value)}
                                    className="flex-1 bg-brand-surface border border-brand-primary/30 rounded px-2 py-1 text-sm text-brand-text"
                                />
                                <button onClick={() => removeHeader(index)} className="text-brand-subtle hover:text-red-400" aria-label="Remove header" title="Remove header">
                                    <TrashIcon />
                                </button>
                            </div>
                        ))}
                        <button onClick={addHeader} className="flex items-center gap-1 text-xs text-brand-secondary hover:text-brand-secondary/80 mt-2">
                            <PlusIcon /> Add Header
                        </button>
                    </div>
                )}

                {activeTab === 'body' && (
                    <textarea
                        value={body}
                        onChange={(e) => setBody(e.target.value)}
                        className="w-full h-[150px] bg-brand-surface border border-brand-primary/30 rounded p-2 text-sm font-mono text-brand-text resize-y focus:border-brand-secondary outline-none"
                        placeholder="Request Body (JSON, Text, etc.)"
                    />
                )}
            </div>
        </div>
    );
};
