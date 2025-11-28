import React, { useState, useRef, useEffect, useId } from 'react';
import type { ApiEndpoint } from '../types';
import { analyzeApiCall } from '../services/geminiService';
import { EndpointChat } from './EndpointChat';
import { RequestEditor } from './RequestEditor';
import { parseCurlCommand, ParsedRequest } from '../utils/curlParser';
import { executeRequest } from '../services/RequestExecutor';
import { TestIcon, HistoryIcon } from './icons';
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
    PencilIcon
} from './icons';

interface EndpointCardProps {
  endpoint: ApiEndpoint;
  analysisCode: string | null;
  index: number;
  onUpdate: (index: number, updatedEndpoint: ApiEndpoint) => void;
  variables?: Record<string, string>;
  onRequestExecuted?: (endpoint: ApiEndpoint, request: any, response: any, success: boolean, error?: string) => void;
  onOpenTests?: (endpoint: ApiEndpoint) => void;
  onOpenHistory?: (endpoint: ApiEndpoint) => void;
  onOpenWorkbench?: (endpoint: ApiEndpoint) => void;
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



export const EndpointCard: React.FC<EndpointCardProps> = ({ 
  endpoint, 
  analysisCode, 
  index, 
  onUpdate, 
  variables,
  onRequestExecuted,
  onOpenTests,
  onOpenHistory,
  onOpenWorkbench,
}) => {
    const [pathCopied, setPathCopied] = useState(false);
    const [isExpanded, setIsExpanded] = useState(false);
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

    // Request Editor State
    const [requestData, setRequestData] = useState<ParsedRequest>({
        method: endpoint.method,
        url: '',
        headers: {},
        body: undefined
    });

    const uniqueId = useId();

    useEffect(() => {
      setCurrentDescription(endpoint.description);
    }, [endpoint.description]);

    // Initialize request data from cURL when expanded or endpoint changes
    useEffect(() => {
        if (isExpanded) {
            const parsed = parseCurlCommand(endpoint.example.request.curl);
            // If the parsed URL is relative, try to make it absolute if we have a base, 
            // or just leave it. The user might need to edit it.
            setRequestData(parsed);
        }
    }, [isExpanded, endpoint.example.request.curl]);

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
    


    const handleRunRequest = async () => {
        setIsExecuting(true);
        setLiveResponse(null);
        setExecutionError(null);
        setGeminiAnalysis(null);
        setAnalysisError(null);

        const startTime = Date.now();

        try {
            const result = await executeRequest({
                method: (requestData.method as ApiEndpoint['method']) || endpoint.method,
                url: requestData.url,
                headers: requestData.headers,
                body: requestData.body,
                variables,
            });

            if (result.response) {
                try {
                    const json = JSON.parse(result.response.body);
                    setLiveResponse(JSON.stringify(json, null, 2));
                } catch {
                    setLiveResponse(result.response.body);
                }
            }

            if (result.error) {
                setExecutionError(`Request Failed.\n\nError: ${result.error}`);
            } else {
                setExecutionError(null);
            }

            if (onRequestExecuted && result.response) {
                onRequestExecuted(
                    endpoint,
                    {
                        method: result.request.method,
                        url: result.request.url,
                        headers: result.request.headers,
                        body: result.request.body || '',
                    },
                    result.response,
                    !result.error,
                    result.error
                );
            }

        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred.';
            setExecutionError(`Request Failed.\n\nError: ${errorMessage}`);
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
        onClick={() => setIsExpanded(!isExpanded)}
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
                {endpoint.authType && endpoint.authType !== 'none' && endpoint.authType !== 'unknown' && (
                    <span className="px-2 py-0.5 text-xs font-medium bg-pink-500/20 text-pink-300 border border-pink-500/30 rounded-full flex items-center gap-1 uppercase">
                        <LockClosedIcon /> {endpoint.authType}
                    </span>
                )}
                {endpoint.documentationUrl && (
                    <a 
                        href={endpoint.documentationUrl} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="px-2 py-0.5 text-xs font-medium bg-blue-500/20 text-blue-300 border border-blue-500/30 rounded-full flex items-center gap-1 hover:bg-blue-500/30 transition-colors"
                        onClick={(e) => e.stopPropagation()}
                        title="View Documentation"
                    >
                        <DocumentTextIcon /> Docs
                    </a>
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
                        aria-label="Edit description"
                        title="Edit description"
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

            <div className="flex justify-between items-center mb-2">
                <h4 className="font-semibold text-brand-text">Request Builder</h4>
                 <div className="flex items-center gap-2">
                    {onOpenTests && (
                        <button 
                            onClick={() => onOpenTests(endpoint)} 
                            className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-brand-primary hover:bg-brand-primary/80 text-white transition-colors" 
                            title="Tests"
                        >
                            <TestIcon className="w-4 h-4" />
                            <span>Tests</span>
                        </button>
                    )}
                    {onOpenHistory && (
                        <button 
                            onClick={() => onOpenHistory(endpoint)} 
                            className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-brand-primary hover:bg-brand-primary/80 text-white transition-colors" 
                            title="History"
                        >
                            <HistoryIcon className="w-4 h-4" />
                            <span>History</span>
                        </button>
                    )}
                    <div className="flex gap-2">
                    {onOpenWorkbench && (
                        <button
                            onClick={() => onOpenWorkbench(endpoint)}
                            className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-brand-primary/30 hover:bg-brand-primary/50 text-white transition-colors"
                            title="Open in Workbench"
                            type="button"
                        >
                            Advanced
                        </button>
                    )}
                    <button onClick={handleRunRequest} disabled={isExecuting} className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-brand-secondary hover:bg-brand-secondary/80 text-white transition-colors disabled:opacity-50 disabled:cursor-wait" title="Run Request">
                        {isExecuting ? <SpinnerIcon /> : <PlayIcon />}
                        <span>Send Request</span>
                    </button>
                    </div>
                </div>
            </div>
            
            {/* Interactive Request Editor */}
            <RequestEditor 
                initialUrl={requestData.url}
                initialHeaders={requestData.headers}
                initialBody={requestData.body}
                onChange={(data) => setRequestData({ ...requestData, ...data })}
            />

            
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
            
            <EndpointChat context={analysisCode} />
        </div>
        )}
    </div>
  );
};