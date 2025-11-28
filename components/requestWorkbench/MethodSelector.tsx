import React from 'react';
import type { ApiEndpoint } from '../../types';

interface MethodSelectorProps {
  method: ApiEndpoint['method'];
  onChange: (method: ApiEndpoint['method']) => void;
}

const METHODS: ApiEndpoint['method'][] = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS', 'HEAD'];

export const MethodSelector: React.FC<MethodSelectorProps> = ({ method, onChange }) => {
  return (
    <select
      value={method}
      onChange={(e) => onChange(e.target.value as ApiEndpoint['method'])}
      className="bg-black/40 border border-brand-primary/40 rounded px-2 py-2 text-sm text-brand-text font-semibold"
    >
      {METHODS.map((m) => (
        <option key={m} value={m}>
          {m}
        </option>
      ))}
    </select>
  );
};

