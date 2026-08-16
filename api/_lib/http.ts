import type { IncomingMessage, ServerResponse } from 'node:http';
import { UnauthorizedError } from './auth';

export function sendJson(res: ServerResponse, statusCode: number, payload: unknown): void {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(payload));
}

/**
 * Reads and JSON-parses the request body, tolerating hosts that pre-parse it
 * (Vercel) and those that do not (plain node / vite middleware).
 */
export async function readJsonBody(req: IncomingMessage & { body?: unknown }): Promise<unknown> {
  if (req.body && typeof req.body === 'object') {
    return req.body;
  }
  if (typeof req.body === 'string') {
    return req.body ? JSON.parse(req.body) : {};
  }

  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }
  const rawText = Buffer.concat(chunks).toString('utf-8');
  return rawText ? JSON.parse(rawText) : {};
}

/**
 * Maps a thrown error to an HTTP response.
 *
 * Only auth failures and client-side validation problems surface their message;
 * everything else returns a generic message so internal details (and any patient
 * data echoed by an upstream error) are not leaked to the client.
 */
export function sendError(res: ServerResponse, context: string, err: unknown): void {
  if (err instanceof UnauthorizedError) {
    sendJson(res, 401, { error: err.message });
    return;
  }

  const message = err instanceof Error ? err.message : String(err);
  console.error(`${context}:`, err);

  if (isClientError(err)) {
    sendJson(res, 400, { error: message });
    return;
  }

  sendJson(res, 500, { error: 'Something went wrong handling that request. Please try again.' });
}

function isClientError(err: unknown): boolean {
  // Zod validation errors carry an `issues` array.
  return Boolean(err && typeof err === 'object' && 'issues' in err);
}
