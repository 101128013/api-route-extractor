import React, { useState, useEffect } from 'react';
import { AuthService } from '../services/AuthService';
import type { AuthConfig } from '../types';
import type { Environment } from './EnvironmentManager';
import { KeyIcon, XIcon, PlusIcon, TrashIcon, LockClosedIcon } from './icons';

interface AuthManagerProps {
  isOpen: boolean;
  onClose: () => void;
  environments: Environment[];
  activeEnvironmentId: string | null;
}

export const AuthManager: React.FC<AuthManagerProps> = ({
  isOpen,
  onClose,
  environments,
  activeEnvironmentId,
}) => {
  const [authConfigs, setAuthConfigs] = useState<AuthConfig[]>(AuthService.getAuthConfigs());
  const [selectedConfig, setSelectedConfig] = useState<AuthConfig | null>(null);
  const [editingConfig, setEditingConfig] = useState<AuthConfig | null>(null);

  useEffect(() => {
    if (isOpen) {
      setAuthConfigs(AuthService.getAuthConfigs());
    }
  }, [isOpen]);

  const handleCreateConfig = () => {
    const newConfig: AuthConfig = {
      id: crypto.randomUUID(),
      name: 'New Auth Config',
      type: 'bearer',
      enabled: true,
      environmentId: activeEnvironmentId || undefined,
    };
    setEditingConfig(newConfig);
  };

  const handleSaveConfig = (config: AuthConfig) => {
    AuthService.saveAuthConfig(config);
    setAuthConfigs(AuthService.getAuthConfigs());
    setEditingConfig(null);
  };

  const handleDeleteConfig = (id: string) => {
    if (confirm('Delete this auth configuration?')) {
      AuthService.deleteAuthConfig(id);
      setAuthConfigs(AuthService.getAuthConfigs());
      if (selectedConfig?.id === id) {
        setSelectedConfig(null);
      }
    }
  };

  const handleRefreshToken = async (config: AuthConfig) => {
    const refreshed = await AuthService.refreshToken(config);
    if (refreshed) {
      setAuthConfigs(AuthService.getAuthConfigs());
      alert('Token refreshed successfully');
    } else {
      alert('Token refresh failed');
    }
  };

  if (!isOpen) return null;

  const filteredConfigs = activeEnvironmentId
    ? authConfigs.filter(a => a.environmentId === activeEnvironmentId)
    : authConfigs;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-brand-surface border border-brand-primary rounded-lg shadow-xl w-[800px] h-[600px] flex flex-col">
        <div className="p-4 border-b border-brand-primary flex justify-between items-center">
          <div className="flex items-center gap-2">
            <KeyIcon />
            <h2 className="text-xl font-semibold text-brand-text">Authentication Manager</h2>
          </div>
          <button onClick={onClose} className="text-brand-subtle hover:text-brand-text">
            <XIcon />
          </button>
        </div>

        <div className="flex flex-1 overflow-hidden">
          <div className="w-1/3 border-r border-brand-primary p-4 bg-brand-bg/50">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-medium text-brand-subtle">Configurations</span>
              <button
                onClick={handleCreateConfig}
                className="text-brand-primary hover:text-brand-primary/80"
                title="New Auth Config"
              >
                <PlusIcon className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-1 overflow-y-auto">
              {filteredConfigs.map(config => (
                <div
                  key={config.id}
                  className={`p-2 rounded cursor-pointer flex justify-between items-center ${
                    selectedConfig?.id === config.id
                      ? 'bg-brand-primary/20 text-brand-text'
                      : 'text-brand-subtle hover:bg-brand-surface'
                  }`}
                  onClick={() => setSelectedConfig(config)}
                >
                  <div className="flex items-center gap-2">
                    <LockClosedIcon className="w-4 h-4" />
                    <span className="truncate">{config.name}</span>
                  </div>
                  {!config.enabled && (
                    <span className="text-xs text-brand-subtle">Disabled</span>
                  )}
                </div>
              ))}
              {filteredConfigs.length === 0 && (
                <p className="text-sm text-brand-subtle/50 italic">No auth configurations</p>
              )}
            </div>
          </div>

          <div className="flex-1 p-4 overflow-y-auto">
            {editingConfig ? (
              <EditAuthConfig
                config={editingConfig}
                environments={environments}
                onSave={handleSaveConfig}
                onCancel={() => setEditingConfig(null)}
              />
            ) : selectedConfig ? (
              <ViewAuthConfig
                config={selectedConfig}
                onEdit={() => setEditingConfig(selectedConfig)}
                onDelete={() => handleDeleteConfig(selectedConfig.id)}
                onRefresh={() => handleRefreshToken(selectedConfig)}
              />
            ) : (
              <div className="h-full flex items-center justify-center text-brand-subtle">
                Select or create an auth configuration
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

const EditAuthConfig: React.FC<{
  config: AuthConfig;
  environments: Environment[];
  onSave: (config: AuthConfig) => void;
  onCancel: () => void;
}> = ({ config, environments, onSave, onCancel }) => {
  const [name, setName] = useState(config.name);
  const [type, setType] = useState<AuthConfig['type']>(config.type);
  const [enabled, setEnabled] = useState(config.enabled);
  const [environmentId, setEnvironmentId] = useState(config.environmentId || '');

  // Bearer fields
  const [token, setToken] = useState(config.token || '');
  const [tokenUrl, setTokenUrl] = useState(config.tokenUrl || '');
  const [refreshToken, setRefreshToken] = useState(config.refreshToken || '');

  // API Key fields
  const [apiKeyLocation, setApiKeyLocation] = useState<'header' | 'query' | 'cookie'>('header');
  const [apiKeyName, setApiKeyName] = useState(config.apiKey?.name || '');
  const [apiKeyValue, setApiKeyValue] = useState(config.apiKey?.value || '');

  // Basic fields
  const [username, setUsername] = useState(config.basic?.username || '');
  const [password, setPassword] = useState(config.basic?.password || '');

  const handleSave = () => {
    const updated: AuthConfig = {
      ...config,
      name,
      type,
      enabled,
      environmentId: environmentId || undefined,
    };

    if (type === 'bearer') {
      updated.token = token;
      updated.tokenUrl = tokenUrl;
      updated.refreshToken = refreshToken;
    } else if (type === 'apiKey') {
      updated.apiKey = {
        location: apiKeyLocation,
        name: apiKeyName,
        value: apiKeyValue,
      };
    } else if (type === 'basic') {
      updated.basic = {
        username,
        password,
      };
    }

    onSave(updated);
  };

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-brand-text">Edit Auth Configuration</h3>
      <div className="space-y-4">
        <div>
          <label className="block text-sm text-brand-subtle mb-1">Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full bg-brand-bg border border-brand-primary rounded px-3 py-2 text-brand-text"
          />
        </div>
        <div>
          <label className="block text-sm text-brand-subtle mb-1">Type</label>
          <select
            value={type}
            onChange={(e) => setType(e.target.value as AuthConfig['type'])}
            className="w-full bg-brand-bg border border-brand-primary rounded px-3 py-2 text-brand-text"
          >
            <option value="bearer">Bearer Token</option>
            <option value="apiKey">API Key</option>
            <option value="basic">Basic Auth</option>
            <option value="oauth2">OAuth 2.0</option>
          </select>
        </div>
        <div>
          <label className="block text-sm text-brand-subtle mb-1">Environment</label>
          <select
            value={environmentId}
            onChange={(e) => setEnvironmentId(e.target.value)}
            className="w-full bg-brand-bg border border-brand-primary rounded px-3 py-2 text-brand-text"
          >
            <option value="">All Environments</option>
            {environments.map(env => (
              <option key={env.id} value={env.id}>{env.name}</option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
            id="enabled"
          />
          <label htmlFor="enabled" className="text-sm text-brand-subtle">Enabled</label>
        </div>

        {type === 'bearer' && (
          <div className="space-y-2">
            <div>
              <label className="block text-sm text-brand-subtle mb-1">Token</label>
              <input
                type="password"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                className="w-full bg-brand-bg border border-brand-primary rounded px-3 py-2 text-brand-text"
                placeholder="Bearer token"
              />
            </div>
            <div>
              <label className="block text-sm text-brand-subtle mb-1">Token URL (for refresh)</label>
              <input
                type="text"
                value={tokenUrl}
                onChange={(e) => setTokenUrl(e.target.value)}
                className="w-full bg-brand-bg border border-brand-primary rounded px-3 py-2 text-brand-text"
                placeholder="https://api.example.com/refresh"
              />
            </div>
            <div>
              <label className="block text-sm text-brand-subtle mb-1">Refresh Token</label>
              <input
                type="password"
                value={refreshToken}
                onChange={(e) => setRefreshToken(e.target.value)}
                className="w-full bg-brand-bg border border-brand-primary rounded px-3 py-2 text-brand-text"
                placeholder="Refresh token"
              />
            </div>
          </div>
        )}

        {type === 'apiKey' && (
          <div className="space-y-2">
            <div>
              <label className="block text-sm text-brand-subtle mb-1">Location</label>
              <select
                value={apiKeyLocation}
                onChange={(e) => setApiKeyLocation(e.target.value as any)}
                className="w-full bg-brand-bg border border-brand-primary rounded px-3 py-2 text-brand-text"
              >
                <option value="header">Header</option>
                <option value="query">Query Parameter</option>
                <option value="cookie">Cookie</option>
              </select>
            </div>
            <div>
              <label className="block text-sm text-brand-subtle mb-1">Key Name</label>
              <input
                type="text"
                value={apiKeyName}
                onChange={(e) => setApiKeyName(e.target.value)}
                className="w-full bg-brand-bg border border-brand-primary rounded px-3 py-2 text-brand-text"
                placeholder="X-API-Key"
              />
            </div>
            <div>
              <label className="block text-sm text-brand-subtle mb-1">Value</label>
              <input
                type="password"
                value={apiKeyValue}
                onChange={(e) => setApiKeyValue(e.target.value)}
                className="w-full bg-brand-bg border border-brand-primary rounded px-3 py-2 text-brand-text"
                placeholder="API key value"
              />
            </div>
          </div>
        )}

        {type === 'basic' && (
          <div className="space-y-2">
            <div>
              <label className="block text-sm text-brand-subtle mb-1">Username</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full bg-brand-bg border border-brand-primary rounded px-3 py-2 text-brand-text"
              />
            </div>
            <div>
              <label className="block text-sm text-brand-subtle mb-1">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-brand-bg border border-brand-primary rounded px-3 py-2 text-brand-text"
              />
            </div>
          </div>
        )}

        <div className="flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm text-brand-subtle hover:text-brand-text"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 text-sm bg-brand-secondary text-white rounded hover:bg-brand-secondary/80"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
};

const ViewAuthConfig: React.FC<{
  config: AuthConfig;
  onEdit: () => void;
  onDelete: () => void;
  onRefresh: () => void;
}> = ({ config, onEdit, onDelete, onRefresh }) => {
  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold text-brand-text">{config.name}</h3>
        <div className="flex gap-2">
          {(config.type === 'bearer' || config.type === 'oauth2') && (
            <button
              onClick={onRefresh}
              className="px-3 py-1 text-sm bg-brand-primary text-white rounded hover:bg-brand-primary/80"
            >
              Refresh Token
            </button>
          )}
          <button
            onClick={onEdit}
            className="px-3 py-1 text-sm bg-brand-primary text-white rounded hover:bg-brand-primary/80"
          >
            Edit
          </button>
          <button
            onClick={onDelete}
            className="px-3 py-1 text-sm bg-red-500 text-white rounded hover:bg-red-600"
          >
            Delete
          </button>
        </div>
      </div>
      <div className="space-y-2 text-sm">
        <div>
          <span className="text-brand-subtle">Type: </span>
          <span className="text-brand-text">{config.type}</span>
        </div>
        <div>
          <span className="text-brand-subtle">Enabled: </span>
          <span className={config.enabled ? 'text-green-400' : 'text-red-400'}>
            {config.enabled ? 'Yes' : 'No'}
          </span>
        </div>
        {config.type === 'bearer' && config.token && (
          <div>
            <span className="text-brand-subtle">Token: </span>
            <span className="text-brand-text font-mono text-xs">
              {config.token.substring(0, 20)}...
            </span>
          </div>
        )}
      </div>
    </div>
  );
};

