

import { GoogleGenAI, Type, Chat } from "@google/genai";
import type { ApiEndpoint } from '../types';

const getLocalStorage = (key: string) => {
    const item = localStorage.getItem(key);
    return item ? item.replace(/^"|"$/g, '') : null;
};

const getProvider = () => getLocalStorage('ai-provider') || 'gemini';

const getGenAIClient = () => {
    const apiKey = getLocalStorage('gemini-api-key') || process.env.API_KEY;
    if (!apiKey) {
        throw new Error("Gemini API Key is missing. Please set it in the Settings.");
    }
    return new GoogleGenAI({ apiKey });
};

// Pricing for Gemini 2.5 Flash Lite
// Input: $0.10 / 1M tokens
// Output: $0.40 / 1M tokens
const PRICING = {
    input: 0.10 / 1000000,
    output: 0.40 / 1000000
};

const calculateCost = (usage: { promptTokenCount?: number, candidatesTokenCount?: number }): number => {
    if (!usage) return 0;
    const inputCost = (usage.promptTokenCount || 0) * PRICING.input;
    const outputCost = (usage.candidatesTokenCount || 0) * PRICING.output;
    return inputCost + outputCost;
};

const callOpenAI = async (systemPrompt: string, userPrompt: string, jsonMode: boolean = false): Promise<string> => {
    const baseUrl = getLocalStorage('openai-base-url') || 'http://localhost:1234/v1';
    const model = getLocalStorage('openai-model') || 'gpt-3.5-turbo';
    const apiKey = getLocalStorage('openai-api-key') || 'not-needed';

    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
    };

    const body = {
        model: model,
        messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
        ],
        temperature: 0.1,
        // Removed response_format to maximize compatibility with local servers (like LM Studio) 
        // that might not support 'json_object' or require 'json_schema'.
        // We rely on the system prompt to enforce JSON.
    };

    try {
        const response = await fetch(`${baseUrl}/chat/completions`, {
            method: 'POST',
            headers,
            body: JSON.stringify(body)
        });

        if (!response.ok) {
            const errText = await response.text();
            throw new Error(`OpenAI/Local API Error (${response.status}): ${errText}`);
        }

        const data = await response.json();
        // Local models might not return usage data reliably, but if they do:
        // const cost = calculateCost({ promptTokenCount: data.usage?.prompt_tokens, candidatesTokenCount: data.usage?.completion_tokens });
        // For now, we assume local is free ($0).
        return data.choices[0].message.content;
    } catch (error) {
        console.error("Error calling OpenAI/Local API:", error);
        throw error;
    }
};

const responseSchema = {
  type: Type.OBJECT,
  properties: {
    explicitEndpoints: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          method: { type: Type.STRING, enum: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS', 'HEAD', 'UNKNOWN'] },
          path: { type: Type.STRING },
          description: { type: Type.STRING },
          details: { type: Type.STRING },
          authType: { type: Type.STRING, enum: ['none', 'bearer', 'basic', 'apiKey', 'oauth2', 'cookie', 'unknown'], description: "Inferred authentication method required for this endpoint." },
          documentationUrl: { type: Type.STRING, description: "URL to official documentation for this specific endpoint if found." },
          example: {
            type: Type.OBJECT,
            properties: {
              request: {
                type: Type.OBJECT,
                properties: {
                  curl: { type: Type.STRING },
                },
                required: ["curl"],
              },
              response: { type: Type.STRING },
            },
            required: ["request", "response"],
          },
        },
        required: ["method", "path", "description", "details", "example"],
      },
    },
    predictedEndpoints: {
      type: Type.ARRAY,
      description: "Hypothetical endpoints guessed based on the domain model (e.g., if /users exists, predict /users/{id}).",
      items: {
        type: Type.OBJECT,
        properties: {
          method: { type: Type.STRING, enum: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS', 'HEAD', 'UNKNOWN'] },
          path: { type: Type.STRING },
          description: { type: Type.STRING },
          details: { type: Type.STRING },
          authType: { type: Type.STRING, enum: ['none', 'bearer', 'basic', 'apiKey', 'oauth2', 'cookie', 'unknown'] },
          example: {
            type: Type.OBJECT,
            properties: {
              request: {
                type: Type.OBJECT,
                properties: {
                  curl: { type: Type.STRING },
                },
                required: ["curl"],
              },
              response: { type: Type.STRING },
            },
            required: ["request", "response"],
          },
        },
        required: ["method", "path", "description", "details", "example"],
      },
    },
    crawlingCandidates: {
      type: Type.ARRAY,
      description: "List of full URLs found in the content that likely contain API documentation, specifications, or further API usage examples.",
      items: { type: Type.STRING },
    },
  },
  required: ["explicitEndpoints", "predictedEndpoints", "crawlingCandidates"],
};

// Helper function to filter out boilerplate JavaScript code
const filterBoilerplateCode = (code: string): string => {
  const lines = code.split('\n');
  const filtered: string[] = [];
  let inBoilerplate = false;
  let skipCount = 0;
  
  // Common boilerplate patterns to skip
  const boilerplatePatterns = [
    /^\/\*[\s\S]*?jQuery|jquery|prototype|mootools|dojo|yui/i,
    /^\/\*[\s\S]*?minified|minified|compressed/i,
    /^\/\*[\s\S]*?library|framework|polyfill/i,
    /function\s+\$?\w*\s*\([^)]*\)\s*\{[\s\S]{0,50}\}\s*\(/i, // IIFE patterns
    /\/\*\s*[\s\S]{0,100}Copyright[\s\S]{0,200}\*\//i, // Copyright headers
  ];
  
  // Common library names to filter
  const libraryNames = [
    'jquery', 'lodash', 'underscore', 'moment', 'axios', 'fetch',
    'bootstrap', 'angular', 'react', 'vue', 'backbone', 'ember',
    'prototype', 'mootools', 'dojo', 'yui', 'extjs', 'sencha',
    'modernizr', 'polyfill', 'shim', 'core-js', 'babel',
  ];
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lowerLine = line.toLowerCase();
    
    // Skip if it's clearly a library file
    if (libraryNames.some(lib => lowerLine.includes(lib) && (lowerLine.includes('library') || lowerLine.includes('framework')))) {
      skipCount++;
      if (skipCount > 10) continue; // Skip large library blocks
    } else {
      skipCount = 0;
    }
    
    // Skip very long minified lines (likely boilerplate)
    if (line.length > 500 && !line.includes('http') && !line.includes('api') && !line.includes('/')) {
      continue;
    }
    
    // Keep lines with API-related content
    if (line.includes('http') || line.includes('api') || line.includes('/') || 
        line.includes('fetch') || line.includes('ajax') || line.includes('xhr') ||
        line.includes('endpoint') || line.includes('route') || line.includes('url')) {
      filtered.push(line);
      continue;
    }
    
    // Keep form actions, hrefs, and other interesting patterns
    if (line.includes('action=') || line.includes('href=') || line.includes('src=') ||
        line.includes('data-url') || line.includes('data-endpoint') || line.includes('data-api')) {
      filtered.push(line);
      continue;
    }
    
    // Keep JSF patterns
    if (line.includes('javax.faces') || line.includes('jsf.ajax') || line.includes('myfaces')) {
      filtered.push(line);
      continue;
    }
    
    // Keep comments that might have useful info
    if (line.trim().startsWith('//') && (line.includes('api') || line.includes('endpoint') || line.includes('url'))) {
      filtered.push(line);
      continue;
    }
    
    // For very large files, be more selective
    if (lines.length > 1000 && filtered.length > 500) {
      // Only keep lines with interesting patterns
      if (!line.match(/[a-zA-Z]{3,}/)) continue; // Skip lines with mostly symbols
    } else {
      filtered.push(line);
    }
  }
  
  return filtered.join('\n');
};

const extractionPrompt = `
You are an expert reverse engineer and security analyst. Your task is to analyze the provided content (source code, HTML, or text) to discover API routes and endpoints.

**IMPORTANT: Focus on UNIQUE and INTERESTING endpoints. Filter out generic boilerplate code patterns.**

**CRITICAL INSTRUCTIONS:**
1. **IGNORE BOILERPLATE**: Skip common JavaScript libraries (jQuery, lodash, React internals, etc.) unless they contain custom API calls
2. **FOCUS ON UNIQUE CODE**: Prioritize custom application code over third-party libraries
3. **COMPLETE JSON OUTPUT**: You MUST return a complete, valid JSON object. Do not truncate your response.
4. **VALIDATE JSON**: Before returning, ensure your JSON is complete and parseable.

**Objectives:**
1.  **Find ALL Explicit Routes**: Identify EVERY API route, endpoint, or server interaction in the code. Leave nothing out. This includes:
    *   REST API endpoints (e.g., \`/api/users\`, \`/v1/products\`, \`/api/v2/orders\`)
    *   GraphQL endpoints (\`/graphql\`, \`/api/graphql\`)
    *   **Form Actions**: EVERY HTML form \`action\` attribute, even if it's just \`/\` or \`#\`
    *   **AJAX/Fetch Calls**: EVERY \`fetch()\`, \`XMLHttpRequest\`, \`$.ajax()\`, \`axios()\` call
    *   **JavaServer Faces (JSF)**: ALL JSF form submissions, \`javax.faces.resource\` endpoints, AJAX calls via \`jsf.ajax.request\`, \`myfaces.oam.submitForm\`, etc.
    *   **WebSocket endpoints** (\`ws://\`, \`wss://\`)
    *   **Server-sent events** (\`/events\`, \`/stream\`)
    *   **Image/File Upload endpoints**
    *   **Download endpoints**
    *   **Redirect endpoints**
    *   **Callback URLs**
    *   **Webhook URLs**
    *   **OAuth/SAML endpoints**
    *   **Health check endpoints** (\`/health\`, \`/ping\`, \`/status\`)
    *   **Metrics endpoints** (\`/metrics\`, \`/stats\`)
    *   **Admin endpoints** (\`/admin/*\`)
    *   **Debug endpoints** (\`/debug/*\`)
    *   **ANY URL mentioned in JavaScript, HTML, or code comments**
    *   **ANY path in \`href\`, \`src\`, \`action\`, \`data-url\`, or custom attributes**
    *   **ANY endpoint pattern you can infer from variable names, function names, or code structure**

2.  **Predict Routes Aggressively**: Based on the "Explicit Routes" and ANY domain logic, entity names, or patterns you observe, **predict 50-100 likely API routes**. Be extremely aggressive:
    *   For EVERY entity/resource you see (User, Product, Order, Payment, etc.), predict full CRUD operations
    *   For EVERY form, predict submission, validation, and error endpoints
    *   For EVERY authentication flow, predict login, logout, register, reset password, verify email, etc.
    *   For EVERY admin feature, predict list, create, update, delete, search, export, import endpoints
    *   Predict versioned endpoints (\`/v1/*\`, \`/v2/*\`, \`/api/v1/*\`)
    *   Predict common patterns like \`/search\`, \`/filter\`, \`/export\`, \`/import\`, \`/batch\`

3.  **Identify ALL Crawl Targets**: Return EVERY link that might contain more API information:
    *   API Docs, Swagger, OpenAPI, Postman collections
    *   Developer portals, documentation sites
    *   GitHub repos, source code links
    *   Admin panels, dashboards
    *   ANY link that looks like it might have technical information

4.  **Infer Authentication**: For each endpoint, infer the authentication type based on ANY clues.

5.  **Find Documentation**: Include ANY documentation links you find.

**Special Instructions:**
*   **JSF/JavaServer Faces**: Extract EVERY form submission, EVERY AJAX call, EVERY resource endpoint
*   **Single Page Apps**: Extract EVERY fetch/axios call, EVERY API route from routing config
*   **Traditional Apps**: Extract EVERY form action, EVERY link, EVERY AJAX call
*   **Look in Comments**: Check code comments for API documentation or endpoint lists
*   **Look in Configuration**: Check for API base URLs, endpoint configurations, route definitions
*   **Look in Error Messages**: Error messages often reveal endpoint paths

**Guidelines:**
*   **FOCUS ON UNIQUE ENDPOINTS**: Prioritize application-specific endpoints over generic library code
*   **FILTER BOILERPLATE**: Skip common patterns like jQuery event handlers, React internals, polyfills
*   **QUALITY OVER QUANTITY**: Return meaningful endpoints that are actually used by the application
*   **Include Application Code**: Forms, AJAX, fetch, XMLHttpRequest, WebSockets, redirects, downloads, uploads from the APPLICATION
*   **Ignore**: 
    - Generic library code (jQuery, lodash, etc.) unless it contains custom API calls
    - Minified/compressed code that's just library code
    - Standard polyfills and shims
    - .png, .jpg, .gif, .css, .woff, .ttf, .svg files UNLESS they require authentication or are dynamically generated

**Output Format:**
You MUST return a COMPLETE, VALID JSON object. Ensure the JSON is properly closed with all brackets and braces:
{
  "explicitEndpoints": [ ... ],  // Application-specific endpoints (not boilerplate)
  "predictedEndpoints": [ ... ], // 20-50 predicted endpoints based on application logic
  "crawlingCandidates": [ ... ]  // Documentation/API links that might have more info
}

**CRITICAL**: 
- Your JSON MUST be complete and valid
- Do NOT truncate the response
- Ensure all arrays and objects are properly closed
- If the response is too long, prioritize the most important endpoints first
`;

export interface ExtractionResult {
    explicitEndpoints: ApiEndpoint[];
    predictedEndpoints: ApiEndpoint[];
    crawlingCandidates: string[];
}

export const beautifyCode = async (code: string, onCostUpdate?: (cost: number) => void): Promise<string> => {
  const provider = getProvider();
  const prompt = `
You are a code formatter. Your task is to take the following code snippet (which might be minified, obfuscated, or poorly formatted) and make it readable by beautifying it.
- Add standard indentation.
- Add line breaks where appropriate.
- Do not add comments or change the logic.
- If the input is not recognizable as code (e.g., HTML, plain text), return it as is.

Return ONLY the formatted code, without any surrounding text or markdown fences.

Code to format:
\`\`\`
${code}
\`\`\`
`;

  try {
    let responseText = '';
    if (provider === 'gemini') {
        const ai = getGenAIClient();
        const response = await ai.models.generateContent({
            model: "gemini-2.0-flash-exp",
            contents: prompt,
        });
        if (response.usageMetadata && onCostUpdate) {
            onCostUpdate(calculateCost(response.usageMetadata));
        }
        responseText = response.text.trim();
    } else {
        responseText = await callOpenAI("You are a code formatter.", prompt);
    }

    const cleanedText = responseText.replace(/^```(javascript|js)?\n/i, '').replace(/\n```$/, '');
    return cleanedText;
  } catch (error) {
    console.error("Error beautifying code:", error);
    return code; 
  }
};

export const analyzeApiCall = async (requestCurl: string, responseData: string, onCostUpdate?: (cost: number) => void): Promise<string> => {
  const provider = getProvider();
  const prompt = `
You are an expert API debugger. A user executed a cURL command and received a response. Your task is to analyze both and provide a helpful diagnosis.

**Request Details:**
- **cURL Command:** \`${requestCurl}\`

**Response Received:**
\`\`\`
${responseData}
\`\`\`

---

**Your Analysis:**

1.  **Summary:** Briefly summarize the outcome (e.g., "Successful data retrieval," "Client-side error," "Server-side error").
2.  **Explanation:** Explain what happened. If it was an error, what is the likely cause based on the status code, headers, and response body? (e.g., "A 401 Unauthorized error suggests the API key is missing or invalid."). If it was a success, what does the data represent?
3.  **Suggested Fix (if applicable):** If there was an error, provide a corrected cURL command. Explain exactly what you changed and why. If no fix is needed, state that the request was successful.

Provide your response in clear, easy-to-understand markdown format.
`;

  try {
    if (provider === 'gemini') {
        const ai = getGenAIClient();
        const response = await ai.models.generateContent({
            model: "gemini-2.0-flash-exp",
            contents: prompt,
        });
        if (response.usageMetadata && onCostUpdate) {
            onCostUpdate(calculateCost(response.usageMetadata));
        }
        return response.text.trim();
    } else {
        return await callOpenAI("You are an expert API debugger.", prompt);
    }
  } catch (error) {
    console.error("Error analyzing API call:", error);
    throw new Error("Failed to get analysis from the model.");
  }
};

export const extractApiEndpoints = async (code: string, sourceUrl?: string, onCostUpdate?: (cost: number) => void): Promise<ExtractionResult> => {
  const provider = getProvider();
  
  // Filter boilerplate code before sending to AI
  const filteredCode = filterBoilerplateCode(code);
  
  // Limit code size to prevent token limits and ensure complete responses
  const maxCodeLength = 50000; // Limit to ~50k chars to ensure complete JSON responses
  const processedCode = filteredCode.length > maxCodeLength 
    ? filteredCode.substring(0, maxCodeLength) + '\n\n/* ... (code truncated for analysis) ... */'
    : filteredCode;
  
  const enhancedPrompt = `${extractionPrompt}

**CRITICAL INSTRUCTION FOR CURL COMMANDS:**
1.  **ABSOLUTE URLs**: If a \`sourceUrl\` is provided ("${sourceUrl || ''}"), you MUST resolve any relative paths (e.g., \`/api/v1/users\`) to FULL ABSOLUTE URLs (e.g., \`${sourceUrl || 'https://example.com'}/api/v1/users\`) in the \`example.request.curl\` field. Do NOT output relative paths in cURL commands.
2.  **HEADERS**: You MUST include all necessary headers inferred from the context (e.g., \`Content-Type: application/json\`, \`Authorization: Bearer <TOKEN>\`).
3.  **USER-AGENT**: You MUST include a \`User-Agent\` header mimicking a modern Chrome browser (e.g., \`User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36\`).
4.  **READY TO RUN**: The cURL command should be copy-paste executable.

**REMEMBER**: Return COMPLETE, VALID JSON. Do not truncate your response.
`;

  try {
    let responseText = '';
    
    if (provider === 'gemini') {
        const ai = getGenAIClient();
        const response = await ai.models.generateContent({
            model: "gemini-2.0-flash-exp",
            contents: `${enhancedPrompt}\n\n\`\`\`javascript\n${processedCode}\n\`\`\``,
            config: {
                responseMimeType: "application/json",
                responseSchema: responseSchema,
            },
        });
        if (response.usageMetadata && onCostUpdate) {
            onCostUpdate(calculateCost(response.usageMetadata));
        }
        responseText = response.text.trim();
    } else {
        // For OpenAI/Local, we rely on the system prompt and JSON mode
        responseText = await callOpenAI(
            enhancedPrompt + "\n\nIMPORTANT: Return ONLY valid JSON. Do not include markdown fences. Ensure the JSON is complete and properly closed.", 
            `Here is the code to analyze:\n\n\`\`\`\n${processedCode}\n\`\`\``,
            true // Enable JSON mode if supported
        );
    }

    if (!responseText) {
      console.warn("AI returned an empty response.");
      return { explicitEndpoints: [], predictedEndpoints: [], crawlingCandidates: [] };
    }
    
    console.log("Raw AI Response:", responseText); // Debug log

    let jsonString = responseText;
    
    // Strategy 1: Look for markdown code blocks
    const jsonMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (jsonMatch && jsonMatch[1]) {
        jsonString = jsonMatch[1].trim();
    } else {
        // Strategy 2: Look for the first '{' and last '}'
        const firstBrace = responseText.indexOf('{');
        const lastBrace = responseText.lastIndexOf('}');
        if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
            jsonString = responseText.substring(firstBrace, lastBrace + 1);
        }
    }

    // Try to fix incomplete JSON by finding the last complete structure
    const fixIncompleteJSON = (jsonStr: string): string => {
        // Count braces to see if JSON is incomplete
        const openBraces = (jsonStr.match(/\{/g) || []).length;
        const closeBraces = (jsonStr.match(/\}/g) || []).length;
        const openBrackets = (jsonStr.match(/\[/g) || []).length;
        const closeBrackets = (jsonStr.match(/\]/g) || []).length;
        
        // If braces/brackets are unbalanced, try to fix
        if (openBraces > closeBraces || openBrackets > closeBrackets) {
            // Find the last complete object/array
            let fixed = jsonStr;
            let depth = 0;
            let lastValidPos = -1;
            
            for (let i = 0; i < jsonStr.length; i++) {
                if (jsonStr[i] === '{' || jsonStr[i] === '[') depth++;
                if (jsonStr[i] === '}' || jsonStr[i] === ']') depth--;
                if (depth === 0 && (jsonStr[i] === '}' || jsonStr[i] === ']')) {
                    lastValidPos = i;
                }
            }
            
            if (lastValidPos > 0) {
                // Try to extract a valid JSON structure
                const candidate = jsonStr.substring(0, lastValidPos + 1);
                // Check if it starts with { and ends with }
                if (candidate.trim().startsWith('{') && candidate.trim().endsWith('}')) {
                    return candidate;
                }
            }
        }
        
        return jsonStr;
    };

    try {
        let parsedJson;
        try {
            parsedJson = JSON.parse(jsonString);
        } catch (firstError) {
            // Try to fix incomplete JSON
            const fixedJson = fixIncompleteJSON(jsonString);
            try {
                parsedJson = JSON.parse(fixedJson);
            } catch (secondError) {
                // Try extracting just the explicitEndpoints array if it exists
                const explicitMatch = jsonString.match(/"explicitEndpoints"\s*:\s*\[([\s\S]*?)\]/);
                const predictedMatch = jsonString.match(/"predictedEndpoints"\s*:\s*\[([\s\S]*?)\]/);
                const crawlingMatch = jsonString.match(/"crawlingCandidates"\s*:\s*\[([\s\S]*?)\]/);
                
                if (explicitMatch || predictedMatch || crawlingMatch) {
                    // Try to parse partial results
                    const explicit = explicitMatch ? JSON.parse(`[${explicitMatch[1]}]`) : [];
                    const predicted = predictedMatch ? JSON.parse(`[${predictedMatch[1]}]`) : [];
                    const crawling = crawlingMatch ? JSON.parse(`[${crawlingMatch[1]}]`) : [];
                    
                    return {
                        explicitEndpoints: explicit as ApiEndpoint[],
                        predictedEndpoints: predicted as ApiEndpoint[],
                        crawlingCandidates: crawling as string[],
                    };
                }
                
                throw firstError;
            }
        }
        
        if (Array.isArray(parsedJson)) {
             return { explicitEndpoints: parsedJson as ApiEndpoint[], predictedEndpoints: [], crawlingCandidates: [] };
        }
        return parsedJson as ExtractionResult;
    } catch (parseError) {
        console.error("Failed to parse JSON from AI response:", parseError);
        console.error("Full raw response length:", responseText.length);
        console.error("Attempted to parse string (first 1000 chars):", jsonString.substring(0, 1000));
        console.error("Attempted to parse string (last 1000 chars):", jsonString.substring(Math.max(0, jsonString.length - 1000)));
        
        // Try one more fallback: maybe the response is wrapped in an array
        try {
            const arrayMatch = responseText.match(/\[[\s\S]*\]/);
            if (arrayMatch) {
                const arrayJson = JSON.parse(arrayMatch[0]);
                if (Array.isArray(arrayJson)) {
                    return { explicitEndpoints: arrayJson as ApiEndpoint[], predictedEndpoints: [], crawlingCandidates: [] };
                }
            }
        } catch (fallbackError) {
            console.error("Fallback array parsing also failed:", fallbackError);
        }
        
        // Return partial results if we can extract anything
        const explicitMatch = jsonString.match(/"explicitEndpoints"\s*:\s*\[([\s\S]*?)\]/);
        if (explicitMatch) {
            try {
                const explicit = JSON.parse(`[${explicitMatch[1]}]`);
                return {
                    explicitEndpoints: explicit as ApiEndpoint[],
                    predictedEndpoints: [],
                    crawlingCandidates: [],
                };
            } catch (e) {
                // Ignore
            }
        }
        
        throw new Error(`Failed to parse the analysis results. The model output was not valid JSON. Response may have been truncated. Check the browser console for details.`);
    }

  } catch (error) {
    console.error("Error calling AI API or processing response:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    throw new Error(`Failed to analyze the code. Details: ${errorMessage}`);
  }
};

export const createChatSession = (sourceCode: string): Chat => {
    // Note: Chat session interface is specific to Gemini SDK. 
    // For now, we will throw if trying to use Chat with Local provider, 
    // or we could implement a mock chat. 
    // Given the current app usage, this might only be used in specific components.
    // We'll stick to Gemini for the 'Chat' object for now, or warn.
    
    const provider = getProvider();
    if (provider !== 'gemini') {
        console.warn("Chat session is currently only supported with Gemini provider.");
        // Fallback to Gemini or throw? 
        // Ideally we'd abstract Chat too, but that's a larger refactor.
        // We'll try to use Gemini if key exists, else error.
    }

    const ai = getGenAIClient();
    const chat = ai.chats.create({
        model: 'gemini-2.5-flash',
        config: {
            systemInstruction: `You are a helpful and expertly informed code analysis assistant. The user has provided you with a block of code, which may be minified or part of a larger application. Your primary task is to answer the user's questions about this specific code. Always base your answers on the provided code context.

Here is the code:
\`\`\`
${sourceCode}
\`\`\`
`,
        },
    });
    return chat;
};