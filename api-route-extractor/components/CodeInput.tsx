
import React, { useRef } from 'react';
import { ClearIcon, SparklesIcon, SpinnerIcon, CodeBracketIcon, UploadIcon } from './icons';

interface InputPanelProps {
  inputMode: 'code' | 'file';
  setInputMode: (mode: 'code' | 'file') => void;
  inputText: string;
  setInputText: (text: string) => void;
  urlInputs: string[]; // kept for compatibility with App state but not used in the UI
  setUrlInputs: (urls: string[]) => void;
  onExtract: () => void;
  isLoading: boolean;
  loadingStep: 'fetching' | 'beautifying' | 'analyzing' | null;
  onClear: () => void;
  onFileSelect: (files: FileList) => void;
  fileNames: string[];
  isAiDiscoveryEnabled: boolean;
  setIsAiDiscoveryEnabled: (enabled: boolean) => void;
}

const TabButton: React.FC<{ active: boolean; onClick: () => void; children: React.ReactNode }> = ({ active, onClick, children }) => (
    <button
        onClick={onClick}
        className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 text-sm font-semibold rounded-md transition-colors whitespace-nowrap ${
            active
                ? 'bg-brand-secondary/20 text-brand-secondary'
                : 'text-brand-subtle hover:bg-brand-primary/50'
        }`}
    >
        {children}
    </button>
);


export const InputPanel: React.FC<InputPanelProps> = ({ 
    inputMode, 
    setInputMode, 
    inputText, 
    setInputText,
    urlInputs,
    setUrlInputs,
    onExtract, 
    isLoading,
    loadingStep,
    onClear,
    onFileSelect,
    fileNames,
    isAiDiscoveryEnabled,
    setIsAiDiscoveryEnabled,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileButtonClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files && files.length > 0) {
        onFileSelect(files);
    }
    // Clear the input value so the same file(s) can be selected again
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const isExtractDisabled = isLoading || 
    (inputMode === 'code' && !inputText.trim()) ||
    (inputMode === 'file' && fileNames.length === 0);

  const getButtonContent = () => {
    if (isLoading) {
      switch (loadingStep) {
        case 'fetching':
          return <><SpinnerIcon /> Fetching URL(s)...</>;
        case 'beautifying':
          return <><SpinnerIcon /> Polishing Results...</>;
        case 'analyzing':
          return <><SpinnerIcon /> Analyzing Code...</>;
        default:
          return <><SpinnerIcon /> Processing...</>;
      }
    }
    return <><SparklesIcon /> Extract API Routes</>;
  };

  return (
    <div className="flex flex-col bg-brand-surface rounded-lg border border-brand-primary h-full">
      <div className="flex justify-between items-center p-3 border-b border-brand-primary gap-2">
        <div className="flex items-center gap-2 flex-1 bg-brand-bg/50 p-1 rounded-lg">
          <TabButton active={inputMode === 'code'} onClick={() => setInputMode('code')}>
            <CodeBracketIcon />
            Paste Code / URL
          </TabButton>
            <TabButton active={inputMode === 'file'} onClick={() => setInputMode('file')}>
                <UploadIcon />
                Upload
            </TabButton>
        </div>
        <button
          onClick={onClear}
          className="p-2 text-brand-subtle hover:text-red-500 hover:bg-red-500/10 rounded-md transition-colors duration-200 flex-shrink-0"
          title="Clear input"
          aria-label="Clear input"
        >
          <ClearIcon />
        </button>
      </div>
      
      {inputMode === 'code' && (
        <div className="flex-grow flex flex-col min-h-0">
          <textarea
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="Paste code or URLs here.\n- Normal text/code will be analyzed as code.\n- Lines that look like URLs (or start with http/https) will be fetched and analyzed separately."
            className="flex-grow p-4 bg-transparent border-none resize-none focus:outline-none font-mono text-sm leading-relaxed w-full h-full"
            spellCheck="false"
            aria-label="Code or URL input"
          />
          <div className="px-4 pb-2 flex flex-col gap-2">
            <div className="p-2 bg-brand-primary/30 border border-brand-primary/50 rounded-md text-xs text-brand-subtle">
                <p className="font-semibold text-brand-text mb-1">How it works:</p>
                <ul className="list-disc list-inside space-y-1">
                <li>Paste any code snippet or text and it will be analyzed directly.</li>
                <li>Paste one or more URLs (one per line) to fetch and analyze each page separately.</li>
                </ul>
            </div>
             <div className="flex items-center gap-2 p-2 bg-brand-primary/10 border border-brand-primary/30 rounded-md">
                <label className="relative inline-flex items-center cursor-pointer">
                    <input 
                        type="checkbox" 
                        className="sr-only peer" 
                        checked={isAiDiscoveryEnabled}
                        onChange={(e) => setIsAiDiscoveryEnabled(e.target.checked)}
                    />
                    <div className="w-9 h-5 bg-gray-600 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-brand-secondary rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-brand-secondary"></div>
                    <span className="ml-3 text-sm font-medium text-brand-text flex items-center gap-2">
                        <SparklesIcon />
                        AI Discovery Mode
                    </span>
                </label>
                <span className="text-xs text-brand-subtle hidden sm:inline">(Auto-crawls & predicts routes)</span>
            </div>
          </div>
        </div>
      )}
      {inputMode === 'file' && (
        <div className="flex-grow p-4 flex flex-col justify-center items-center">
            <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                className="hidden"
                accept=".js,.ts,.jsx,.tsx,.html,.txt,application/javascript"
                multiple
            />
            <button
                onClick={handleFileButtonClick}
                className="flex items-center gap-3 bg-brand-primary hover:bg-brand-primary/80 text-white font-semibold py-3 px-6 rounded-lg transition-colors"
            >
                <UploadIcon />
                {fileNames.length > 0 ? 'Choose Different Files' : 'Select Files to Analyze'}
            </button>
            {fileNames.length > 0 && (
                <div className="mt-4 text-sm text-brand-subtle w-full text-left">
                  <p className="font-semibold text-brand-text mb-2">Selected Files ({fileNames.length}):</p>
                  <div className="bg-brand-bg border border-brand-primary rounded-md p-3 max-h-24 overflow-y-auto text-xs font-mono">
                      <ul className="space-y-1">
                          {fileNames.map((name, index) => (
                              <li key={index} className="truncate" title={name}>{name}</li>
                          ))}
                      </ul>
                  </div>
                </div>
            )}
             {inputText && fileNames.length > 0 && (
                <div className="mt-4 flex-grow flex flex-col border border-brand-primary rounded-md bg-brand-bg w-full">
                    <p className="text-xs p-2 text-brand-subtle border-b border-brand-primary">Combined Content Preview (read-only):</p>
                    <textarea
                        value={inputText}
                        readOnly
                        className="flex-grow p-2 bg-transparent resize-none focus:outline-none font-mono text-xs text-brand-subtle"
                        spellCheck="false"
                    />
                </div>
            )}
        </div>
      )}

      <div className="p-4 border-t border-brand-primary">
        <button
          onClick={onExtract}
          disabled={isExtractDisabled}
          className="w-full flex items-center justify-center gap-2 bg-green-600 text-white font-bold py-3 px-4 rounded-md hover:bg-green-500 shadow-lg shadow-green-900/20 transition-all duration-200 disabled:bg-brand-primary disabled:cursor-not-allowed disabled:shadow-none"
        >
          {getButtonContent()}
        </button>
      </div>
    </div>
  );
};
