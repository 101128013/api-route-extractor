import React, { useState, useEffect } from 'react';
import { useLocalStorage } from '../hooks/useLocalStorage';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose }) => {
  const [provider, setProvider] = useLocalStorage<'gemini' | 'openai'>('ai-provider', 'gemini');
  const [apiKey, setApiKey] = useLocalStorage<string>('gemini-api-key', '');
  const [openaiBaseUrl, setOpenaiBaseUrl] = useLocalStorage<string>('openai-base-url', 'http://localhost:1234/v1');
  const [openaiModel, setOpenaiModel] = useLocalStorage<string>('openai-model', 'gpt-3.5-turbo');
  const [openaiKey, setOpenaiKey] = useLocalStorage<string>('openai-api-key', '');

  const [tempApiKey, setTempApiKey] = useState('');
  const [tempOpenaiBaseUrl, setTempOpenaiBaseUrl] = useState('');
  const [tempOpenaiModel, setTempOpenaiModel] = useState('');
  const [tempOpenaiKey, setTempOpenaiKey] = useState('');

  useEffect(() => {
    if (isOpen) {
      setTempApiKey(apiKey || '');
      setTempOpenaiBaseUrl(openaiBaseUrl || 'http://localhost:1234/v1');
      setTempOpenaiModel(openaiModel || 'gpt-3.5-turbo');
      setTempOpenaiKey(openaiKey || '');
    }
  }, [isOpen, apiKey, openaiBaseUrl, openaiModel, openaiKey]);

  const handleSave = () => {
    setApiKey(tempApiKey.trim());
    setOpenaiBaseUrl(tempOpenaiBaseUrl.trim());
    setOpenaiModel(tempOpenaiModel.trim());
    setOpenaiKey(tempOpenaiKey.trim());
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-fade-in">
      <div className="bg-brand-surface border border-brand-primary rounded-lg shadow-xl w-full max-w-md p-6 transform transition-all scale-100">
        <h2 className="text-xl font-bold text-brand-text mb-4">AI Settings</h2>
        
        <div className="mb-6">
            <label className="block text-sm font-medium text-brand-subtle mb-2">AI Provider</label>
            <div className="flex bg-brand-bg rounded-md p-1 border border-brand-primary mb-4">
                <button 
                    onClick={() => setProvider('gemini')}
                    className={`flex-1 py-1.5 text-sm rounded-md transition-all ${provider === 'gemini' ? 'bg-brand-secondary text-white shadow-sm' : 'text-brand-subtle hover:text-brand-text'}`}
                >
                    Google Gemini
                </button>
                <button 
                    onClick={() => setProvider('openai')}
                    className={`flex-1 py-1.5 text-sm rounded-md transition-all ${provider === 'openai' ? 'bg-brand-secondary text-white shadow-sm' : 'text-brand-subtle hover:text-brand-text'}`}
                >
                    Local / OpenAI
                </button>
            </div>

          {provider === 'gemini' ? (
              <div>
                <label htmlFor="apiKey" className="block text-sm font-medium text-brand-subtle mb-2">
                    Gemini API Key
                </label>
                <input
                    id="apiKey"
                    type="password"
                    value={tempApiKey}
                    onChange={(e) => setTempApiKey(e.target.value)}
                    placeholder="Enter your Gemini API Key"
                    className="w-full px-4 py-2 bg-brand-bg border border-brand-primary rounded-md text-brand-text focus:outline-none focus:ring-2 focus:ring-brand-secondary transition-all"
                />
                <p className="text-xs text-brand-subtle mt-2">
                    <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer" className="text-brand-secondary hover:underline">
                    Get a Gemini key here.
                    </a>
                </p>
              </div>
          ) : (
              <div className="space-y-4">
                  <div>
                    <label htmlFor="openaiBaseUrl" className="block text-sm font-medium text-brand-subtle mb-2">
                        Base URL
                    </label>
                    <input
                        id="openaiBaseUrl"
                        type="text"
                        value={tempOpenaiBaseUrl}
                        onChange={(e) => setTempOpenaiBaseUrl(e.target.value)}
                        placeholder="http://localhost:1234/v1"
                        className="w-full px-4 py-2 bg-brand-bg border border-brand-primary rounded-md text-brand-text focus:outline-none focus:ring-2 focus:ring-brand-secondary transition-all"
                    />
                    <p className="text-xs text-brand-subtle mt-1">For LM Studio, Ollama, or OpenAI.</p>
                  </div>
                  <div>
                    <label htmlFor="openaiModel" className="block text-sm font-medium text-brand-subtle mb-2">
                        Model Name
                    </label>
                    <input
                        id="openaiModel"
                        type="text"
                        value={tempOpenaiModel}
                        onChange={(e) => setTempOpenaiModel(e.target.value)}
                        placeholder="gpt-3.5-turbo"
                        className="w-full px-4 py-2 bg-brand-bg border border-brand-primary rounded-md text-brand-text focus:outline-none focus:ring-2 focus:ring-brand-secondary transition-all"
                    />
                  </div>
                  <div>
                    <label htmlFor="openaiKey" className="block text-sm font-medium text-brand-subtle mb-2">
                        API Key (Optional)
                    </label>
                    <input
                        id="openaiKey"
                        type="password"
                        value={tempOpenaiKey}
                        onChange={(e) => setTempOpenaiKey(e.target.value)}
                        placeholder="sk-..."
                        className="w-full px-4 py-2 bg-brand-bg border border-brand-primary rounded-md text-brand-text focus:outline-none focus:ring-2 focus:ring-brand-secondary transition-all"
                    />
                  </div>
              </div>
          )}
        </div>

        <div className="flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-brand-subtle hover:text-brand-text transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 text-sm font-medium bg-brand-secondary text-white rounded-md hover:bg-opacity-90 transition-all shadow-lg hover:shadow-brand-secondary/20"
          >
            Save Settings
          </button>
        </div>
      </div>
    </div>
  );
};
