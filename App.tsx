
import React, { useState, useCallback, useMemo } from 'react';
import {
  Panel,
  PanelGroup,
  PanelResizeHandle,
} from "react-resizable-panels";
import { InputPanel } from './components/CodeInput';
import { ResultsDisplay } from './components/ResultsDisplay';
import { extractApiEndpoints, analyzeApiCall, beautifyCode } from './services/geminiService';
import { generateOpenApiSpec } from './utils/openApiGenerator';
import type { ApiEndpoint, HistoryItem, RequestDraft, RequestBodyMode, KeyValuePair, FormDataEntry, RequestHistoryItem } from './types';
import { EnvironmentManager, Environment } from './components/EnvironmentManager';
import { HistoryPanel } from './components/HistoryPanel';
import { useLocalStorage } from './hooks/useLocalStorage';
import { SettingsModal } from './components/SettingsModal';
import { Header } from './components/Header';
import { Cog6ToothIcon } from './components/icons';
import { CollectionManager } from './components/CollectionManager';
import { RequestHistory } from './components/RequestHistory';
import { AuthManager } from './components/AuthManager';
import { TestPanel } from './components/TestPanel';
import { RequestWorkbench } from './components/RequestWorkbench';
import { CollectionService } from './services/CollectionService';
import { HistoryService } from './services/HistoryService';
import { AuthService } from './services/AuthService';
import { TestService } from './services/TestService';
import { RequestDraftService } from './services/RequestDraftService';
import type { Collection, AuthConfig } from './types';

import { fetchUrlContent, smartCrawl } from './services/CrawlerService';
import { verifyEndpoint } from './services/VerificationService';
import { ActivityLog, LogEntry, LogType } from './components/ActivityLog';
import { parseCurlCommand } from './utils/curlParser';
import { executeRequest } from './services/RequestExecutor';


const App: React.FC = () => {
  const [inputText, setInputText] = useState<string>('');
  const [urlInputs, setUrlInputs] = useState<string[]>(['']);
  const [inputMode, setInputMode] = useState<'code' | 'file'>('code');
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [extractedEndpoints, setExtractedEndpoints] = useState<ApiEndpoint[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [loadingStep, setLoadingStep] = useState<'fetching' | 'beautifying' | 'analyzing' | 'verifying' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [analysisSource, setAnalysisSource] = useState<string | null>(null);
  const [analysisCode, setAnalysisCode] = useState<string | null>(null);
  const [history, setHistory] = useLocalStorage<HistoryItem[]>('api-extractor-history', []);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [environments, setEnvironments] = useLocalStorage<Environment[]>('environments', []);
  const [activeEnvId, setActiveEnvId] = useLocalStorage<string | null>('activeEnvId', null);
  const [isEnvManagerOpen, setIsEnvManagerOpen] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  
  // Collections & Workspaces
  const [collections, setCollections] = useState<Collection[]>(CollectionService.getCollections());
  const [selectedCollectionId, setSelectedCollectionId] = useState<string | null>(null);
  const [isCollectionManagerOpen, setIsCollectionManagerOpen] = useState(false);
  
  // Request History
  const [isRequestHistoryOpen, setIsRequestHistoryOpen] = useState(false);
  const [selectedEndpointForHistory, setSelectedEndpointForHistory] = useState<string | undefined>();
  
  // Auth Manager
  const [isAuthManagerOpen, setIsAuthManagerOpen] = useState(false);
  
  // Test Panel
  const [isTestPanelOpen, setIsTestPanelOpen] = useState(false);
  const [selectedEndpointForTests, setSelectedEndpointForTests] = useState<{id: string, path: string} | null>(null);

  const [isAiDiscoveryEnabled, setIsAiDiscoveryEnabled] = useState(false);

  const [isWorkbenchOpen, setIsWorkbenchOpen] = useState(false);
  const [workbenchEndpoint, setWorkbenchEndpoint] = useState<ApiEndpoint | null>(null);
  const [workbenchDraft, setWorkbenchDraft] = useState<RequestDraft | null>(null);
  const [isWorkbenchSending, setIsWorkbenchSending] = useState(false);
  const [workbenchResponse, setWorkbenchResponse] = useState<{
    status: number;
    statusText: string;
    headers: Record<string, string>;
    body: string;
    duration: number;
  } | undefined>();
  const [workbenchError, setWorkbenchError] = useState<string | undefined>();
  const [savedDrafts, setSavedDrafts] = useState<RequestDraft[]>(RequestDraftService.list());
  const refreshSavedDrafts = useCallback(() => {
    setSavedDrafts(RequestDraftService.list());
  }, []);

  const addLog = useCallback((message: string, type: LogType = 'info') => {
      setLogs(prev => [...prev, {
          id: Math.random().toString(36).substring(7),
          timestamp: Date.now(),
          message,
          type
      }]);
  }, []);
  const [totalCost, setTotalCost] = useState(0);
  const handleCostUpdate = useCallback((cost: number) => {
    setTotalCost(prev => prev + cost);
  }, []);

  const keyValuePairsToRecord = useCallback((pairs: KeyValuePair[] = []) => {
    return pairs.reduce<Record<string, string>>((acc, pair) => {
      if (pair.key && (pair.enabled ?? true)) {
        acc[pair.key] = pair.value;
      }
      return acc;
    }, {});
  }, []);

  const applyParamsToUrl = useCallback((baseUrl: string, params: KeyValuePair[] = []) => {
    if (params.length === 0) return baseUrl;
    try {
      const url = new URL(baseUrl);
      params.forEach(param => {
        if (param.key && (param.enabled ?? true)) {
          url.searchParams.set(param.key, param.value);
        }
      });
      return url.toString();
    } catch {
      // Handle relative URLs by manual string manipulation
      const [path, query] = baseUrl.split('?');
      const searchParams = new URLSearchParams(query);
      params.forEach(param => {
        if (param.key && (param.enabled ?? true)) {
          searchParams.set(param.key, param.value);
        }
      });
      const queryString = searchParams.toString();
      return `${path}${queryString ? `?${queryString}` : ''}`;
    }
  }, []);

  const buildDraftFromEndpoint = useCallback((endpoint: ApiEndpoint): RequestDraft => {
    const parsed = parseCurlCommand(endpoint.example.request.curl);
    const headerPairs: KeyValuePair[] = Object.entries(parsed.headers || {}).map(([key, value]) => ({
      id: crypto.randomUUID(),
      key,
      value,
      enabled: true,
    }));

    let bodyMode: RequestBodyMode = 'json';
    if (!parsed.body) {
      bodyMode = 'text';
    }

    return {
      id: crypto.randomUUID(),
      name: `${endpoint.method} ${endpoint.path}`,
      endpointId: endpoint.id,
      method: (parsed.method as ApiEndpoint['method']) || endpoint.method,
      url: parsed.url || endpoint.path,
      params: [],
      headers: headerPairs,
      bodyMode,
      rawBody: parsed.body,
      formData: [],
      urlEncoded: [],
      authConfigIds: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
  }, []);

  const openWorkbenchForEndpoint = useCallback((endpoint: ApiEndpoint) => {
    const draft = buildDraftFromEndpoint(endpoint);
    setWorkbenchEndpoint(endpoint);
    setWorkbenchDraft(draft);
    setWorkbenchResponse(undefined);
    setWorkbenchError(undefined);
    setIsWorkbenchOpen(true);
  }, [buildDraftFromEndpoint]);

  const closeWorkbench = useCallback(() => {
    setIsWorkbenchOpen(false);
    setWorkbenchEndpoint(null);
  }, []);

  const handleWorkbenchDraftChange = useCallback((draft: RequestDraft) => {
    setWorkbenchDraft({ ...draft, updatedAt: Date.now() });
  }, []);

  const createDraftFromHistory = useCallback((item: RequestHistoryItem): RequestDraft => {
    const params: KeyValuePair[] = [];
    try {
      const urlObj = new URL(item.request.url);
      urlObj.searchParams.forEach((value, key) => {
        params.push({ id: crypto.randomUUID(), key, value, enabled: true });
      });
    } catch {
      // ignore
    }

    const headers: KeyValuePair[] = Object.entries(item.request.headers || {}).map(([key, value]) => ({
      id: crypto.randomUUID(),
      key,
      value,
      enabled: true,
    }));

    const looksJson = (() => {
      const body = item.request.body || '';
      if (!body) return false;
      const trimmed = body.trim();
      return (trimmed.startsWith('{') && trimmed.endsWith('}')) || (trimmed.startsWith('[') && trimmed.endsWith(']'));
    })();

    return {
      id: crypto.randomUUID(),
      name: `Replay ${item.request.method} ${item.request.url}`,
      endpointId: item.endpointId,
      method: (item.request.method as ApiEndpoint['method']) || 'GET',
      url: item.request.url,
      params,
      headers,
      bodyMode: looksJson ? 'json' : 'text',
      rawBody: item.request.body,
      formData: [],
      urlEncoded: [],
      authConfigIds: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
  }, []);

  const handleWorkbenchBodyModeChange = useCallback((mode: RequestBodyMode) => {
    setWorkbenchDraft(prev => (prev ? { ...prev, bodyMode: mode, updatedAt: Date.now() } : prev));
  }, []);

  const handleWorkbenchFormDataChange = useCallback((entries: FormDataEntry[]) => {
    setWorkbenchDraft(prev => (prev ? { ...prev, formData: entries, updatedAt: Date.now() } : prev));
  }, []);

  const handleWorkbenchUrlEncodedChange = useCallback((entries: KeyValuePair[]) => {
    setWorkbenchDraft(prev => (prev ? { ...prev, urlEncoded: entries, updatedAt: Date.now() } : prev));
  }, []);

  const buildRequestBodyFromDraft = useCallback((draft: RequestDraft) => {
    switch (draft.bodyMode) {
      case 'json':
        return {
          body: draft.rawBody || '',
          contentType: 'application/json',
        };
      case 'text':
        return {
          body: draft.rawBody || '',
          contentType: 'text/plain',
        };
      case 'urlencoded': {
        const params = new URLSearchParams();
        draft.urlEncoded?.forEach(item => {
          if (item.key && (item.enabled ?? true)) {
            params.set(item.key, item.value);
          }
        });
        return {
          body: params.toString(),
          contentType: 'application/x-www-form-urlencoded',
        };
      }
      case 'form-data': {
        const boundary = `----api-route-${Math.random().toString(16).slice(2)}`;
        const parts = draft.formData?.map(item => {
          if (!item.key) return '';
          return `--${boundary}\r\nContent-Disposition: form-data; name="${item.key}"\r\n\r\n${item.value}\r\n`;
        }).join('') || '';
        return {
          body: `${parts}--${boundary}--`,
          contentType: `multipart/form-data; boundary=${boundary}`,
        };
      }
      case 'binary':
        return {
          body: draft.rawBody || '',
          contentType: 'application/octet-stream',
        };
      default:
        return { body: draft.rawBody || '' };
    }
  }, []);

  // Handler to track request execution in history (needs to be declared before send handlers)
  const handleRequestExecuted = useCallback((endpoint: ApiEndpoint, request: {
    method: string;
    url: string;
    headers: Record<string, string>;
    body?: string;
  }, response: {
    status: number;
    statusText: string;
    headers: Record<string, string>;
    body: string;
    duration: number;
  }, success: boolean, error?: string) => {
    const endpointId = endpoint.id || `${endpoint.path}-${endpoint.method}`;
    const historyItem: RequestHistoryItem = {
      id: crypto.randomUUID(),
      endpointId,
      collectionId: selectedCollectionId || undefined,
      timestamp: Date.now(),
      request,
      response,
      environmentId: activeEnvId || undefined,
      success,
      error,
    };

    const tests = TestService.getTestsForEndpoint(endpointId);
    if (tests.length > 0 && success) {
      Promise.all(tests.map(test => TestService.runTest(test, historyItem))).then(results => {
        historyItem.testResults = results;
        HistoryService.addHistoryItem(historyItem);
      });
    } else {
      HistoryService.addHistoryItem(historyItem);
    }
  }, [selectedCollectionId, activeEnvId]);

  const handleWorkbenchSendInternal = useCallback(async (
    targetDraft: RequestDraft,
    endpoint: ApiEndpoint
  ) => {
    setIsWorkbenchSending(true);
    setWorkbenchError(undefined);
    setWorkbenchResponse(undefined);

    const headers = keyValuePairsToRecord(targetDraft.headers);
    const params = targetDraft.params || [];
    const urlWithParams = applyParamsToUrl(targetDraft.url, params);
    const { body, contentType } = buildRequestBodyFromDraft(targetDraft);

    if (contentType && !Object.keys(headers).some(key => key.toLowerCase() === 'content-type')) {
      headers['Content-Type'] = contentType;
    }

    const result = await executeRequest({
      method: targetDraft.method,
      url: urlWithParams,
      headers,
      body,
      variables: activeEnvId ? environments.find(env => env.id === activeEnvId)?.variables : undefined,
      authConfigIds: targetDraft.authConfigIds,
    });

    if (result.response) {
      setWorkbenchResponse(result.response);
    }

    if (result.error) {
      setWorkbenchError(result.error);
    }

    setIsWorkbenchSending(false);
    return result;
  }, [keyValuePairsToRecord, applyParamsToUrl, buildRequestBodyFromDraft, activeEnvId, environments]);

  const handleWorkbenchSend = useCallback(async () => {
    if (!workbenchDraft || !workbenchEndpoint) return;
    const result = await handleWorkbenchSendInternal(workbenchDraft, workbenchEndpoint);
    if (result.response) {
      handleRequestExecuted(
        workbenchEndpoint,
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
  }, [workbenchDraft, workbenchEndpoint, handleWorkbenchSendInternal, handleRequestExecuted]);

  const handleSaveWorkbenchDraft = useCallback(() => {
    if (!workbenchDraft) return;
    const saved = RequestDraftService.save(workbenchDraft);
    setWorkbenchDraft(saved);
    refreshSavedDrafts();
    addLog(`Saved request draft "${saved.name || saved.id}".`, 'success');
  }, [workbenchDraft, addLog, refreshSavedDrafts]);

  const handleLoadLatestHistoryDraft = useCallback(() => {
    if (!workbenchEndpoint) {
      addLog('Open an endpoint in the workbench before loading history.', 'warning');
      return;
    }
    const endpointId = workbenchEndpoint.id || `${workbenchEndpoint.path}-${workbenchEndpoint.method}`;
    const history = HistoryService.getHistoryForEndpoint(endpointId, 1);
    if (!history.length) {
      addLog('No history available for this endpoint yet.', 'warning');
      return;
    }
    const draft = createDraftFromHistory(history[0]);
    setWorkbenchDraft(draft);
    addLog('Loaded latest request from history into workbench.', 'info');
  }, [workbenchEndpoint, addLog, createDraftFromHistory]);

  const handleLoadSavedDraft = useCallback((draftId: string) => {
    const draft = RequestDraftService.get(draftId);
    if (!draft) {
      addLog('Saved draft not found.', 'error');
      return;
    }
    setWorkbenchDraft(draft);
    addLog(`Loaded draft "${draft.name || draft.id}".`, 'info');
  }, [addLog]);

  const handleDeleteSavedDraft = useCallback((draftId: string) => {
    RequestDraftService.delete(draftId);
    refreshSavedDrafts();
    if (workbenchDraft?.id === draftId) {
      setWorkbenchDraft(null);
    }
    addLog('Deleted saved draft.', 'warning');
  }, [refreshSavedDrafts, workbenchDraft, addLog]);

  const scopedDrafts = useMemo(() => {
    if (!workbenchEndpoint) return savedDrafts;
    const endpointId = workbenchEndpoint.id || `${workbenchEndpoint.path}-${workbenchEndpoint.method}`;
    return savedDrafts.filter(draft => !draft.endpointId || draft.endpointId === endpointId);
  }, [savedDrafts, workbenchEndpoint]);

  const handleFileSelect = (files: FileList) => {
    setError(null);
    const fileArray = Array.from(files);
    setSelectedFiles(fileArray);

    const fileReadPromises = fileArray.map(file => {
        return new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                const text = e.target?.result as string;
                // Add a header to distinguish files for the model and for the preview
                resolve(`/* --- File: ${file.name} --- */\n\n${text}`);
            };
            reader.onerror = () => {
                reject(`Failed to read file: ${file.name}`);
            };
            reader.readAsText(file);
        });
    });

    // We set a loading state temporarily while files are read
    setInputText('Reading files...');
    Promise.all(fileReadPromises)
        .then(contents => {
            const combinedContent = contents.join('\n\n/* --- FILE SEPARATOR --- */\n\n');
            setInputText(combinedContent);
        })
        .catch(err => {
            setError(String(err));
            setSelectedFiles([]);
            setInputText('');
        });
  };

  const handleClear = () => {
    setInputText('');
    setUrlInputs(['']);
    setSelectedFiles([]);
    setError(null);
    setLogs([]);
  };


  const handleExtract = useCallback(async () => {
    const apiKey = process.env.GEMINI_API_KEY;
    
    if (!apiKey) {
        addLog("Gemini API Key is missing. Please check your .env.local file.", 'error');
        setError("Gemini API Key is missing.");
        return;
    }

    setIsLoading(true);
    setLoadingStep(null);
    setError(null);
    setExtractedEndpoints([]);
    setAnalysisSource(null);
    setAnalysisCode(null);
    setLogs([]);

    let sourceForHistory = '';
    
    try {
      let codeToAnalyze = '';
      let initialUrls: string[] = [];

      if (inputMode === 'code') {
        if (!inputText.trim()) {
          setError('Please paste some code to analyze.');
          setIsLoading(false);
          return;
        }
        
        // Check for URLs in the input text even in code mode
        const lines = inputText.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
        const urlRegex = /^(https?:\/\/|www\.)/i;
        const urlLines: string[] = [];
        const nonUrlLines: string[] = [];

        for (const line of lines) {
          if (urlRegex.test(line)) {
            urlLines.push(line);
          } else {
            nonUrlLines.push(line);
          }
        }

        if (urlLines.length > 0) {
             initialUrls = urlLines;
        } else {
             codeToAnalyze = inputText;
             sourceForHistory = 'Pasted Code';
             setAnalysisSource(sourceForHistory);
        }
      } else if (inputMode === 'file') {
        if (selectedFiles.length === 0 || !inputText.trim()) {
            setError('Please select and upload a valid code file.');
            setIsLoading(false);
            return;
        }
        codeToAnalyze = inputText;
        sourceForHistory = `${selectedFiles.length} file(s): ${selectedFiles.map(f => f.name).join(', ')}`;
        setAnalysisSource(`${selectedFiles.length} file(s)`);
      }

      // Handle URL fetching if we found URLs
      if (initialUrls.length > 0) {
         addLog(`Found ${initialUrls.length} URL(s) to analyze.`, 'info');
         
         let validUrls: URL[] = [];
         for (const urlStr of initialUrls) {
             try {
                 validUrls.push(new URL(urlStr.startsWith('http') ? urlStr : `https://${urlStr}`));
             } catch (e) {
                 setError(`Please enter a valid URL. '${urlStr}' is invalid.`);
                 setIsLoading(false);
                 return;
             }
         }
         
         sourceForHistory = `URL(s): ${validUrls.map(u => u.href).join(', ')}`;
         setLoadingStep('fetching');
         setAnalysisSource(sourceForHistory);

         // Fetch initial content
         addLog(`Fetching content from ${validUrls.length} URL(s)...`, 'info');
         const fetchPromises = validUrls.map(async u => {
             try {
                 const content = await fetchUrlContent(u.href);
                 addLog(`Successfully fetched ${u.href}`, 'success');
                 return content;
             } catch (e) {
                 addLog(`Failed to fetch ${u.href}`, 'error');
                 throw e;
             }
         });
         const fetchedContents = await Promise.all(fetchPromises);
         codeToAnalyze = fetchedContents.join('\n\n/* --- URL SEPARATOR --- */\n\n');
         
         setInputText(codeToAnalyze);
      }

      if (!codeToAnalyze.trim()) {
          addLog("No content to analyze.", 'error');
          setError('Could not find any code to analyze.');
          setIsLoading(false);
          return;
      }

      setAnalysisCode(codeToAnalyze);
      setLoadingStep('analyzing');
      addLog(`Starting analysis of ${codeToAnalyze.length} characters...`, 'ai');
      
      // --- Phase 1: Initial Extraction ---
      // Determine base URL for relative paths
      let baseUrl = undefined;
      if (initialUrls.length > 0) {
          try {
              baseUrl = new URL(initialUrls[0]).origin;
          } catch (e) {}
      }
      
      const result1 = await extractApiEndpoints(codeToAnalyze, baseUrl, handleCostUpdate);
      let allEndpoints = [...result1.explicitEndpoints];
      
      addLog(`Phase 1: Found ${result1.explicitEndpoints.length} explicit endpoints.`, 'success');
      
      // Add predicted endpoints with a flag
      const predicted1 = result1.predictedEndpoints.map(ep => ({ ...ep, isPredicted: true }));
      allEndpoints = [...allEndpoints, ...predicted1];
      if (predicted1.length > 0) {
          addLog(`Phase 1: Predicted ${predicted1.length} potential endpoints.`, 'ai');
      }

      // --- Phase 2: AI Discovery (Crawling) ---
      if (isAiDiscoveryEnabled && result1.crawlingCandidates.length > 0) {
          addLog(`AI Discovery: Found ${result1.crawlingCandidates.length} candidate links to crawl.`, 'ai');
          setLoadingStep('fetching'); 
          
          const visited = new Set(initialUrls);
          
          const crawledContent = await smartCrawl(
              result1.crawlingCandidates, 
              visited, 
              5,
              (msg) => addLog(msg, 'info')
          ); 
          
          if (crawledContent.length > 0) {
              const combinedCrawledCode = crawledContent.join('\n\n/* --- CRAWLED PAGE SEPARATOR --- */\n\n');
              setAnalysisCode(prev => (prev || '') + '\n\n' + combinedCrawledCode); 
              
              setLoadingStep('analyzing');
              addLog(`Analyzing crawled content (${combinedCrawledCode.length} chars)...`, 'ai');
              const result2 = await extractApiEndpoints(combinedCrawledCode, baseUrl, handleCostUpdate);
              
              allEndpoints = [...allEndpoints, ...result2.explicitEndpoints];
              const predicted2 = result2.predictedEndpoints.map(ep => ({ ...ep, isPredicted: true }));
              allEndpoints = [...allEndpoints, ...predicted2];
              
              addLog(`Phase 2: Found ${result2.explicitEndpoints.length} more endpoints and predicted ${result2.predictedEndpoints.length} more.`, 'success');
          }
      }

      // Deduplicate endpoints based on method + path
      const uniqueEndpointsMap = new Map<string, ApiEndpoint>();
      allEndpoints.forEach(ep => {
          const key = `${ep.method}-${ep.path}`;
          if (uniqueEndpointsMap.has(key)) {
              const existing = uniqueEndpointsMap.get(key)!;
              if (existing.isPredicted && !ep.isPredicted) {
                  uniqueEndpointsMap.set(key, ep); 
              }
          } else {
              uniqueEndpointsMap.set(key, ep);
          }
      });
      
      let finalEndpoints = Array.from(uniqueEndpointsMap.values());
      addLog(`Total unique endpoints found: ${finalEndpoints.length}`, 'info');

      // --- Phase 3: Verification ---
      if (finalEndpoints.length > 0) {
          setLoadingStep('verifying');
          addLog(`Verifying ${finalEndpoints.length} endpoints...`, 'info');
          
          // Determine base URL for relative paths
          let baseUrl = null;
          if (initialUrls.length > 0) {
              try {
                  baseUrl = new URL(initialUrls[0]).origin;
              } catch (e) {}
          }

          const verifiedEndpoints = await Promise.all(finalEndpoints.map(async (ep) => {
              const status = await verifyEndpoint(ep, baseUrl, codeToAnalyze + (analysisCode || ''));
              if (status === 'verified') addLog(`Verified: ${ep.method} ${ep.path}`, 'success');
              // Don't log every single failure to avoid spam, maybe just summary
              return { ...ep, verificationStatus: status };
          }));
          
          finalEndpoints = verifiedEndpoints;
          addLog("Verification complete.", 'success');
      }


      if (finalEndpoints.length > 0) {
        setLoadingStep('beautifying');
        const beautifiedEndpoints = await Promise.all(
          finalEndpoints.map(async (endpoint, index) => {
            try {
              const curl = await beautifyCode(endpoint.example.request.curl, handleCostUpdate);
              return {
                ...endpoint,
                id: endpoint.id || `${endpoint.path}-${endpoint.method}-${Date.now()}-${index}`,
                example: {
                  ...endpoint.example,
                  request: { curl },
                },
              };
            } catch (e) {
                return {
                  ...endpoint,
                  id: endpoint.id || `${endpoint.path}-${endpoint.method}-${Date.now()}-${index}`,
                }; 
            }
          })
        );
        setExtractedEndpoints(beautifiedEndpoints);

        const newHistoryItem: HistoryItem = {
            id: Date.now().toString(),
            timestamp: Date.now(),
            source: sourceForHistory + (isAiDiscoveryEnabled ? ' (AI Discovery)' : ''),
            inputMode,
            endpoints: beautifiedEndpoints,
            analysisCode: codeToAnalyze, 
            originalInput: {
              inputText: (inputMode === 'code' || inputMode === 'file') ? inputText : codeToAnalyze,
              urlInputs,
              fileNames: selectedFiles.map(f => f.name),
            },
        };
        setHistory(prev => [newHistoryItem, ...prev].slice(0, 50));

      } else {
        setExtractedEndpoints([]);
        addLog("No endpoints found.", 'warning');
      }
      
    } catch (err) {
      console.error("FULL EXTRACTION ERROR:", err);
      const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred.';
      addLog(`Error: ${errorMessage}`, 'error');
      setError(`Failed to fetch or process the URL. The site might be protected by CORS or is offline. All proxy attempts failed. Try pasting the code manually. Details: ${errorMessage}`);
    } finally {
      setIsLoading(false);
      setLoadingStep(null);
    }
  }, [inputText, urlInputs, inputMode, selectedFiles, setHistory, isAiDiscoveryEnabled, addLog, analysisCode, handleCostUpdate]);

  const handleExportOpenApi = () => {
    if (extractedEndpoints.length === 0) return;
    const spec = generateOpenApiSpec(extractedEndpoints);
    const blob = new Blob([spec], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'swagger.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    addLog("Exported OpenAPI specification to swagger.json", 'success');
  };

  const handleSetInputMode = (mode: 'code' | 'file') => {
    if (mode === inputMode) return;
    handleClear();
    setInputMode(mode);
  };

  const handleLoadHistory = (item: HistoryItem) => {
    setError(null);
    setExtractedEndpoints(item.endpoints);
    setAnalysisCode(item.analysisCode);
    setAnalysisSource(item.source);
    setInputMode(item.inputMode);
    setInputText(item.originalInput.inputText);
    setUrlInputs(item.originalInput.urlInputs);
    setSelectedFiles(item.originalInput.fileNames.map(name => new File([], name, { type: 'text/plain' })));
  };

  const handleDeleteHistory = (id: string) => {
    setHistory(prev => prev.filter(item => item.id !== id));
  };

  const handleClearAllHistory = () => {
    setHistory([]);
  };

  // Handler to track request execution in history
  const handleUpdateEndpoint = (index: number, updatedEndpoint: ApiEndpoint) => {
    setExtractedEndpoints(prev => {
        const newEndpoints = [...prev];
        if (newEndpoints[index]) {
            newEndpoints[index] = updatedEndpoint;
        }
        return newEndpoints;
    });
  };

  // Filter endpoints by selected collection
  const displayedEndpoints = selectedCollectionId
    ? extractedEndpoints.filter(ep => {
        const collection = collections.find(c => c.id === selectedCollectionId);
        if (!collection) return true;
        const endpointId = ep.id || `${ep.path}-${ep.method}`;
        return collection.endpointIds.includes(endpointId);
      })
    : extractedEndpoints;

  return (
    <div className="flex flex-col h-full bg-brand-bg">
      <Header 
        onOpenSettings={() => setIsSettingsOpen(true)} 
        onOpenEnvironments={() => setIsEnvManagerOpen(true)}
        onOpenCollections={() => setIsCollectionManagerOpen(true)}
        onOpenHistory={() => setIsRequestHistoryOpen(true)}
        onOpenAuth={() => setIsAuthManagerOpen(true)}
      />
      <EnvironmentManager
        isOpen={isEnvManagerOpen}
        onClose={() => setIsEnvManagerOpen(false)}
        environments={environments}
        setEnvironments={setEnvironments}
        activeEnvId={activeEnvId}
        setActiveEnvId={setActiveEnvId}
      />
      <CollectionManager
        isOpen={isCollectionManagerOpen}
        onClose={() => setIsCollectionManagerOpen(false)}
        endpoints={extractedEndpoints}
        onCollectionSelect={(id) => {
          setSelectedCollectionId(id);
          setCollections(CollectionService.getCollections());
        }}
        selectedCollectionId={selectedCollectionId}
      />
      <RequestHistory
        isOpen={isRequestHistoryOpen}
        onClose={() => setIsRequestHistoryOpen(false)}
        endpointId={selectedEndpointForHistory}
      />
      <AuthManager
        isOpen={isAuthManagerOpen}
        onClose={() => setIsAuthManagerOpen(false)}
        environments={environments}
        activeEnvironmentId={activeEnvId}
      />
      <TestPanel
        isOpen={isTestPanelOpen}
        onClose={() => {
          setIsTestPanelOpen(false);
          setSelectedEndpointForTests(null);
        }}
        endpointId={selectedEndpointForTests?.id || ''}
        endpointPath={selectedEndpointForTests?.path || ''}
      />
      <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
      {workbenchDraft && (
        <RequestWorkbench
          isOpen={isWorkbenchOpen}
          endpoint={workbenchEndpoint || undefined}
          requestState={{
            draft: workbenchDraft,
            setDraft: handleWorkbenchDraftChange,
            setBodyMode: handleWorkbenchBodyModeChange,
            setFormData: handleWorkbenchFormDataChange,
            setUrlEncoded: handleWorkbenchUrlEncodedChange,
          }}
          onSend={handleWorkbenchSend}
          isSending={isWorkbenchSending}
          response={workbenchResponse}
          error={workbenchError}
          environments={environments.map(env => ({ id: env.id, name: env.name }))}
          activeEnvironmentId={activeEnvId}
          onClose={closeWorkbench}
          onSaveDraft={handleSaveWorkbenchDraft}
          onLoadFromHistory={handleLoadLatestHistoryDraft}
          savedDrafts={scopedDrafts}
          onLoadSavedDraft={handleLoadSavedDraft}
          onDeleteDraft={handleDeleteSavedDraft}
        />
      )}
      <main className="flex-grow p-4 overflow-hidden">
        <PanelGroup direction="horizontal">
            <Panel defaultSize={25} minSize={20}>
                <PanelGroup direction="vertical">
                    <Panel defaultSize={60} minSize={30}>
                        <InputPanel
                            inputMode={inputMode}
                            setInputMode={handleSetInputMode}
                            inputText={inputText}
                            setInputText={setInputText}
                            urlInputs={urlInputs}
                            setUrlInputs={setUrlInputs}
                            onExtract={handleExtract}
                            isLoading={isLoading}
                            loadingStep={loadingStep}
                            onClear={handleClear}
                            onFileSelect={handleFileSelect}
                            fileNames={selectedFiles.map(f => f.name)}
                            isAiDiscoveryEnabled={isAiDiscoveryEnabled}
                            setIsAiDiscoveryEnabled={setIsAiDiscoveryEnabled}
                            totalCost={totalCost}
                        />
                    </Panel>
                    <PanelResizeHandle className="ResizeHandleOuter">
                        <div className="ResizeHandleInner" />
                    </PanelResizeHandle>
                    <Panel defaultSize={40} minSize={20}>
                         {/* Show Activity Log if there are logs, otherwise History */}
                         {logs.length > 0 ? (
                             <ActivityLog logs={logs} />
                         ) : (
                            <HistoryPanel 
                                history={history}
                                onLoad={handleLoadHistory}
                                onDelete={handleDeleteHistory}
                                onClearAll={handleClearAllHistory}
                            />
                         )}
                    </Panel>
                </PanelGroup>
            </Panel>
            <PanelResizeHandle className="ResizeHandleOuter">
                <div className="ResizeHandleInner" />
            </PanelResizeHandle>
            <Panel defaultSize={75} minSize={30}>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-semibold text-brand-text flex items-center gap-2">
                    <span className="w-2 h-8 bg-brand-primary rounded-full"></span>
                    Extracted Endpoints ({extractedEndpoints.length})
                  </h2>
                  {extractedEndpoints.length > 0 && (
                    <button
                      onClick={handleExportOpenApi}
                      className="text-sm bg-brand-surface border border-brand-primary/30 text-brand-primary px-3 py-1 rounded hover:bg-brand-primary/10 transition-colors"
                    >
                      Export OpenAPI
                    </button>
                  )}
                </div>            
                <ResultsDisplay
                    endpoints={displayedEndpoints}
                    isLoading={isLoading && (loadingStep === 'analyzing' || loadingStep === 'beautifying')}
                    error={error}
                    source={analysisSource}
                    analysisCode={analysisCode}
                    onUpdateEndpoint={handleUpdateEndpoint}
                    totalCost={totalCost}
                    variables={activeEnvId ? environments.find(e => e.id === activeEnvId)?.variables : undefined}
                    collections={collections}
                    selectedCollectionId={selectedCollectionId}
                    onCollectionSelect={setSelectedCollectionId}
                    onRequestExecuted={handleRequestExecuted}
                    onOpenTests={(endpoint) => {
                      setSelectedEndpointForTests({ id: endpoint.id || `${endpoint.path}-${endpoint.method}`, path: endpoint.path });
                      setIsTestPanelOpen(true);
                    }}
                    onOpenHistory={(endpoint) => {
                      setSelectedEndpointForHistory(endpoint.id || `${endpoint.path}-${endpoint.method}`);
                      setIsRequestHistoryOpen(true);
                    }}
                    onOpenWorkbench={openWorkbenchForEndpoint}
                />
            </Panel>
        </PanelGroup>
      </main>
    </div>
  );
};

export default App;
