import React, { useMemo } from 'react';
import type { ApiEndpoint } from '../../types';
import { LockClosedIcon } from '../icons';
import { AuthService } from '../../services/AuthService';

interface AuthRecommendationsProps {
  endpoint?: ApiEndpoint;
  selectedAuthConfigIds: string[];
  onAuthToggle: (configId: string) => void;
}

export const AuthRecommendations: React.FC<AuthRecommendationsProps> = ({
  endpoint,
  selectedAuthConfigIds,
  onAuthToggle,
}) => {
  const configs = useMemo(() => AuthService.getAuthConfigs(), []);

  const recommendedType = endpoint?.authType && endpoint.authType !== 'none' ? endpoint.authType : null;
  const guidance = useMemo(() => {
    switch (recommendedType) {
      case 'bearer':
        return 'Attach an Authorization header like "Bearer <token>".';
      case 'apiKey':
        return 'Supply your API key in the header or query params as required.';
      case 'basic':
        return 'Use username/password credentials encoded via Basic auth.';
      case 'oauth2':
        return 'Use an OAuth2 flow to exchange for an access token before calling.';
      default:
        return 'No authentication detected; optional to attach configs.';
    }
  }, [recommendedType]);

  return (
    <section className="bg-brand-bg border border-brand-primary/30 rounded-lg p-4 space-y-3">
      <div className="flex items-center gap-2">
        <LockClosedIcon className="w-4 h-4 text-brand-secondary" />
        <h4 className="text-sm font-semibold text-brand-text">Authentication</h4>
        {recommendedType && (
          <span className="text-xs text-brand-subtle bg-brand-secondary/20 px-2 py-0.5 rounded-full uppercase">
            Suggested: {recommendedType}
          </span>
        )}
      </div>
      <p className="text-xs text-brand-subtle">{guidance}</p>

      {configs.length === 0 ? (
        <p className="text-xs text-brand-subtle">
          No authentication configs defined. Use the Auth Manager to create one.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-2">
          {configs.map((config) => (
            <label
              key={config.id}
              className={`border rounded px-3 py-2 text-sm flex justify-between items-center cursor-pointer transition ${
                selectedAuthConfigIds.includes(config.id)
                  ? 'border-brand-secondary bg-brand-secondary/10 text-brand-text'
                  : 'border-brand-primary/20 bg-black/30 text-brand-subtle hover:border-brand-primary/50'
              }`}
            >
              <div>
                <p className="font-semibold">{config.name}</p>
                <p className="text-xs uppercase">{config.type}</p>
              </div>
              <input
                type="checkbox"
                checked={selectedAuthConfigIds.includes(config.id)}
                onChange={() => onAuthToggle(config.id)}
                className="w-4 h-4"
              />
            </label>
          ))}
        </div>
      )}
    </section>
  );
};

