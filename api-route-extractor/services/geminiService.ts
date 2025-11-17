
import { GoogleGenAI, Type, Chat } from "@google/genai";
import type { ApiEndpoint } from '../types';

if (!process.env.API_KEY) {
  throw new Error("API_KEY environment variable not set");
}

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const responseSchema = {
  type: Type.ARRAY,
  items: {
    type: Type.OBJECT,
    properties: {
      method: {
        type: Type.STRING,
        description: "The HTTP method (e.g., GET, POST, PUT, DELETE). Use 'UNKNOWN' if it cannot be determined.",
        enum: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS', 'HEAD', 'UNKNOWN'],
      },
      path: {
        type: Type.STRING,
        description: "The API endpoint path (e.g., '/api/v1/users').",
      },
      description: {
        type: Type.STRING,
        description: "A brief, one-sentence description of what this endpoint might do, inferred from the code context.",
      },
      details: {
        type: Type.STRING,
        description: "A detailed explanation of the endpoint's likely purpose, parameters, and behavior, inferred from the code. If context is minimal, provide a plausible explanation based on common API patterns.",
      },
      example: {
        type: Type.OBJECT,
        description: "A plausible usage example for the endpoint.",
        properties: {
          request: {
            type: Type.OBJECT,
            description: "Code snippets for calling the endpoint in different languages.",
            properties: {
              curl: {
                type: Type.STRING,
                description: "A sample cURL command to call this endpoint. Include placeholders like YOUR_API_KEY or example data where appropriate.",
              },
              javascript: {
                type: Type.STRING,
                description: "A sample JavaScript `fetch` code snippet to call this endpoint. Use modern async/await syntax. Include placeholders for data and API keys.",
              },
              python: {
                type: Type.STRING,
                description: "A sample Python `requests` library code snippet to call this endpoint. Include placeholders for data and API keys.",
              },
              php: {
                type: Type.STRING,
                description: "A sample PHP snippet using cURL functions to call this endpoint. Include placeholders for data and API keys.",
              },
              go: {
                type: Type.STRING,
                description: "A sample Go snippet using the `net/http` package to call this endpoint. Include placeholders for data and API keys.",
              },
            },
            required: ["curl", "javascript", "python", "php", "go"],
          },
          response: {
            type: Type.STRING,
            description: "An example of a likely JSON response body. Use placeholders where necessary.",
          },
        },
        required: ["request", "response"],
      },
    },
    required: ["method", "path", "description", "details", "example"],
  },
};

const extractionPrompt = `
You are an expert reverse engineer and security analyst specializing in web applications. Your task is to analyze potentially minified or obfuscated JavaScript code and extract all API routes and endpoints, providing detailed usage information.

Carefully examine the provided code. For each endpoint you identify:
1.  **Extract**: Identify the HTTP method (e.g., GET, POST) and the full API path (e.g., '/api/v1/users'). If the method is unclear, use 'UNKNOWN'.
2.  **Describe**: Write a brief, one-sentence 'description' of what the endpoint likely does.
3.  **Detail**: Provide a more in-depth 'details' field explaining its potential purpose, parameters it might accept, and expected behavior based on the code context. If the code is sparse, make educated assumptions based on common API design patterns (e.g., a path like '/api/users/{id}' probably fetches a user by their ID).
4.  **Exemplify**: Create a plausible 'example' object. This must contain a 'request' object and a 'response' field.
    - The 'request' object must contain five distinct code snippets for calling the endpoint:
        - \`curl\`: A complete cURL command.
        - \`javascript\`: A browser-based JavaScript \`fetch\` snippet using async/await.
        - \`python\`: A Python snippet using the \`requests\` library.
        - \`php\`: A PHP snippet using its native cURL functions.
        - \`go\`: A Go snippet using the standard \`net/http\` package.
    - The 'response' field should contain a sample JSON response body.
    - For all examples, use placeholders like 'YOUR_API_KEY' or example data where appropriate. If context is minimal, infer plausible examples based on the endpoint's path and method.

Your response MUST be a valid JSON array. Each object in the array must strictly follow the provided JSON schema.

Code to analyze:
`;

export const beautifyCode = async (code: string): Promise<string> => {
  try {
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

export const extractApiEndpoints = async (code: string): Promise<ApiEndpoint[]> => {
  try {
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
      return [];
    }
    
    // Sometimes the model might wrap the JSON in markdown, so we try to extract it.
    const jsonMatch = responseText.match(/```json\n([\s\S]*?)\n```|([\s\S]*)/);
    const jsonString = jsonMatch ? (jsonMatch[1] || jsonMatch[2]).trim() : responseText;
    
    const parsedJson = JSON.parse(jsonString);
    
    if (Array.isArray(parsedJson)) {
        return parsedJson as ApiEndpoint[];
    }
    
    console.warn("Gemini response was not a JSON array:", parsedJson);
    return [];

  } catch (error) {
    console.error("Error calling Gemini API or parsing response:", error);
    throw new Error("Failed to analyze the code. The model may have returned an invalid response.");
  }
};

export const createChatSession = (sourceCode: string): Chat => {
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