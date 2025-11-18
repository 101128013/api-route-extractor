import React, { useState, useRef, useEffect, useId } from 'react';
import type { ApiEndpoint } from '../types';
import { analyzeApiCall, createChatSession } from '../services/geminiService';
import type { Chat } from '@google/genai';
import {
    CheckIcon,
    CopyIcon,
    SparklesIcon,
    CheckCircleIcon,
    LockClosedIcon,
    XCircleIcon,
    DocumentTextIcon,
    ExclamationTriangleIcon,
    ChevronDownIcon,
    PlayIcon,
    SpinnerIcon,
    UserIcon,
    BotIcon,
    SendIcon,
    PencilIcon
} from './icons';

interface EndpointCardProps {
  endpoint: ApiEndpoint;
  analysisCode: string | null;
  index: number;
  onUpdate: (index: number, updatedEndpoint: ApiEndpoint) => void;
}

const methodColors: Record<ApiEndpoint['method'], string> = {
  GET: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
  POST: 'bg-green-500/20 text-green-300 border-green-500/30',
  PUT: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30',
  DELETE: 'bg-red-500/20 text-red-300 border-red-500/30',
  PATCH: 'bg-orange-500/20 text-orange-300 border-orange-500/30',
  OPTIONS: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
  HEAD: 'bg-gray-500/20 text-gray-300 border-gray-500/30',
  UNKNOWN: 'bg-gray-700/20 text-gray-400 border-gray-700/30',
};

const SnippetTab: React.FC<{ active: boolean; onClick: (e: React.MouseEvent) => void; children: React.ReactNode }> = ({ active, onClick, children }) => (
    <button
        onClick={onClick}
        className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors ${
            active
                ? 'bg-brand-secondary/90 text-white'
                : 'bg-brand-primary/60 text-brand-subtle hover:bg-brand-primary'
        }`}
    >
        {children}
    </button>
);

// This is a simplified cURL command parser. It handles common cases but may not support all cURL features.
const parseCurlCommand = (curl: string) => {
    const result = {
        method: 'GET',
        headers: {} as Record<string, string>,
        body: undefined as string | undefined,
        url: ''
    };

    // Extract URL
    const urlMatch = curl.match(/(?:['"])(https?:\/\/[^'"]+)(?:['"])/);
    if (urlMatch) {
        result.url = urlMatch[1];
    } else {
         const nonQuotedUrlMatch = curl.match(/\s(https?:\/\/[^\s]+)/);
         if(nonQuotedUrlMatch) {
            result.url = nonQuotedUrlMatch[1];
         }
    }

    // Extract method
    const methodMatch = curl.match(/-X\s+([A-Z]+)|--request\s+([A-Z]+)/);
    if (methodMatch) {
        result.method = (methodMatch[1] || methodMatch[2] || 'GET').toUpperCase();
    }

    // Extract headers
    const headerRegex = /-H\s+'([^']*)'|-H\s+"([^"]*)"/g;
    let headerMatch;
    while ((headerMatch = headerRegex.exec(curl)) !== null) {
        const header = headerMatch[1] || headerMatch[2];
        const [key, ...valueParts] = header.split(':');
        if (key && valueParts.length > 0) {
            result.headers[key.trim()] = valueParts.join(':').trim();
        }
    }

    // Extract body
    const dataMatch = curl.match(/-d\s+'([^']*)'|--data\s+'([^']*)'|-d\s+"([^"]*)"|--data\s+"([^"]*)"/);
    if (dataMatch) {
        result.body = dataMatch[1] || dataMatch[2] || dataMatch[3] || dataMatch[4];
    }

    return result;
}


export const EndpointCard: React.FC<EndpointCardProps> = ({ endpoint, analysisCode, index, onUpdate }) => {
    const [pathCopied, setPathCopied] = useState(false);
    const [exampleCopied, setExampleCopied] = useState(false);
    const [isExpanded, setIsExpanded] = useState(false);
    const [activeSnippet, setActiveSnippet] = useState<'curl' | 'javascript' | 'python' | 'php' | 'go'>('curl');
    const [isExecuting, setIsExecuting] = useState(false);
    const [liveResponse, setLiveResponse] = useState<string | null>(null);
    const [executionError, setExecutionError] = useState<string | null>(null);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [geminiAnalysis, setGeminiAnalysis] = useState<string | null>(null);
    const [analysisError, setAnalysisError] = useState<string | null>(null);
    
    // Editable description state
    const [isEditingDescription, setIsEditingDescription] = useState(false);
    const [currentDescription, setCurrentDescription] = useState(endpoint.description);
    const descriptionTextareaRef = useRef<HTMLTextAreaElement>(null);

    // Chat state
    const [chat, setChat] = useState<Chat | null>(null);
    const [chatHistory, setChatHistory] = useState<{ role: 'user' | 'model'; text: string }[]>([]);
    const [chatInput, setChatInput] = useState('');
    const [isChatLoading, setIsChatLoading] = useState(false);
    const [chatError, setChatError] = useState<string | null>(null);
    const chatContainerRef = useRef<HTMLDivElement>(null);

    const uniqueId = useId();

    useEffect(() => {
        if (chatContainerRef.current) {
            chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
        }
    }, [chatHistory, isChatLoading]);

    useEffect(() => {
      setCurrentDescription(endpoint.description);
    }, [endpoint.description]);

    useEffect(() => {
        if (isEditingDescription && descriptionTextareaRef.current) {
            const textarea = descriptionTextareaRef.current;
            textarea.focus();
            textarea.style.height = 'auto'; // Reset height
            textarea.style.height = `${textarea.scrollHeight}px`; // Set to content height
        }
    }, [isEditingDescription]);

    const handleCopyPath = (e: React.MouseEvent) => {
        e.stopPropagation();
        navigator.clipboard.writeText(endpoint.path);
        setPathCopied(true);
        setTimeout(() => setPathCopied(false), 2000);
    };
    
    const handleCopyExample = (e: React.MouseEvent) => {
        e.stopPropagation();
        navigator.clipboard.writeText(endpoint.example.request[activeSnippet]);
        setExampleCopied(true);
        setTimeout(() => setExampleCopied(false), 2000);
    };

    const handleRunCurl = async (e: React.MouseEvent) => {
        e.stopPropagation();
        setIsExecuting(true);
        setLiveResponse(null);
        setExecutionError(null);
        setGeminiAnalysis(null);
        setAnalysisError(null);

        try {
            const { url, method, headers, body } = parseCurlCommand(endpoint.example.request.curl);

            if (!url) {
                throw new Error("Could not parse a valid URL from the cURL command.");
            }
            
            // Browsers automatically set Content-Length, so we remove it to avoid conflicts.
            const cleanedHeaders = { ...headers };
            Object.keys(cleanedHeaders).forEach(key => {
                if (key.toLowerCase() === 'content-length') {
                    delete cleanedHeaders[key];
                }
            });

            const response = await fetch(url, { method, headers: cleanedHeaders, body, mode: 'cors' });
            const responseText = await response.text();

            if (!response.ok) {
                let formattedError = responseText;
                try {
                    formattedError = JSON.stringify(JSON.parse(responseText), null, 2);
                } catch {}
                throw new Error(`Request failed with status ${response.status}:\n${formattedError}`);
            }

            try {
                // Pretty-print if the response is JSON
                const json = JSON.parse(responseText);
                setLiveResponse(JSON.stringify(json, null, 2));
            } catch {
                setLiveResponse(responseText);
            }

        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred.';
            if (errorMessage.toLowerCase().includes('failed to fetch')) {
                 setExecutionError(`Failed to execute request.\n\nThis is often due to a Cross-Origin Resource Sharing (CORS) error. The target server does not allow requests from this web page.\n\nCheck the browser's developer console (F12) for more details.`);
            } else {
                 setExecutionError(`Failed to execute request.\n\nError: ${errorMessage}`);
            }
        } finally {
            setIsExecuting(false);
        }
    };

    const handleAnalyzeWithGemini = async (e: React.MouseEvent) => {
        e.stopPropagation();
        setIsAnalyzing(true);
        setGeminiAnalysis(null);
        setAnalysisError(null);

        const dataToAnalyze = liveResponse || executionError;
        if (!dataToAnalyze) {
            setAnalysisError("No response data to analyze.");
            setIsAnalyzing(false);
            return;
        }

        try {
            const analysis = await analyzeApiCall(endpoint.example.request.curl, dataToAnalyze);
            setGeminiAnalysis(analysis);
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred.';
            setAnalysisError(`Analysis failed. ${errorMessage}`);
        } finally {
            setIsAnalyzing(false);
        }
    };

    const handleSendChatMessage = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!chatInput.trim() || isChatLoading) return;

        let currentChat = chat;
        if (!currentChat && analysisCode) {
            try {
                currentChat = createChatSession(analysisCode);
                setChat(currentChat);
            } catch (err) {
                const errorMessage = err instanceof Error ? err.message : 'Could not create chat session.';
                setChatError(errorMessage);
                return;
            }
        }

        if (!currentChat) {
            setChatError("Chat could not be initialized. Source code is missing.");
            return;
        }

        const messageToSend = chatInput;
        setChatInput('');
        setIsChatLoading(true);
        setChatError(null);
        setChatHistory(prev => [...prev, { role: 'user', text: messageToSend }]);

        try {
            const responseStream = await currentChat.sendMessageStream({ message: messageToSend });

            setChatHistory(prev => [...prev, { role: 'model', text: '' }]);
            
            for await (const chunk of responseStream) {
                const chunkText = chunk.text;
                setChatHistory(prev => {
                    const newHistory = [...prev];
                    newHistory[newHistory.length - 1].text += chunkText;
                    return newHistory;
                });
            }

        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : "An unexpected error occurred during chat.";
            setChatError(errorMessage);
            // Remove the user's message and the optimistic empty model message on error
            setChatHistory(prev => prev.slice(0, -2));
        } finally {
            setIsChatLoading(false);
        }
    };

    const handleDescriptionChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        setCurrentDescription(e.target.value);
        // Auto-resize textarea
        e.target.style.height = 'auto';
        e.target.style.height = `${e.target.scrollHeight}px`;
    };

    const handleSaveDescription = () => {
        if (currentDescription.trim() !== endpoint.description) {
            onUpdate(index, { ...endpoint, description: currentDescription.trim() });
        }
        setIsEditingDescription(false);
    };

    const hasLiveResult = liveResponse !== null || executionError !== null;

  return (
    <div className="bg-brand-primary/50 border border-brand-primary rounded-lg transition-all hover:border-brand-secondary/50">
      <div
        role="button"
        tabIndex={0}
        onClick={() => setIsExpanded(!isExpanded)}
        onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && setIsExpanded(!isExpanded)}
        aria-expanded={isExpanded}
        aria-controls={`details-${uniqueId}`}
        className="p-4 cursor-pointer"
        >
        <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 flex-grow min-w-0">
                <span
                    className={`px-3 py-1 text-sm font-bold rounded-md border ${methodColors[endpoint.method]}`}
                >
                    {endpoint.method}
                </span>
                {endpoint.isPredicted && (
                    <span className="px-2 py-0.5 text-xs font-medium bg-purple-500/20 text-purple-300 border border-purple-500/30 rounded-full flex items-center gap-1">
                        <SparklesIcon /> Predicted
                    </span>
                )}
                {endpoint.verificationStatus === 'verified' && (
                    <span className="px-2 py-0.5 text-xs font-medium bg-green-500/20 text-green-300 border border-green-500/30 rounded-full flex items-center gap-1">
                        <CheckCircleIcon /> Verified
                    </span>
                )}
                {endpoint.verificationStatus === 'auth_required' && (
                    <span className="px-2 py-0.5 text-xs font-medium bg-yellow-500/20 text-yellow-300 border border-yellow-500/30 rounded-full flex items-center gap-1">
                        <LockClosedIcon /> Auth Required
                    </span>
                )}
                {endpoint.verificationStatus === 'not_found' && (
                    <span className="px-2 py-0.5 text-xs font-medium bg-red-500/20 text-red-300 border border-red-500/30 rounded-full flex items-center gap-1">
                        <XCircleIcon /> Not Found
                    </span>
                )}
                {endpoint.verificationStatus === 'found_in_docs' && (
                    <span className="px-2 py-0.5 text-xs font-medium bg-blue-500/20 text-blue-300 border border-blue-500/30 rounded-full flex items-center gap-1">
                        <DocumentTextIcon /> Found in Docs
                    </span>
                )}
                 {endpoint.verificationStatus === 'unsafe' && (
                    <span className="px-2 py-0.5 text-xs font-medium bg-orange-500/20 text-orange-300 border border-orange-500/30 rounded-full flex items-center gap-1" title="Unsafe to auto-test">
                        <ExclamationTriangleIcon /> Unverified
                    </span>
                )}
                <p className="font-mono text-sm text-brand-text truncate flex-shrink" title={endpoint.path}>{endpoint.path}</p>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
                <button onClick={handleCopyPath} className="p-1.5 rounded-md hover:bg-brand-primary text-brand-subtle hover:text-white transition-colors" title="Copy Path">
                    {pathCopied ? <CheckIcon /> : <CopyIcon />}
                </button>
                <ChevronDownIcon className={`w-5 h-5 text-brand-subtle transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`} />
            </div>
        </div>
        {endpoint.description && (
            <div className="mt-2 pl-12" onClick={(e) => e.stopPropagation()}>
                {isEditingDescription ? (
                    <textarea
                        ref={descriptionTextareaRef}
                        value={currentDescription}
                        onChange={handleDescriptionChange}
                        onBlur={handleSaveDescription}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                handleSaveDescription();
                            }
                            if (e.key === 'Escape') {
                                setIsEditingDescription(false);
                                setCurrentDescription(endpoint.description); // Revert changes
                            }
                        }}
                        className="w-full bg-brand-bg border border-brand-secondary rounded-md p-2 text-sm text-brand-text resize-none focus:outline-none"
                        rows={1}
                    />
                ) : (
                    <p 
                        className="text-sm text-brand-subtle group relative cursor-text pr-6"
                        onClick={() => setIsEditingDescription(true)}
                    >
                        {endpoint.description}
                        <span className="absolute top-0 right-0 opacity-0 group-hover:opacity-100 transition-opacity text-brand-subtle hover:text-white p-1">
                            <PencilIcon />
                        </span>
                    </p>
                )}
            </div>
        )}
      </div>
      {isExpanded && (
        <div id={`details-${uniqueId}`} className="border-t border-brand-primary/50 px-4 pt-4 pb-4 bg-black/20 animate-fade-in">
            <h4 className="font-semibold text-brand-text mb-2">Details</h4>
            <p className="text-sm text-brand-subtle mb-4 whitespace-pre-wrap">{endpoint.details}</p>

            <h4 className="font-semibold text-brand-text mb-2">Example Request</h4>
            <div className="flex items-center gap-2 mb-2 flex-wrap">
                <SnippetTab active={activeSnippet === 'curl'} onClick={(e) => { e.stopPropagation(); setActiveSnippet('curl'); }}>cURL</SnippetTab>
                <SnippetTab active={activeSnippet === 'javascript'} onClick={(e) => { e.stopPropagation(); setActiveSnippet('javascript');}}>JavaScript</SnippetTab>
                <SnippetTab active={activeSnippet === 'python'} onClick={(e) => { e.stopPropagation(); setActiveSnippet('python'); }}>Python</SnippetTab>
                <SnippetTab active={activeSnippet === 'php'} onClick={(e) => { e.stopPropagation(); setActiveSnippet('php'); }}>PHP</SnippetTab>
                <SnippetTab active={activeSnippet === 'go'} onClick={(e) => { e.stopPropagation(); setActiveSnippet('go'); }}>Go</SnippetTab>
            </div>
            <div className="bg-brand-bg rounded-md p-3 font-mono text-xs relative border border-brand-primary">
                <pre className="whitespace-pre-wrap break-all pr-24"><code>{endpoint.example.request[activeSnippet]}</code></pre>
                <div className="absolute top-2 right-2 flex items-center gap-2">
                     {activeSnippet === 'curl' && (
                        <button onClick={handleRunCurl} disabled={isExecuting} className="p-1.5 rounded-md bg-brand-surface hover:bg-brand-primary text-brand-subtle hover:text-white transition-colors disabled:opacity-50 disabled:cursor-wait" title="Run cURL command">
                            {isExecuting ? <SpinnerIcon /> : <PlayIcon />}
                        </button>
                    )}
                    <button onClick={handleCopyExample} className="p-1.5 rounded-md bg-brand-surface hover:bg-brand-primary text-brand-subtle hover:text-white transition-colors" title={`Copy ${activeSnippet} snippet`}>
                        {exampleCopied ? <CheckIcon /> : <CopyIcon />}
                    </button>
                </div>
            </div>
            <h4 className="font-semibold text-brand-text mb-2 mt-4">
                {isExecuting || hasLiveResult ? 'Live Response' : 'Example Response'}
            </h4>
            <div className="bg-brand-bg rounded-md p-3 font-mono text-xs relative border border-brand-primary min-h-[100px]">
                 {isExecuting ? (
                    <div className="flex items-center justify-center h-full text-brand-subtle absolute inset-0">
                        <SpinnerIcon />
                        <span className="ml-2">Executing...</span>
                    </div>
                ) : executionError ? (
                    <pre className="whitespace-pre-wrap break-all text-red-400"><code>{executionError}</code></pre>
                ) : liveResponse !== null ? (
                    <pre className="whitespace-pre-wrap break-all"><code>{liveResponse}</code></pre>
                ) : (
                    <pre className="whitespace-pre-wrap break-all"><code>{endpoint.example.response}</code></pre>
                )}
            </div>

            {hasLiveResult && (
                <div className="mt-4">
                    <div className="flex justify-between items-center mb-2">
                        <h4 className="font-semibold text-brand-text">Gemini Analysis</h4>
                        <button
                            onClick={handleAnalyzeWithGemini}
                            disabled={isAnalyzing}
                            className="flex items-center gap-2 text-sm bg-brand-primary/80 hover:bg-brand-primary px-3 py-1.5 rounded-md transition-colors disabled:opacity-50 disabled:cursor-wait"
                        >
                            {isAnalyzing ? (
                                <>
                                    <SpinnerIcon />
                                    Analyzing...
                                </>
                            ) : (
                                <>
                                    <SparklesIcon />
                                    Analyze Response
                                </>
                            )}
                        </button>
                    </div>
                     {(isAnalyzing || geminiAnalysis || analysisError) && (
                        <div className="bg-brand-bg rounded-md p-3 font-mono text-xs border border-brand-primary animate-fade-in min-h-[100px]">
                            {isAnalyzing && !geminiAnalysis && !analysisError && (
                                <div className="flex items-center justify-center text-brand-subtle absolute inset-0">
                                    <SpinnerIcon />
                                    <span className="ml-2">Gemini is thinking...</span>
                                </div>
                            )}
                            {analysisError && (
                                <pre className="whitespace-pre-wrap break-all text-red-400"><code>{analysisError}</code></pre>
                            )}
                            {geminiAnalysis && (
                                <pre className="whitespace-pre-wrap break-all text-brand-text"><code>{geminiAnalysis}</code></pre>
                            )}
                        </div>
                    )}
                </div>
            )}
            
            {geminiAnalysis && !analysisError && (
                <div className="mt-4 pt-4 border-t border-brand-primary/50">
                    <h4 className="font-semibold text-brand-text mb-2">Chat About The Code</h4>
                     <div className="bg-brand-bg rounded-md border border-brand-primary flex flex-col h-[400px]">
                        <div ref={chatContainerRef} className="flex-grow p-4 space-y-4 overflow-y-auto">
                            {chatHistory.map((msg, index) => (
                                <div key={index} className={`flex items-start gap-3 ${msg.role === 'user' ? 'justify-end' : ''}`}>
                                     {msg.role === 'model' && <div className="flex-shrink-0 w-8 h-8 rounded-full bg-brand-secondary/50 flex items-center justify-center"><BotIcon /></div>}
                                    <div className={`max-w-xl p-3 rounded-lg ${msg.role === 'user' ? 'bg-blue-600/50' : 'bg-brand-primary/50'}`}>
                                        <pre className="whitespace-pre-wrap font-sans text-sm break-words"><code>{msg.text}</code></pre>
                                    </div>
                                    {msg.role === 'user' && <div className="flex-shrink-0 w-8 h-8 rounded-full bg-brand-primary/80 flex items-center justify-center"><UserIcon /></div>}
                                </div>
                            ))}
                            {isChatLoading && chatHistory[chatHistory.length - 1]?.role === 'user' && (
                                <div className="flex items-start gap-3">
                                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-brand-secondary/50 flex items-center justify-center"><BotIcon /></div>
                                    <div className="max-w-xl p-3 rounded-lg bg-brand-primary/50 flex items-center">
                                        <SpinnerIcon />
                                        <span className="ml-2 text-sm text-brand-subtle">Gemini is typing...</span>
                                    </div>
                                </div>
                            )}
                        </div>
                        <div className="p-3 border-t border-brand-primary">
                            <form onSubmit={handleSendChatMessage} className="flex items-center gap-2">
                                <input
                                    type="text"
                                    value={chatInput}
                                    onChange={(e) => setChatInput(e.target.value)}
                                    placeholder="Ask a question about the code..."
                                    className="flex-grow p-2 bg-brand-surface border border-brand-primary rounded-md focus:outline-none focus:ring-2 focus:ring-brand-secondary text-sm"
                                    disabled={isChatLoading}
                                />
                                <button
                                    type="submit"
                                    disabled={!chatInput.trim() || isChatLoading}
                                    className="p-2 bg-brand-secondary text-white rounded-md hover:bg-opacity-90 transition-colors disabled:bg-brand-primary disabled:cursor-not-allowed"
                                    aria-label="Send message"
                                >
                                    {isChatLoading ? <SpinnerIcon /> : <SendIcon />}
                                </button>
                            </form>
                             {chatError && <p className="text-xs text-red-400 mt-1 pl-1">{chatError}</p>}
                        </div>
                    </div>
                </div>
            )}
        </div>
        )}
    </div>
  );
};