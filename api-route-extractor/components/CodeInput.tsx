
import React, { useRef } from 'react';
import { ClearIcon, SparklesIcon, SpinnerIcon, LinkIcon, CodeBracketIcon, UploadIcon, XIcon } from './icons';

interface InputPanelProps {
  inputMode: 'code' | 'url' | 'file';
  setInputMode: (mode: 'code' | 'url' | 'file') => void;
  inputText: string;
  setInputText: (text: string) => void;
  urlInputs: string[];
  setUrlInputs: (urls: string[]) => void;
  onExtract: () => void;
  isLoading: boolean;
  loadingStep: 'fetching' | 'beautifying' | 'analyzing' | null;
  onClear: () => void;
  onFileSelect: (files: FileList) => void;
  fileNames: string[];
}

const TabButton: React.FC<{ active: boolean; onClick: () => void; children: React.ReactNode }> = ({ active, onClick, children }) => (
    <button
        onClick={onClick}
        className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-md transition-colors ${
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

  const handleUrlChange = (index: number, value: string) => {
    const newUrlInputs = [...urlInputs];
    newUrlInputs[index] = value;
    setUrlInputs(newUrlInputs);
  };

  const addUrlInput = () => {
      if (urlInputs.length < 10) {
          setUrlInputs([...urlInputs, '']);
      }
  };

  const removeUrlInput = (index: number) => {
      if (urlInputs.length > 1) {
          const newUrlInputs = urlInputs.filter((_, i) => i !== index);
          setUrlInputs(newUrlInputs);
      }
  };
  
  const isExtractDisabled = isLoading || 
    (inputMode === 'code' && !inputText.trim()) ||
    (inputMode === 'url' && urlInputs.every(u => !u.trim())) ||
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
      <div className="flex justify-between items-center p-3 border-b border-brand-primary">
        <div className="flex items-center gap-2">
            <TabButton active={inputMode === 'code'} onClick={() => setInputMode('code')}>
                <CodeBracketIcon />
                Paste Code
            </TabButton>
             <TabButton active={inputMode === 'url'} onClick={() => setInputMode('url')}>
                <LinkIcon />
                From URL
            </TabButton>
            <TabButton active={inputMode === 'file'} onClick={() => setInputMode('file')}>
                <UploadIcon />
                Upload
            </TabButton>
        </div>
        <button
          onClick={onClear}
          className="p-1 text-brand-subtle hover:text-white transition-colors duration-200"
          title="Clear input"
        >
          <ClearIcon />
        </button>
      </div>
      
      {inputMode === 'code' && (
        <textarea
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder="Paste your minified JavaScript, code snippets, or any text here to find API routes..."
          className="flex-grow p-4 bg-transparent resize-none focus:outline-none font-mono text-sm leading-relaxed"
          spellCheck="false"
        />
      )}
      {inputMode === 'url' && (
        <div className="flex-grow p-4 flex flex-col">
            <div className="space-y-2">
              {urlInputs.map((url, index) => (
                <div key={index} className="flex items-center gap-2">
                    <input
                        type="url"
                        value={url}
                        onChange={(e) => handleUrlChange(index, e.target.value)}
                        placeholder="https://example.com"
                        className="w-full p-3 bg-brand-bg border border-brand-primary rounded-md focus:outline-none focus:ring-2 focus:ring-brand-secondary font-mono text-sm"
                    />
                    {urlInputs.length > 1 && (
                      <button 
                        onClick={() => removeUrlInput(index)}
                        className="p-1 text-brand-subtle hover:text-red-400 transition-colors rounded-full hover:bg-brand-primary"
                        title="Remove URL"
                        aria-label="Remove URL"
                      >
                          <XIcon className="w-5 h-5" />
                      </button>
                    )}
                </div>
              ))}
            </div>
            
            {urlInputs.length < 10 && (
                <button
                    onClick={addUrlInput}
                    className="mt-3 text-sm text-brand-secondary hover:text-opacity-80 transition-opacity self-start font-semibold"
                >
                    + Add another URL
                </button>
            )}

            <div className="mt-4 p-3 bg-brand-primary/30 border border-brand-primary/50 rounded-md text-xs text-brand-subtle">
                <p><strong>Note:</strong> Fetching from a URL uses a public CORS proxy. This may not work for all sites, especially those with strict security policies. If it fails, please try pasting the code manually.</p>
            </div>
             {inputText && (
                <div className="mt-4 flex-grow flex flex-col border border-brand-primary rounded-md bg-brand-bg">
                    <p className="text-xs p-2 text-brand-subtle border-b border-brand-primary">Fetched Code Preview (read-only):</p>
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
          className="w-full flex items-center justify-center gap-2 bg-brand-secondary text-white font-bold py-3 px-4 rounded-md hover:bg-opacity-90 transition-all duration-200 disabled:bg-brand-primary disabled:cursor-not-allowed"
        >
          {getButtonContent()}
        </button>
      </div>
    </div>
  );
};
