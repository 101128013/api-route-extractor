

import { GoogleGenAI, Type, Chat } from "@google/genai";
import type { ApiEndpoint } from '../types';

const getApiKey = () => {
  const localKey = localStorage.getItem('gemini-api-key');
  // Remove quotes if stored as JSON string
  if (localKey) return localKey.replace(/^"|"$/g, '');
  return process.env.API_KEY;
};

const getGenAIClient = () => {
    const apiKey = getApiKey();
    if (!apiKey) {
        throw new Error("API Key is missing. Please set it in the Settings.");
    }
    return new GoogleGenAI({ apiKey });
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

**Guidelines:**
*   **Be Aggressive**: Assume a standard REST or GraphQL structure.
*   **Infer Methods**: If unsure, guess the most standard method (GET for retrieval, POST for actions).
*   **Ignore Assets**: Do not list .png, .css, .js files as API endpoints.

**Output Format:**
Return a JSON object with:
*   \`explicitEndpoints\`: Array of found endpoints.
*   \`predictedEndpoints\`: Array of guessed endpoints.
*   \`crawlingCandidates\`: Array of URLs to crawl next.
`;

export interface ExtractionResult {
    explicitEndpoints: ApiEndpoint[];
    predictedEndpoints: ApiEndpoint[];
    crawlingCandidates: string[];
}

export const beautifyCode = async (code: string): Promise<string> => {
  try {
    const ai = getGenAIClient();
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
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
    });
    const responseText = response.text.trim();
    // Remove potential markdown fences that the model might add
    const cleanedText = responseText.replace(/^```(javascript|js)?\n/i, '').replace(/\n```$/, '');
    return cleanedText;
  } catch (error) {
    console.error("Error beautifying code with Gemini:", error);
    // Return original code if beautification fails
    return code; 
  }
};

export const analyzeApiCall = async (requestCurl: string, responseData: string): Promise<string> => {
  try {
    const ai = getGenAIClient();
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

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
    });
    return response.text.trim();
  } catch (error) {
    console.error("Error analyzing API call with Gemini:", error);
    throw new Error("Failed to get analysis from the model.");
  }
};

export const extractApiEndpoints = async (code: string): Promise<ExtractionResult> => {
  try {
    const ai = getGenAIClient();
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `${extractionPrompt}\n\n\`\`\`javascript\n${code}\n\`\`\``,
      config: {
        responseMimeType: "application/json",
        responseSchema: responseSchema,
      },
    });

    const responseText = response.text.trim();
    if (!responseText) {
      console.warn("Gemini returned an empty response.");
      return { explicitEndpoints: [], predictedEndpoints: [], crawlingCandidates: [] };
    }
    
    let jsonString = responseText;
    const jsonMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    
    if (jsonMatch && jsonMatch[1]) {
        jsonString = jsonMatch[1].trim();
    }

    try {
        const parsedJson = JSON.parse(jsonString);
        // Handle legacy array format if model falls back to it (unlikely with schema, but safe)
        if (Array.isArray(parsedJson)) {
             return { explicitEndpoints: parsedJson as ApiEndpoint[], predictedEndpoints: [], crawlingCandidates: [] };
        }
        return parsedJson as ExtractionResult;
    } catch (parseError) {
        console.error("Failed to parse JSON from Gemini response:", parseError);
        throw new Error("Failed to parse the analysis results. The model output was not valid JSON.");
    }

  } catch (error) {
    console.error("Error calling Gemini API or processing response:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    throw new Error(`Failed to analyze the code. Details: ${errorMessage}`);
  }
};

export const createChatSession = (sourceCode: string): Chat => {
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