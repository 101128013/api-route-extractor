import React from 'react';
import type { KeyValuePair } from '../../types';
import { PlusIcon, TrashIcon } from '../icons';

interface RequestKeyValueEditorProps {
  title: string;
  entries: KeyValuePair[];
  kind: 'header' | 'param';
  onChange: (entries: KeyValuePair[]) => void;
}

export const RequestKeyValueEditor: React.FC<RequestKeyValueEditorProps> = ({
  title,
  entries,
  kind,
  onChange,
}) => {
  const label = kind === 'header' ? 'Header' : 'Param';

  return (
    <section className="bg-brand-bg border border-brand-primary/30 rounded-lg p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold text-brand-text">{title}</h4>
        <button
          onClick={() =>
            onChange([...entries, { id: crypto.randomUUID(), key: '', value: '', enabled: true }])
          }
          className="flex items-center gap-1 text-xs text-brand-secondary hover:text-brand-secondary/80"
        >
          <PlusIcon className="w-4 h-4" /> Add {label}
        </button>
      </div>

      <div className="space-y-2">
        {entries.length === 0 && (
          <p className="text-xs text-brand-subtle">No {label.toLowerCase()}s configured.</p>
        )}
        {entries.map((entry, index) => (
          <div key={entry.id} className="grid grid-cols-12 gap-2 items-center">
            <input
              type="text"
              placeholder={`${label} Key`}
              value={entry.key}
              onChange={(e) => {
                const updated = [...entries];
                updated[index].key = e.target.value;
                onChange(updated);
              }}
              className="col-span-5 bg-black/40 border border-brand-primary/40 rounded px-2 py-2 text-sm text-brand-text"
            />
            <input
              type="text"
              placeholder={`${label} Value`}
              value={entry.value}
              onChange={(e) => {
                const updated = [...entries];
                updated[index].value = e.target.value;
                onChange(updated);
              }}
              className="col-span-6 bg-black/40 border border-brand-primary/40 rounded px-2 py-2 text-sm text-brand-text"
            />
            <button
              onClick={() => onChange(entries.filter((_, i) => i !== index))}
              className="col-span-1 text-brand-subtle hover:text-red-400 flex items-center justify-center"
            >
              <TrashIcon />
            </button>
          </div>
        ))}
      </div>
    </section>
  );
};

