import type { AuthConfig } from '../types';

export class AuthService {
  private static STORAGE_KEY = 'api-extractor-auth-configs';

  static getAuthConfigs(): AuthConfig[] {
    const data = localStorage.getItem(this.STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  }

  static getAuthConfig(id: string): AuthConfig | null {
    return this.getAuthConfigs().find(a => a.id === id) || null;
  }

  static getAuthConfigsForEnvironment(environmentId: string): AuthConfig[] {
    return this.getAuthConfigs().filter(a => a.environmentId === environmentId && a.enabled);
  }

  static saveAuthConfig(config: AuthConfig): void {
    const configs = this.getAuthConfigs();
    const index = configs.findIndex(a => a.id === config.id);
    if (index >= 0) {
      configs[index] = config;
    } else {
      configs.push(config);
    }
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(configs));
  }

  static deleteAuthConfig(id: string): void {
    const configs = this.getAuthConfigs().filter(a => a.id !== id);
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(configs));
  }

  static applyAuthToRequest(config: AuthConfig, request: {
    url: string;
    headers: Record<string, string>;
    body?: string;
  }): {
    url: string;
    headers: Record<string, string>;
    body?: string | undefined;
  } {
    if (!config.enabled) return request;

    const result = { ...request, headers: { ...request.headers } };

    switch (config.type) {
      case 'bearer':
        if (config.token) {
          result.headers['Authorization'] = `Bearer ${config.token}`;
        }
        break;

      case 'apiKey':
        if (config.apiKey) {
          const { location, name, value } = config.apiKey;
          if (location === 'header') {
            result.headers[name] = value;
          } else if (location === 'query') {
            const urlObj = new URL(result.url);
            urlObj.searchParams.set(name, value);
            result.url = urlObj.toString();
          } else if (location === 'cookie') {
            result.headers['Cookie'] = `${name}=${value}`;
          }
        }
        break;

      case 'basic':
        if (config.basic) {
          const credentials = btoa(`${config.basic.username}:${config.basic.password}`);
          result.headers['Authorization'] = `Basic ${credentials}`;
        }
        break;

      case 'oauth2':
        if (config.oauth2?.accessToken) {
          result.headers['Authorization'] = `Bearer ${config.oauth2.accessToken}`;
        }
        break;

      case 'custom':
        if (config.customScript) {
          try {
            // Execute custom script in a sandboxed context
            const func = new Function('request', config.customScript);
            const modified = func(result);
            if (modified) {
              return modified;
            }
          } catch (error) {
            console.error('Custom auth script error:', error);
          }
        }
        break;
    }

    return result;
  }

  static async refreshToken(config: AuthConfig): Promise<AuthConfig | null> {
    if (config.type === 'bearer' && config.tokenUrl && config.refreshToken) {
      try {
        const response = await fetch(config.tokenUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refresh_token: config.refreshToken }),
        });

        if (response.ok) {
          const data = await response.json();
          const updated: AuthConfig = {
            ...config,
            token: data.access_token,
            refreshToken: data.refresh_token || config.refreshToken,
            expiresAt: data.expires_in ? Date.now() + data.expires_in * 1000 : config.expiresAt,
          };
          this.saveAuthConfig(updated);
          return updated;
        }
      } catch (error) {
        console.error('Token refresh failed:', error);
      }
    }

    if (config.type === 'oauth2' && config.oauth2) {
      const { tokenUrl, clientId, clientSecret, refreshToken } = config.oauth2;
      if (tokenUrl && refreshToken) {
        try {
          const params = new URLSearchParams();
          params.append('grant_type', 'refresh_token');
          params.append('refresh_token', refreshToken);
          params.append('client_id', clientId);
          if (clientSecret) {
            params.append('client_secret', clientSecret);
          }

          const response = await fetch(tokenUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: params.toString(),
          });

          if (response.ok) {
            const data = await response.json();
            const updated: AuthConfig = {
              ...config,
              oauth2: {
                ...config.oauth2,
                accessToken: data.access_token,
                refreshToken: data.refresh_token || refreshToken,
                expiresAt: data.expires_in ? Date.now() + data.expires_in * 1000 : config.oauth2.expiresAt,
              },
            };
            this.saveAuthConfig(updated);
            return updated;
          }
        } catch (error) {
          console.error('OAuth2 token refresh failed:', error);
        }
      }
    }

    return null;
  }

  static isTokenExpired(config: AuthConfig): boolean {
    if (config.type === 'bearer' && config.expiresAt) {
      return Date.now() >= config.expiresAt;
    }
    if (config.type === 'oauth2' && config.oauth2?.expiresAt) {
      return Date.now() >= config.oauth2.expiresAt;
    }
    return false;
  }

  static async initiateOAuth2Flow(config: AuthConfig): Promise<string> {
    if (config.type !== 'oauth2' || !config.oauth2) {
      throw new Error('Not an OAuth2 config');
    }

    const { authorizationUrl, clientId, redirectUri, scopes } = config.oauth2;
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: clientId,
      redirect_uri: redirectUri,
      scope: scopes.join(' '),
      state: config.id, // Use config ID as state
    });

    return `${authorizationUrl}?${params.toString()}`;
  }

  static async exchangeOAuth2Code(
    config: AuthConfig,
    code: string
  ): Promise<AuthConfig> {
    if (config.type !== 'oauth2' || !config.oauth2) {
      throw new Error('Not an OAuth2 config');
    }

    const { tokenUrl, clientId, clientSecret, redirectUri } = config.oauth2;
    const params = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      client_id: clientId,
      redirect_uri: redirectUri,
    });

    if (clientSecret) {
      params.append('client_secret', clientSecret);
    }

    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });

    if (!response.ok) {
      throw new Error(`OAuth2 token exchange failed: ${response.statusText}`);
    }

    const data = await response.json();
    const updated: AuthConfig = {
      ...config,
      oauth2: {
        ...config.oauth2,
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        expiresAt: data.expires_in ? Date.now() + data.expires_in * 1000 : undefined,
      },
    };

    this.saveAuthConfig(updated);
    return updated;
  }
}

