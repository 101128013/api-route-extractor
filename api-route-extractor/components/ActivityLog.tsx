import React, { useEffect, useRef } from 'react';
import { CheckCircleIcon, ExclamationTriangleIcon, InformationCircleIcon, SparklesIcon, XCircleIcon } from './icons';

export type LogType = 'info' | 'success' | 'warning' | 'error' | 'ai';

export interface LogEntry {
  id: string;
  timestamp: number;
  message: string;
  type: LogType;
}

interface ActivityLogProps {
  logs: LogEntry[];
}

export const ActivityLog: React.FC<ActivityLogProps> = ({ logs }) => {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  if (logs.length === 0) return null;

  return (
    <div className="flex flex-col h-full bg-gray-900 rounded-lg border border-gray-800 overflow-hidden font-mono text-xs">
      <div className="bg-gray-800 px-3 py-1 text-gray-400 flex items-center gap-2 border-b border-gray-700">
        <div className="w-2 h-2 rounded-full bg-red-500" />
        <div className="w-2 h-2 rounded-full bg-yellow-500" />
        <div className="w-2 h-2 rounded-full bg-green-500" />
        <span className="ml-2">Activity Log</span>
      </div>
      <div className="flex-grow overflow-y-auto p-3 space-y-2 custom-scrollbar">
        {logs.map((log) => (
          <div key={log.id} className="flex items-start gap-2 animate-fade-in">
            <span className="text-gray-500 flex-shrink-0 mt-0.5">
              {new Date(log.timestamp).toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </span>
            <div className="flex-shrink-0 mt-0.5">
                {log.type === 'info' && <InformationCircleIcon className="w-3 h-3 text-blue-400" />}
                {log.type === 'success' && <CheckCircleIcon className="w-3 h-3 text-green-400" />}
                {log.type === 'warning' && <ExclamationTriangleIcon className="w-3 h-3 text-yellow-400" />}
                {log.type === 'error' && <XCircleIcon className="w-3 h-3 text-red-400" />}
                {log.type === 'ai' && <SparklesIcon className="w-3 h-3 text-purple-400" />}
            </div>
            <span className={`break-all ${
                log.type === 'info' ? 'text-gray-300' :
                log.type === 'success' ? 'text-green-300' :
                log.type === 'warning' ? 'text-yellow-300' :
                log.type === 'error' ? 'text-red-300' :
                'text-purple-300'
            }`}>
              {log.message}
            </span>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
    </div>
  );
};
