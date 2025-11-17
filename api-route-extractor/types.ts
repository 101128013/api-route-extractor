
export interface ApiEndpoint {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'OPTIONS' | 'HEAD' | 'UNKNOWN';
  path: string;
  description: string;
  details: string;
  example: {
    request: {
      curl: string;
      javascript: string;
      python: string;
      php: string;
      go: string;
    };
    response: string; // Example JSON response
  };
}

export interface HistoryItem {
  id: string;
  timestamp: number;
  source: string;
  inputMode: 'code' | 'url' | 'file';
  endpoints: ApiEndpoint[];
  analysisCode: string;
  originalInput: {
    inputText: string;
    urlInputs: string[];
    fileNames: string[];
  };
}