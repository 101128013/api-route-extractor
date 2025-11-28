
export interface ParsedRequest {
    method: string;
    url: string;
    headers: Record<string, string>;
    body?: string;
}

export const parseCurlCommand = (curl: string): ParsedRequest => {
    const result: ParsedRequest = {
        method: 'GET',
        headers: {},
        body: undefined,
        url: ''
    };

    // Extract URL
    // Look for http/https or relative paths starting with /
    const urlMatch = curl.match(/(?:['"])((?:https?:\/\/|\/)[^'"]+)(?:['"])/);
    if (urlMatch) {
        result.url = urlMatch[1];
    } else {
         // Look for unquoted URLs (http/https or /path)
         // We exclude tokens starting with - (flags)
         const tokens = curl.split(/\s+/);
         for (const token of tokens) {
             if ((token.startsWith('http') || token.startsWith('/')) && !token.startsWith('-')) {
                 result.url = token;
                 break;
             }
         }
    }

    // Extract method
    const methodMatch = curl.match(/-X\s+([A-Z]+)|--request\s+([A-Z]+)/);
    if (methodMatch) {
        result.method = (methodMatch[1] || methodMatch[2] || 'GET').toUpperCase();
    }

    // Extract headers
    const headerRegex = /-H\s+'([^']*)'|-H\s+"([^"]*)"/g;
    let headerMatch;
    while ((headerMatch = headerRegex.exec(curl)) !== null) {
        const header = headerMatch[1] || headerMatch[2];
        const [key, ...valueParts] = header.split(':');
        if (key && valueParts.length > 0) {
            result.headers[key.trim()] = valueParts.join(':').trim();
        }
    }

    // Extract body
    const dataMatch = curl.match(/-d\s+'([^']*)'|--data\s+'([^']*)'|-d\s+"([^"]*)"|--data\s+"([^"]*)"/);
    if (dataMatch) {
        result.body = dataMatch[1] || dataMatch[2] || dataMatch[3] || dataMatch[4];
    }

    return result;
};
