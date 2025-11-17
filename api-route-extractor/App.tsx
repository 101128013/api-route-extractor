
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


// List of CORS proxy providers. They are tried in order.
const proxies = [
    (url: string) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
    (url: string) => `https://corsproxy.io/?${encodeURIComponent(url)}`,
];

/**
 * Tries to fetch a URL using a series of CORS proxies.
 * @param url The URL to fetch.
 * @returns A promise that resolves to the response object.
 * @throws An error if all proxies fail.
 */
const fetchWithProxies = async (url: string): Promise<Response> => {
    let lastError: Error | null = null;
    for (const proxy of proxies) {
        try {
            const response = await fetch(proxy(url));
            if (response.ok) {
                return response;
            }
            lastError = new Error(`Proxy failed with status: ${response.status}`);
        } catch (error) {
            lastError = error instanceof Error ? error : new Error(String(error));
        }
    }
    throw new Error(`All proxies failed. Last error: ${lastError?.message}`);
};


const App: React.FC = () => {
  const [inputText, setInputText] = useState<string>('');
  const [urlInputs, setUrlInputs] = useState<string[]>(['']);
  const [inputMode, setInputMode] = useState<'code' | 'url' | 'file'>('code');
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [extractedEndpoints, setExtractedEndpoints] = useState<ApiEndpoint[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [loadingStep, setLoadingStep] = useState<'fetching' | 'beautifying' | 'analyzing' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [analysisSource, setAnalysisSource] = useState<string | null>(null);
  const [analysisCode, setAnalysisCode] = useState<string | null>(null);
  const [history, setHistory] = useLocalStorage<HistoryItem[]>('api-extractor-history', []);

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
  };


  const handleExtract = useCallback(async () => {
    setIsLoading(true);
    setLoadingStep(null);
    setError(null);
    setExtractedEndpoints([]);
    setAnalysisSource(null);
    setAnalysisCode(null);

    let sourceForHistory = '';
    
    try {
      let codeToAnalyze = '';
      if (inputMode === 'code') {
        if (!inputText.trim()) {
          setError('Please paste some code to analyze.');
          setIsLoading(false);
          return;
        }
        codeToAnalyze = inputText;
        sourceForHistory = 'Pasted Code';
        setAnalysisSource(sourceForHistory);
      } else if (inputMode === 'file') {
        if (selectedFiles.length === 0 || !inputText.trim()) {
            setError('Please select and upload a valid code file.');
            setIsLoading(false);
            return;
        }
        codeToAnalyze = inputText;
        sourceForHistory = `${selectedFiles.length} file(s): ${selectedFiles.map(f => f.name).join(', ')}`;
        setAnalysisSource(`${selectedFiles.length} file(s)`);
      } else { // url mode
        // Merge URLs from the dedicated URL inputs and any URLs typed line-by-line in the textarea
        const urlsFromInputs = urlInputs.map(u => u.trim()).filter(Boolean);
        const urlsFromText = inputText
          .split(/\r?\n/) // each line
          .map(line => line.trim())
          .filter(line => line.length > 0);

        const urlsToAnalyze = [...urlsFromInputs, ...urlsFromText];
        if (urlsToAnalyze.length === 0) {
          setError('Please enter at least one URL to analyze.');
          setIsLoading(false);
          return;
        }
        
        let validUrls: URL[] = [];
        for (const urlStr of urlsToAnalyze) {
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

        const allContentPromises = validUrls.map(async (validUrl) => {
            const response = await fetchWithProxies(validUrl.href);
            const html = await response.text();
            
            const parser = new DOMParser();
            const doc = parser.parseFromString(html, 'text/html');
            const scripts = doc.querySelectorAll('script');
            
            const scriptPromises = Array.from(scripts).map(async (script) => {
              if (script.src) {
                try {
                  const scriptUrl = new URL(script.src, validUrl.href).href;
                  const scriptResponse = await fetchWithProxies(scriptUrl);
                  return await scriptResponse.text();
                } catch (e) {
                  const errorMessage = e instanceof Error ? e.message : 'Unknown error';
                  console.warn(`Failed to fetch script via proxies: ${script.src}. Error: ${errorMessage}`);
                  return `// Failed to fetch script: ${script.src}`;
                }
              }
              return script.textContent || '';
            });

            const scriptContents = await Promise.all(scriptPromises);
            return `/* --- Fetched from URL: ${validUrl.href} --- */\n\n${html}\n\n${scriptContents.join('\n\n/* --- SCRIPT SEPARATOR --- */\n\n')}`;
        });
        
        const fetchedContents = await Promise.all(allContentPromises);
        codeToAnalyze = fetchedContents.join('\n\n/* --- URL SEPARATOR --- */\n\n');
        setInputText(codeToAnalyze);
      }

      if (!codeToAnalyze.trim()) {
          setError('Could not find any code to analyze.');
          setIsLoading(false);
          return;
      }

      setAnalysisCode(codeToAnalyze);
      setLoadingStep('analyzing');
      const rawEndpoints = await extractApiEndpoints(codeToAnalyze);

      if (rawEndpoints.length > 0) {
        setLoadingStep('beautifying');
        const beautifiedEndpoints = await Promise.all(
          rawEndpoints.map(async (endpoint) => {
            try {
              const [curl, javascript, python, php, go] = await Promise.all([
                beautifyCode(endpoint.example.request.curl),
                beautifyCode(endpoint.example.request.javascript),
                beautifyCode(endpoint.example.request.python),
                beautifyCode(endpoint.example.request.php),
                beautifyCode(endpoint.example.request.go),
              ]);
              return {
                ...endpoint,
                example: {
                  ...endpoint.example,
                  request: { curl, javascript, python, php, go },
                },
              };
            } catch (e) {
                console.warn("Could not beautify snippets for endpoint:", endpoint.path, e);
                return endpoint; // return original endpoint if beautification fails
            }
          })
        );
        setExtractedEndpoints(beautifiedEndpoints);

        const newHistoryItem: HistoryItem = {
            id: Date.now().toString(),
            timestamp: Date.now(),
            source: sourceForHistory,
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
      }
      
    } catch (err) {
      console.error(err);
      const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred.';
      setError(`Failed to fetch or process the URL. The site might be protected by CORS or is offline. All proxy attempts failed. Try pasting the code manually. Details: ${errorMessage}`);
    } finally {
      setIsLoading(false);
      setLoadingStep(null);
    }
  }, [inputText, urlInputs, inputMode, selectedFiles, setHistory]);

  const handleSetInputMode = (mode: 'code' | 'url' | 'file') => {
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
    <div className="flex flex-col h-screen bg-brand-bg">
      <main className="flex-grow p-4">
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
                        />
                    </Panel>
                    <PanelResizeHandle className="ResizeHandleOuter">
                        <div className="ResizeHandleInner" />
                    </PanelResizeHandle>
                    <Panel defaultSize={40} minSize={20}>
                        <HistoryPanel 
                            history={history}
                            onLoad={handleLoadHistory}
                            onDelete={handleDeleteHistory}
                            onClearAll={handleClearAllHistory}
                        />
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
                />
            </Panel>
        </PanelGroup>
      </main>
    </div>
  );
};

export default App;
