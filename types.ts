
export interface ApiEndpoint {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'OPTIONS' | 'HEAD' | 'UNKNOWN';
  path: string;
  description: string;
  details: string;
  example: {
    request: {
      curl: string;
    };
    response: string; // Example JSON response
  };
  isPredicted?: boolean;
  verificationStatus?: 'verified' | 'auth_required' | 'not_found' | 'unsafe' | 'found_in_docs' | 'unverified';
  authType?: 'none' | 'bearer' | 'basic' | 'apiKey' | 'oauth2' | 'cookie' | 'unknown';
  documentationUrl?: string;
  collectionId?: string;
  folderId?: string;
  workspaceId?: string;
  id?: string; // Unique identifier for endpoint
}

export type RequestBodyMode = 'json' | 'text' | 'form-data' | 'urlencoded' | 'binary';

export interface KeyValuePair {
  id: string;
  key: string;
  value: string;
  enabled?: boolean;
  description?: string;
}

export interface FormDataEntry extends KeyValuePair {
  type: 'text' | 'file';
  fileName?: string;
  fileSize?: number;
  mimeType?: string;
  base64?: string;
}

export interface RequestDraft {
  id: string;
  name?: string;
  endpointId?: string;
  method: ApiEndpoint['method'];
  url: string;
  params: KeyValuePair[];
  headers: KeyValuePair[];
  bodyMode: RequestBodyMode;
  rawBody?: string;
  formData?: FormDataEntry[];
  urlEncoded?: KeyValuePair[];
  binaryPayload?: {
    fileName?: string;
    mimeType?: string;
    size?: number;
    base64?: string;
  };
  authConfigIds: string[];
  preRequestScript?: string;
  description?: string;
  createdAt: number;
  updatedAt: number;
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

// Collections & Workspaces
export interface Collection {
  id: string;
  name: string;
  description?: string;
  endpointIds: string[];
  folders: Folder[];
  tags: string[];
  createdAt: number;
  updatedAt: number;
  color?: string;
}

export interface Folder {
  id: string;
  name: string;
  endpointIds: string[];
  parentId?: string;
}

export interface Workspace {
  id: string;
  name: string;
  description?: string;
  collectionIds: string[];
  environmentIds: string[];
  activeEnvironmentId: string | null;
  createdAt: number;
  updatedAt: number;
}

// Request/Response History
export interface RequestHistoryItem {
  id: string;
  endpointId: string;
  collectionId?: string;
  timestamp: number;
  request: {
    method: string;
    url: string;
    headers: Record<string, string>;
    body?: string;
  };
  response: {
    status: number;
    statusText: string;
    headers: Record<string, string>;
    body: string;
    duration: number; // ms
  };
  environmentId?: string;
  success: boolean;
  error?: string;
  testResults?: TestResult[];
}

// Advanced Authentication
export interface AuthConfig {
  id: string;
  name: string;
  type: 'bearer' | 'oauth2' | 'apiKey' | 'basic' | 'digest' | 'custom';
  // Bearer
  token?: string;
  tokenUrl?: string;
  refreshToken?: string;
  expiresAt?: number;
  // OAuth2
  oauth2?: {
    flow: 'authorization_code' | 'client_credentials' | 'implicit';
    authorizationUrl: string;
    tokenUrl: string;
    clientId: string;
    clientSecret?: string;
    scopes: string[];
    redirectUri: string;
    accessToken?: string;
    refreshToken?: string;
    expiresAt?: number;
  };
  // API Key
  apiKey?: {
    location: 'header' | 'query' | 'cookie';
    name: string;
    value: string;
  };
  // Basic
  basic?: {
    username: string;
    password: string;
  };
  // Custom script
  customScript?: string;
  environmentId?: string;
  enabled: boolean;
}

// Response Validation & Testing
export interface Test {
  id: string;
  name: string;
  endpointId?: string;
  assertions: Assertion[];
  script?: string; // JavaScript
  enabled: boolean;
}

export interface Assertion {
  id: string;
  type: 'status' | 'header' | 'body' | 'responseTime' | 'custom';
  expected: any;
  operator?: 'equals' | 'contains' | 'matches' | 'greaterThan' | 'lessThan' | 'notEquals';
  path?: string; // JSON path for body assertions
  property?: string; // Header name or property name
  description?: string;
}

export interface TestResult {
  testId: string;
  testName: string;
  passed: boolean;
  assertions: AssertionResult[];
  error?: string;
  duration: number;
}

export interface AssertionResult {
  assertionId: string;
  passed: boolean;
  expected: any;
  actual: any;
  error?: string;
}