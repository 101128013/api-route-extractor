import React, { Component, ErrorInfo, ReactNode } from 'react';
import { ErrorIcon } from './icons';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center h-full p-8 text-center text-brand-text">
          <div className="text-red-500 mb-4">
            <ErrorIcon />
          </div>
          <h1 className="text-2xl font-bold mb-2">Something went wrong</h1>
          <p className="text-brand-subtle mb-6 max-w-md">
            The application encountered an unexpected error. Please try refreshing the page.
          </p>
          {this.state.error && (
            <div className="bg-brand-surface border border-brand-primary p-4 rounded-md text-left overflow-auto max-w-2xl w-full max-h-64 mb-6">
              <p className="font-mono text-xs text-red-400 whitespace-pre-wrap">
                {this.state.error.toString()}
              </p>
            </div>
          )}
          <button
            onClick={() => window.location.reload()}
            className="px-6 py-2 bg-brand-secondary text-white rounded-md hover:bg-brand-secondary/80 transition-colors"
          >
            Refresh Page
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
