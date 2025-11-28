
// List of CORS proxy providers. They are tried in order.
const proxies = [
    (url: string) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
    (url: string) => `https://corsproxy.io/?${encodeURIComponent(url)}`,
];

/**
 * Tries to fetch a URL using a series of CORS proxies.
 * @param url The URL to fetch.
 * @returns A promise that resolves to the response object.
 * @throws An error if all proxies fail.
 */
export const fetchWithProxies = async (url: string): Promise<Response> => {
    let lastError: Error | null = null;
    for (const proxy of proxies) {
        try {
            const response = await fetch(proxy(url));
            if (response.ok) {
                return response;
            }
            lastError = new Error(`Proxy failed with status: ${response.status}`);
        } catch (error) {
            lastError = error instanceof Error ? error : new Error(String(error));
        }
    }
    throw new Error(`All proxies failed. Last error: ${lastError?.message}`);
};

/**
 * Fetches the content of a URL and any linked scripts.
 */
export const fetchUrlContent = async (url: string): Promise<string> => {
    try {
        const response = await fetchWithProxies(url);
        const html = await response.text();
        
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        
        // Rewrite relative URLs to absolute
        const baseUrl = new URL(url);
        
        // Handle <base> tag if present
        const baseTag = doc.querySelector('base');
        const docBaseUrl = baseTag && baseTag.href ? new URL(baseTag.href, url) : baseUrl;

        const rewriteAttribute = (element: Element, attr: string) => {
            const value = element.getAttribute(attr);
            if (value && !value.startsWith('data:') && !value.startsWith('javascript:') && !value.startsWith('#')) {
                try {
                    element.setAttribute(attr, new URL(value, docBaseUrl.href).href);
                } catch (e) {
                    // Ignore invalid URLs
                }
            }
        };

        doc.querySelectorAll('[src]').forEach(el => rewriteAttribute(el, 'src'));
        doc.querySelectorAll('[href]').forEach(el => rewriteAttribute(el, 'href'));
        doc.querySelectorAll('[action]').forEach(el => rewriteAttribute(el, 'action'));

        const scripts = doc.querySelectorAll('script');
        
        const scriptPromises = Array.from(scripts).map(async (script) => {
          const src = script.getAttribute('src'); // Get raw attribute to avoid local resolution issues
          if (src) {
            try {
              const scriptUrl = new URL(src, docBaseUrl.href).href;
              const scriptResponse = await fetchWithProxies(scriptUrl);
              return await scriptResponse.text();
            } catch (e) {
              return `// Failed to fetch script: ${src}`;
            }
          }
          return script.textContent || '';
        });

        const scriptContents = await Promise.all(scriptPromises);
        
        // Filter out boilerplate scripts - prioritize unique application code
        const filteredScripts = scriptContents.filter((script, index) => {
            // Skip very small scripts (likely just config)
            if (script.length < 50) return false;
            
            // Skip scripts that are clearly libraries (check for common patterns)
            const lowerScript = script.toLowerCase();
            const isLibrary = 
                lowerScript.includes('jquery') && lowerScript.length > 1000 ||
                lowerScript.includes('lodash') ||
                lowerScript.includes('underscore') ||
                lowerScript.includes('bootstrap') && !lowerScript.includes('api') ||
                lowerScript.includes('polyfill') ||
                lowerScript.includes('shim') ||
                (lowerScript.includes('copyright') && lowerScript.length > 500);
            
            // Keep scripts with API-related content
            const hasApiContent = 
                script.includes('http') || 
                script.includes('api') || 
                script.includes('fetch') || 
                script.includes('ajax') ||
                script.includes('endpoint') ||
                script.includes('url') && script.length < 5000; // Reasonable size
            
            return !isLibrary || hasApiContent;
        });
        
        // Serialize the modified HTML
        const modifiedHtml = doc.documentElement.outerHTML;

        return `/* --- Fetched from URL: ${url} --- */\n\n${modifiedHtml}\n\n${filteredScripts.join('\n\n/* --- SCRIPT SEPARATOR --- */\n\n')}`;
    } catch (e) {
        console.error("Failed to fetch URL:", url, e);
        throw e;
    }
};

/**
 * Smartly crawls a list of candidate URLs.
 * Limits the number of pages to prevent abuse.
 */
export const smartCrawl = async (
    candidates: string[], 
    visited: Set<string>, 
    maxPages: number = 5,
    onLog?: (message: string) => void
): Promise<string[]> => {
    const uniqueCandidates = candidates.filter(url => !visited.has(url));
    const limitedCandidates = uniqueCandidates.slice(0, maxPages);
    
    const results: string[] = [];

    for (const url of limitedCandidates) {
        if (visited.has(url)) continue;
        visited.add(url);

        try {
            const msg = `Crawling: ${url}`;
            console.log(`[Crawler] ${msg}`);
            onLog?.(msg);
            
            const content = await fetchUrlContent(url);
            results.push(content);
        } catch (e) {
            const msg = `Failed to crawl ${url}`;
            console.warn(`[Crawler] ${msg}`, e);
            onLog?.(msg);
            results.push(`/* --- Failed to crawl: ${url} --- */`);
        }
    }

    return results;
};
