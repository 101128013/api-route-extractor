import React from 'react';
import type { RequestBodyMode, FormDataEntry, KeyValuePair } from '../../types';
import { PlusIcon, TrashIcon } from '../icons';

interface RequestBodyModePickerProps {
  mode: RequestBodyMode;
  rawBody: string;
  formData: FormDataEntry[];
  urlEncoded: KeyValuePair[];
  onModeChange: (mode: RequestBodyMode) => void;
  onRawBodyChange: (body: string) => void;
  onFormDataChange: (entries: FormDataEntry[]) => void;
  onUrlEncodedChange: (entries: KeyValuePair[]) => void;
}

const BODY_MODES: { id: RequestBodyMode; label: string }[] = [
  { id: 'json', label: 'JSON' },
  { id: 'text', label: 'Text' },
  { id: 'form-data', label: 'Form-Data' },
  { id: 'urlencoded', label: 'x-www-form-urlencoded' },
  { id: 'binary', label: 'Binary' },
];

export const RequestBodyModePicker: React.FC<RequestBodyModePickerProps> = ({
  mode,
  rawBody,
  formData,
  urlEncoded,
  onModeChange,
  onRawBodyChange,
  onFormDataChange,
  onUrlEncodedChange,
}) => {
  const renderBodyEditor = () => {
    switch (mode) {
      case 'json':
      case 'text':
        return (
          <textarea
            value={rawBody}
            onChange={(e) => onRawBodyChange(e.target.value)}
            className="w-full h-48 bg-black/40 border border-brand-primary/40 rounded p-3 font-mono text-sm text-brand-text"
            placeholder={mode === 'json' ? '{\n  "key": "value"\n}' : 'Enter request body'}
          />
        );
      case 'form-data':
        return (
          <div className="space-y-2">
            {formData.map((entry, index) => (
              <div key={entry.id} className="grid grid-cols-12 gap-2">
                <select
                  value={entry.type}
                  onChange={(e) => {
                    const updated = [...formData];
                    updated[index].type = e.target.value as FormDataEntry['type'];
                    onFormDataChange(updated);
                  }}
                  className="col-span-2 bg-black/40 border border-brand-primary/40 rounded px-2 py-2 text-sm text-brand-text"
                >
                  <option value="text">Text</option>
                  <option value="file">File</option>
                </select>
                <input
                  placeholder="Key"
                  value={entry.key}
                  onChange={(e) => {
                    const updated = [...formData];
                    updated[index].key = e.target.value;
                    onFormDataChange(updated);
                  }}
                  className="col-span-4 bg-black/40 border border-brand-primary/40 rounded px-2 py-2 text-sm text-brand-text"
                />
                <input
                  placeholder={entry.type === 'file' ? 'File name' : 'Value'}
                  value={entry.value}
                  onChange={(e) => {
                    const updated = [...formData];
                    updated[index].value = e.target.value;
                    onFormDataChange(updated);
                  }}
                  className="col-span-5 bg-black/40 border border-brand-primary/40 rounded px-2 py-2 text-sm text-brand-text"
                />
                <button
                  onClick={() => onFormDataChange(formData.filter((_, i) => i !== index))}
                  className="col-span-1 text-brand-subtle hover:text-red-400 flex items-center justify-center"
                >
                  <TrashIcon />
                </button>
              </div>
            ))}
            <button
              onClick={() =>
                onFormDataChange([
                  ...formData,
                  { id: crypto.randomUUID(), key: '', value: '', type: 'text' },
                ])
              }
              className="flex items-center gap-2 text-sm text-brand-secondary hover:text-brand-secondary/80"
            >
              <PlusIcon /> Add Field
            </button>
          </div>
        );
      case 'urlencoded':
        return (
          <div className="space-y-2">
            {urlEncoded.map((entry, index) => (
              <div key={entry.id} className="grid grid-cols-12 gap-2">
                <input
                  placeholder="Key"
                  value={entry.key}
                  onChange={(e) => {
                    const updated = [...urlEncoded];
                    updated[index].key = e.target.value;
                    onUrlEncodedChange(updated);
                  }}
                  className="col-span-5 bg-black/40 border border-brand-primary/40 rounded px-2 py-2 text-sm text-brand-text"
                />
                <input
                  placeholder="Value"
                  value={entry.value}
                  onChange={(e) => {
                    const updated = [...urlEncoded];
                    updated[index].value = e.target.value;
                    onUrlEncodedChange(updated);
                  }}
                  className="col-span-6 bg-black/40 border border-brand-primary/40 rounded px-2 py-2 text-sm text-brand-text"
                />
                <button
                  onClick={() => onUrlEncodedChange(urlEncoded.filter((_, i) => i !== index))}
                  className="col-span-1 text-brand-subtle hover:text-red-400 flex items-center justify-center"
                >
                  <TrashIcon />
                </button>
              </div>
            ))}
            <button
              onClick={() =>
                onUrlEncodedChange([
                  ...urlEncoded,
                  { id: crypto.randomUUID(), key: '', value: '' },
                ])
              }
              className="flex items-center gap-2 text-sm text-brand-secondary hover:text-brand-secondary/80"
            >
              <PlusIcon /> Add Field
            </button>
          </div>
        );
      case 'binary':
        return (
          <div className="p-6 border border-dashed border-brand-primary/30 rounded text-center text-sm text-brand-subtle">
            Binary uploads are not supported in-browser yet. Paste base64 manually in other modes.
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <section className="bg-brand-bg border border-brand-primary/30 rounded-lg p-4 space-y-4">
      <div className="flex gap-2 flex-wrap">
        {BODY_MODES.map((bodyMode) => (
          <button
            key={bodyMode.id}
            onClick={() => onModeChange(bodyMode.id)}
            className={`px-3 py-1.5 rounded text-sm font-medium border ${
              mode === bodyMode.id
                ? 'bg-brand-primary text-white border-brand-primary'
                : 'bg-black/40 text-brand-subtle border-transparent hover:border-brand-primary/40'
            }`}
          >
            {bodyMode.label}
          </button>
        ))}
      </div>
      {renderBodyEditor()}
    </section>
  );
};

