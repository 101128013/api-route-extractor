import { ApiEndpoint } from '../types';
import { fetchWithProxies } from './CrawlerService';

export type VerificationStatus = 'verified' | 'auth_required' | 'not_found' | 'unsafe' | 'found_in_docs' | 'unverified';

/**
 * Verifies if an endpoint is valid by making a request or checking documentation.
 */
export const verifyEndpoint = async (
    endpoint: ApiEndpoint, 
    baseUrl: string | null,
    crawledContent: string
): Promise<VerificationStatus> => {
    if (!endpoint || !endpoint.method) {
        return 'unverified';
    }
    const method = endpoint.method.toUpperCase();
    
    // 1. Safety Check: Do not auto-test destructive methods
    if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(method)) {
        // Passive Verification: Check if the path appears in the crawled content (docs/code)
        // We strip the query params and IDs for a fuzzy match
        const cleanPath = endpoint.path.split('?')[0].replace(/\/\{.*?\}/g, ''); 
        if (crawledContent.includes(cleanPath)) {
            return 'found_in_docs';
        }
        return 'unsafe';
    }

    // 2. URL Construction
    let urlToTest = endpoint.path;
    if (!urlToTest.startsWith('http')) {
        if (!baseUrl) {
            return 'unverified'; // Cannot test relative path without base URL
        }
        // Ensure no double slashes
        const base = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
        const path = endpoint.path.startsWith('/') ? endpoint.path : `/${endpoint.path}`;
        urlToTest = `${base}${path}`;
    }

    // 3. Active Verification
    try {
        // We use a simple GET (or HEAD if we could, but proxies might not support it well)
        // We'll try to fetch just a bit of data to see if it responds
        const response = await fetchWithProxies(urlToTest);
        
        if (response.ok) {
            return 'verified';
        } else if (response.status === 401 || response.status === 403) {
            return 'auth_required';
        } else if (response.status === 404) {
            return 'not_found';
        } else {
            return 'unverified'; // Other errors (500, etc)
        }
    } catch (e) {
        // If fetch fails (network error, CORS blocked even with proxy), we can't be sure
        return 'unverified';
    }
};
