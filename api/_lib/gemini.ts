import { GoogleGenAI } from '@google/genai';
import fs from 'node:fs';
import path from 'node:path';

function loadEnvFile() {
  try {
    const envPath = path.resolve(process.cwd(), '.env');
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, 'utf-8');
      for (const line of content.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const eqIdx = trimmed.indexOf('=');
        if (eqIdx !== -1) {
          const key = trimmed.slice(0, eqIdx).trim();
          const val = trimmed.slice(eqIdx + 1).trim();
          if (!process.env[key]) {
            process.env[key] = val;
          }
        }
      }
    }
  } catch {
    // Ignore in read-only environments
  }
}

// Load env on initialization
loadEnvFile();

export interface GenerateStructuredOptions<T> {
  systemInstruction: string;
  parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }>;
  responseSchema?: Record<string, unknown>;
  validate: (raw: unknown) => T;
  temperature?: number;
}

export interface GenerateStructuredResult<T> {
  data: T;
  rawResponse: unknown;
  model: string;
  latencyMs: number;
}

/** Default model. Override with GEMINI_MODEL. */
export const DEFAULT_GEMINI_MODEL = 'gemini-2.5-flash';

export function getGeminiModel(): string {
  loadEnvFile();
  return process.env.GEMINI_MODEL || DEFAULT_GEMINI_MODEL;
}

export function getGeminiClient(): GoogleGenAI {
  loadEnvFile();
  const apiKey =
    process.env.GEMINI_API_KEY ||
    process.env.GOOGLE_API_KEY ||
    process.env.VITE_GEMINI_API_KEY;

  if (!apiKey) {
    throw new Error(
      'GEMINI_API_KEY is not set. Please add GEMINI_API_KEY=your_key in your .env file to enable live AI.'
    );
  }

  return new GoogleGenAI({ apiKey });
}

export async function generateStructured<T>(
  opts: GenerateStructuredOptions<T>
): Promise<GenerateStructuredResult<T>> {
  const model = getGeminiModel();
  const ai = getGeminiClient();
  const startTime = Date.now();
  const baseTemperature = opts.temperature ?? 0;

  const MAX_ATTEMPTS = 2;
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const contents: Array<string | { inlineData: { mimeType: string; data: string } }> = [];
      for (const part of opts.parts) {
        if ('text' in part) {
          contents.push(part.text);
        } else if ('inlineData' in part) {
          contents.push(part);
        }
      }

      const response = await ai.models.generateContent({
        model,
        contents,
        config: {
          systemInstruction: opts.systemInstruction,
          // A retry at the same temperature re-samples the same deterministic
          // output, so raise it slightly to give the retry a chance to differ.
          temperature: attempt === 1 ? baseTemperature : Math.min(baseTemperature + 0.2, 1),
          responseMimeType: 'application/json',
          responseSchema: opts.responseSchema,
        },
      });

      const responseText = response.text || '{}';
      const parsedJson = JSON.parse(responseText);
      const validatedData = opts.validate(parsedJson);

      return {
        data: validatedData,
        rawResponse: parsedJson,
        model,
        latencyMs: Date.now() - startTime,
      };
    } catch (err: unknown) {
      lastError = err instanceof Error ? err : new Error(String(err));
      console.error(`Gemini call attempt ${attempt} failed:`, lastError.message);
      if (attempt < MAX_ATTEMPTS) {
        await new Promise((resolve) => setTimeout(resolve, 800));
      }
    }
  }

  throw lastError || new Error('Failed to generate structured AI response from Gemini');
}
