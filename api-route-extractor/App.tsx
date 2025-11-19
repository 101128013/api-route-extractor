
import React, { useState, useCallback } from 'react';
import {
  Panel,
  PanelGroup,
  PanelResizeHandle,
} from "react-resizable-panels";
import { InputPanel } from './components/CodeInput';
import { ResultsDisplay } from './components/ResultsDisplay';
import { extractApiEndpoints, beautifyCode } from './services/geminiService';
import type { ApiEndpoint, HistoryItem } from './types';
import { HistoryPanel } from './components/HistoryPanel';
import { useLocalStorage } from './hooks/useLocalStorage';
import { SettingsModal } from './components/SettingsModal';
import { Header } from './components/Header';


import { fetchUrlContent, smartCrawl } from './services/CrawlerService';
import { verifyEndpoint } from './services/VerificationService';
import { ActivityLog, LogEntry, LogType } from './components/ActivityLog';


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
  const [logs, setLogs] = useState<LogEntry[]>([]);

  const [isAiDiscoveryEnabled, setIsAiDiscoveryEnabled] = useState(false);

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
          finalEndpoints.map(async (endpoint) => {
            try {
              const [curl, javascript, python, php, go] = await Promise.all([
                beautifyCode(endpoint.example.request.curl, handleCostUpdate),
                beautifyCode(endpoint.example.request.javascript, handleCostUpdate),
                beautifyCode(endpoint.example.request.python, handleCostUpdate),
                beautifyCode(endpoint.example.request.php, handleCostUpdate),
                beautifyCode(endpoint.example.request.go, handleCostUpdate),
              ]);
              return {
                ...endpoint,
                example: {
                  ...endpoint.example,
                  request: { curl, javascript, python, php, go },
                },
              };
            } catch (e) {
                return endpoint; 
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
      console.error(err);
      const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred.';
      addLog(`Error: ${errorMessage}`, 'error');
      setError(`Failed to fetch or process the URL. The site might be protected by CORS or is offline. All proxy attempts failed. Try pasting the code manually. Details: ${errorMessage}`);
    } finally {
      setIsLoading(false);
      setLoadingStep(null);
    }
  }, [inputText, urlInputs, inputMode, selectedFiles, setHistory, isAiDiscoveryEnabled, addLog, analysisCode, handleCostUpdate]);

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

  const handleUpdateEndpoint = (index: number, updatedEndpoint: ApiEndpoint) => {
    setExtractedEndpoints(prev => {
        const newEndpoints = [...prev];
        if (newEndpoints[index]) {
            newEndpoints[index] = updatedEndpoint;
        }
        return newEndpoints;
    });
  };

  return (
    <div className="flex flex-col h-full bg-brand-bg">
      <Header onOpenSettings={() => setIsSettingsOpen(true)} />
      <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
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
                <ResultsDisplay
                    endpoints={extractedEndpoints}
                    isLoading={isLoading && (loadingStep === 'analyzing' || loadingStep === 'beautifying')}
                    error={error}
                    source={analysisSource}
                    analysisCode={analysisCode}
                    onUpdateEndpoint={handleUpdateEndpoint}
                    totalCost={totalCost}
                />
            </Panel>
        </PanelGroup>
      </main>
    </div>
  );
};

export default App;
