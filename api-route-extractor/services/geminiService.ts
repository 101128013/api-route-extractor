

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
                  javascript: { type: Type.STRING },
                  python: { type: Type.STRING },
                  php: { type: Type.STRING },
                  go: { type: Type.STRING },
                },
                required: ["curl", "javascript", "python", "php", "go"],
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
                  javascript: { type: Type.STRING },
                  python: { type: Type.STRING },
                  php: { type: Type.STRING },
                  go: { type: Type.STRING },
                },
                required: ["curl", "javascript", "python", "php", "go"],
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

const extractionPrompt = `
You are an expert reverse engineer and security analyst. Your task is to analyze the provided content (source code, HTML, or text) to discover API routes.

**Objectives:**
1.  **Find Explicit Routes**: Identify every API route explicitly mentioned or used in the code.
2.  **Predict Routes (Exploratory Enumeration)**: Based on the "Explicit Routes" and the domain logic you observe (e.g., "User", "Product", "Order" entities), **hallucinate/predict** 20-50 likely API routes that *should* exist in a standard RESTful API.
    *   *Example*: If you see \`GET /users\`, predict \`GET /users/{id}\`, \`POST /users\`, \`PUT /users/{id}\`, \`DELETE /users/{id}\`.
    *   *Example*: If you see a "Login" button, predict \`POST /auth/login\`, \`POST /auth/logout\`, \`POST /auth/refresh\`.
3.  **Identify Crawl Targets**: Look for links to "API Docs", "Swagger", "OpenAPI", "Developers", or other pages that likely contain more API definitions. Return these as \`crawlingCandidates\`.
4.  **Infer Authentication**: For each endpoint, try to infer the required authentication type (Bearer, Basic, API Key, etc.) based on headers or context.
5.  **Find Documentation**: If you see a link to official documentation for a specific endpoint, include it.

**Guidelines:**
*   **Be Aggressive**: Assume a standard REST or GraphQL structure.
*   **Infer Methods**: If unsure, guess the most standard method (GET for retrieval, POST for actions).
*   **Ignore Assets**: Do not list .png, .css, .js files as API endpoints.

**Output Format:**
You MUST return a valid JSON object with the following structure:
{
  "explicitEndpoints": [ ... ],
  "predictedEndpoints": [ ... ],
  "crawlingCandidates": [ ... ]
}
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
            model: "gemini-2.5-flash-lite-preview-09-2025",
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
            model: "gemini-2.5-flash-lite-preview-09-2025",
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
  
  const enhancedPrompt = `${extractionPrompt}

**CRITICAL INSTRUCTION FOR CURL COMMANDS:**
1.  **ABSOLUTE URLs**: If a \`sourceUrl\` is provided ("${sourceUrl || ''}"), you MUST resolve any relative paths (e.g., \`/api/v1/users\`) to FULL ABSOLUTE URLs (e.g., \`${sourceUrl || 'https://example.com'}/api/v1/users\`) in the \`example.request.curl\` field. Do NOT output relative paths in cURL commands.
2.  **HEADERS**: You MUST include all necessary headers inferred from the context (e.g., \`Content-Type: application/json\`, \`Authorization: Bearer <TOKEN>\`).
3.  **USER-AGENT**: You MUST include a \`User-Agent\` header mimicking a modern Chrome browser (e.g., \`User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36\`).
4.  **READY TO RUN**: The cURL command should be copy-paste executable.
`;

  try {
    let responseText = '';
    
    if (provider === 'gemini') {
        const ai = getGenAIClient();
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash-lite-preview-09-2025",
            contents: `${enhancedPrompt}\n\n\`\`\`javascript\n${code}\n\`\`\``,
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
            enhancedPrompt + "\n\nIMPORTANT: Return ONLY valid JSON. Do not include markdown fences.", 
            `Here is the code to analyze:\n\n\`\`\`\n${code}\n\`\`\``,
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

    try {
        const parsedJson = JSON.parse(jsonString);
        if (Array.isArray(parsedJson)) {
             return { explicitEndpoints: parsedJson as ApiEndpoint[], predictedEndpoints: [], crawlingCandidates: [] };
        }
        return parsedJson as ExtractionResult;
    } catch (parseError) {
        console.error("Failed to parse JSON from AI response:", parseError);
        console.error("Attempted to parse string:", jsonString);
        throw new Error(`Failed to parse the analysis results. The model output was not valid JSON. Raw output logged to console.`);
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