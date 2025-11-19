
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
  isPredicted?: boolean;
  verificationStatus?: 'verified' | 'auth_required' | 'not_found' | 'unsafe' | 'found_in_docs' | 'unverified';
  authType?: 'none' | 'bearer' | 'basic' | 'apiKey' | 'oauth2' | 'cookie' | 'unknown';
  documentationUrl?: string;
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