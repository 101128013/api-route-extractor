import React, { useState, useEffect } from 'react';
import { useLocalStorage } from '../hooks/useLocalStorage';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose }) => {
  const [apiKey, setApiKey] = useLocalStorage<string>('gemini-api-key', '');
  const [inputValue, setInputValue] = useState('');

  useEffect(() => {
    if (isOpen) {
      setInputValue(apiKey || '');
    }
  }, [isOpen, apiKey]);

  const handleSave = () => {
    setApiKey(inputValue.trim());
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-fade-in">
      <div className="bg-brand-surface border border-brand-primary rounded-lg shadow-xl w-full max-w-md p-6 transform transition-all scale-100">
        <h2 className="text-xl font-bold text-brand-text mb-4">Settings</h2>
        
        <div className="mb-6">
          <label htmlFor="apiKey" className="block text-sm font-medium text-brand-subtle mb-2">
            Gemini API Key
          </label>
          <input
            id="apiKey"
            type="password"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="Enter your Gemini API Key"
            className="w-full px-4 py-2 bg-brand-bg border border-brand-primary rounded-md text-brand-text focus:outline-none focus:ring-2 focus:ring-brand-secondary transition-all"
          />
          <p className="text-xs text-brand-subtle mt-2">
            Your key is stored locally in your browser. 
            <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer" className="text-brand-secondary hover:underline ml-1">
              Get a key here.
            </a>
          </p>
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
