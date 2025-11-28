import React, { useMemo } from 'react';
import type { RequestDraft } from '../../types';

interface RequestCodePreviewProps {
  draft: RequestDraft;
}

const escapeShell = (value: string) => value.replace(/'/g, `'\\''`);

export const RequestCodePreview: React.FC<RequestCodePreviewProps> = ({ draft }) => {
  const curlCommand = useMemo(() => {
    const lines = [`curl -X ${draft.method} '${draft.url}'`];

    draft.headers.forEach((header) => {
      if (!header.key || !header.value) return;
      lines.push(`  -H '${header.key}: ${escapeShell(header.value)}'`);
    });

    if (draft.rawBody) {
      lines.push(`  -d '${escapeShell(draft.rawBody)}'`);
    }

    return lines.join(' \\\n');
  }, [draft.method, draft.url, draft.headers, draft.rawBody]);

  return (
    <section className="bg-brand-bg border border-brand-primary/30 rounded-lg p-4 space-y-3">
      <div className="flex justify-between items-center">
        <h4 className="text-sm font-semibold text-brand-text">Generated cURL</h4>
        <button
          onClick={() => navigator.clipboard.writeText(curlCommand)}
          className="text-xs text-brand-secondary hover:text-brand-secondary/80"
        >
          Copy
        </button>
      </div>
      <pre className="bg-black/40 rounded p-3 text-xs whitespace-pre-wrap break-all">{curlCommand}</pre>
    </section>
  );
};

