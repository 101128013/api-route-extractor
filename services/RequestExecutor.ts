import { AuthService } from './AuthService';
import type { ApiEndpoint, RequestDraft } from '../types';

export interface ExecuteRequestParams {
  method: ApiEndpoint['method'];
  url: string;
  headers?: Record<string, string>;
  body?: string;
  variables?: Record<string, string>;
  authConfigIds?: string[];
}

export interface ExecuteRequestResult {
  request: {
    method: ApiEndpoint['method'];
    url: string;
    headers: Record<string, string>;
    body?: string;
  };
  response?: {
    status: number;
    statusText: string;
    headers: Record<string, string>;
    body: string;
    duration: number;
  };
  error?: string;
}

const resolveVariables = (text: string, variables?: Record<string, string>) => {
  if (!text || !variables) return text;
  return Object.entries(variables).reduce(
    (acc, [key, value]) => acc.replace(new RegExp(`{{${key}}}`, 'g'), value),
    text
  );
};

export const executeRequest = async ({
  method,
  url,
  headers = {},
  body,
  variables,
  authConfigIds,
}: ExecuteRequestParams): Promise<ExecuteRequestResult> => {
  const startTime = Date.now();
  let finalUrl = url;
  let finalHeaders: Record<string, string> = { ...headers };
  let finalBody = body;

  try {
    let resolvedUrl = resolveVariables(url, variables);
    if (!resolvedUrl.startsWith('http')) {
      throw new Error(
        `Relative URL detected. Provide a full URL or use environment variables for base URLs.`
      );
    }

    let resolvedHeaders: Record<string, string> = {};
    Object.entries(headers).forEach(([key, value]) => {
      resolvedHeaders[key] = resolveVariables(value, variables);
    });

    let resolvedBody = body ? resolveVariables(body, variables) : undefined;

    // Apply auth configs
    const authConfigs = AuthService.getAuthConfigs().filter((config) => {
      if (!config.enabled) return false;
      if (!authConfigIds || authConfigIds.length === 0) return true;
      return authConfigIds.includes(config.id);
    });

    let currentRequest = { url: resolvedUrl, headers: resolvedHeaders, body: resolvedBody };
    for (const authConfig of authConfigs) {
      currentRequest = AuthService.applyAuthToRequest(authConfig, currentRequest);
    }
    resolvedUrl = currentRequest.url;
    resolvedHeaders = currentRequest.headers;
    resolvedBody = currentRequest.body;

    // Strip conflicting headers
    Object.keys(resolvedHeaders).forEach((key) => {
      if (key.toLowerCase() === 'content-length') {
        delete resolvedHeaders[key];
      }
    });

    finalUrl = resolvedUrl;
    finalHeaders = resolvedHeaders;
    finalBody = resolvedBody;

    const proxyUrl = `/proxy?url=${encodeURIComponent(finalUrl)}`;
    const response = await fetch(proxyUrl, {
      method,
      headers: finalHeaders,
      body: finalBody,
    });
    const duration = Date.now() - startTime;
    const responseText = await response.text();
    const responseHeaders: Record<string, string> = {};
    response.headers.forEach((value, key) => {
      responseHeaders[key] = value;
    });

    if (!response.ok) {
      const formatted = (() => {
        try {
          return JSON.stringify(JSON.parse(responseText), null, 2);
        } catch {
          return responseText;
        }
      })();
      throw new Error(`Status ${response.status}: ${formatted}`);
    }

    const requestSnapshot = {
      method,
      url: resolvedUrl,
      headers: resolvedHeaders,
      body: resolvedBody,
    };

    return {
      request: requestSnapshot,
      response: {
        status: response.status,
        statusText: response.statusText,
        headers: responseHeaders,
        body: responseText,
        duration,
      },
    };
  } catch (err) {
    const duration = Date.now() - startTime;
    const message = err instanceof Error ? err.message : 'Unknown error';
    return {
      request: {
        method,
        url: finalUrl,
        headers: finalHeaders,
        body: finalBody,
      },
      response: {
        status: 0,
        statusText: 'Error',
        headers: {},
        body: message,
        duration,
      },
      error: message,
    };
  }
};

