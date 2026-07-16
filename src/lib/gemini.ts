import { GoogleGenAI } from '@google/genai';

// Initialize the Gemini client.
// We fallback to a dummy/empty key if not configured to prevent crashes during build or initial setup.
const apiKey = process.env.GEMINI_API_KEY || 'your_gemini_api_key_here';
const ai = new GoogleGenAI({ apiKey });

// Simple in-memory caches
const commandCache = new Map<string, string>();
const explanationCache = new Map<string, string>();

/**
 * Generic retry helper with exponential backoff
 */
async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  retries = 3,
  delay = 1000
): Promise<T> {
  try {
    return await fn();
  } catch (error: any) {
    const errorMsg = error?.message || '';
    const status = error?.status || error?.statusCode;
    
    const isRateLimit = status === 429 || 
                        errorMsg.includes('429') || 
                        errorMsg.toLowerCase().includes('rate limit') ||
                        errorMsg.toLowerCase().includes('quota exceeded');

    if (isRateLimit && retries > 0) {
      console.warn(`[Gemini API] Rate limited. Retrying in ${delay}ms... (${retries} retries remaining)`);
      await new Promise((resolve) => setTimeout(resolve, delay));
      return retryWithBackoff(fn, retries - 1, delay * 2);
    }
    
    throw error;
  }
}

/**
 * Helper to get the target model, with support for overrides and fallbacks
 */
function getModelName(): string {
  return process.env.GEMINI_MODEL || 'gemini-2.5-flash';
}

/**
 * Generate a command based on a natural language prompt
 */
export async function generateCommandWithRetry(prompt: string): Promise<string> {
  const normalizedPrompt = prompt.trim().toLowerCase();
  
  // Check memory cache first
  if (commandCache.has(normalizedPrompt)) {
    console.log(`[Gemini Cache] Prompt cache hit: "${normalizedPrompt}"`);
    return commandCache.get(normalizedPrompt)!;
  }

  const model = getModelName();

  const callApi = async (targetModel: string) => {
    const response = await ai.models.generateContent({
      model: targetModel,
      contents: prompt,
      config: {
        systemInstruction: "You are a Linux command generator. Convert the user input into a safe bash command. Avoid destructive operations unless explicitly requested. Output ONLY the command, no markdown formatting, no backticks, no explanations.",
        temperature: 0,
      }
    });
    return response.text?.trim() || '';
  };

  try {
    // Attempt with retry and potential model fallback
    const command = await retryWithBackoff(async () => {
      try {
        return await callApi(model);
      } catch (err: any) {
        // Fallback to gemini-1.5-flash if the target model is not available or errors out on launch
        if (model !== 'gemini-1.5-flash' && 
            (err.message?.includes('not found') || err.message?.includes('not supported') || err.status === 404)) {
          console.warn(`[Gemini Fallback] Model ${model} failed. Falling back to gemini-1.5-flash...`);
          return await callApi('gemini-1.5-flash');
        }
        throw err;
      }
    });

    if (command) {
      commandCache.set(normalizedPrompt, command);
    }
    return command;
  } catch (error: any) {
    console.error('[Gemini API Error] Failed to generate command:', error);
    throw error;
  }
}

/**
 * Explain a command in simple terms
 */
export async function explainCommandWithRetry(command: string): Promise<string> {
  const normalizedCommand = command.trim();

  // Check memory cache first
  if (explanationCache.has(normalizedCommand)) {
    console.log(`[Gemini Cache] Explanation cache hit for: "${normalizedCommand}"`);
    return explanationCache.get(normalizedCommand)!;
  }

  const model = getModelName();

  const callApi = async (targetModel: string) => {
    const response = await ai.models.generateContent({
      model: targetModel,
      contents: command,
      config: {
        systemInstruction: "You are a helpful assistant. Explain the following bash command in simple terms for a beginner. Keep it under 3 sentences.",
        temperature: 0.3,
      }
    });
    return response.text?.trim() || '';
  };

  try {
    const explanation = await retryWithBackoff(async () => {
      try {
        return await callApi(model);
      } catch (err: any) {
        if (model !== 'gemini-1.5-flash' && 
            (err.message?.includes('not found') || err.message?.includes('not supported') || err.status === 404)) {
          console.warn(`[Gemini Fallback] Model ${model} failed. Falling back to gemini-1.5-flash...`);
          return await callApi('gemini-1.5-flash');
        }
        throw err;
      }
    });

    if (explanation) {
      explanationCache.set(normalizedCommand, explanation);
    }
    return explanation;
  } catch (error: any) {
    console.error('[Gemini API Error] Failed to explain command:', error);
    throw error;
  }
}
