import { createClient } from '@supabase/supabase-js';
import fs from 'node:fs';
import path from 'node:path';

function loadEnvFile() {
  try {
    const envFiles = ['.env.local', '.env.development', '.env'];
    for (const file of envFiles) {
      const envPath = path.resolve(process.cwd(), file);
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
    }
  } catch {
    // Ignore in restricted environments
  }
}

loadEnvFile();

const DEV_USER_ID = '00000000-0000-0000-0000-000000000001';

export class UnauthorizedError extends Error {
  readonly statusCode = 401;

  constructor(message = 'Unauthorized: a valid Supabase access token is required') {
    super(message);
    this.name = 'UnauthorizedError';
  }
}

function extractBearerToken(authHeader: string | string[] | null | undefined): string {
  const header = Array.isArray(authHeader) ? authHeader[0] : authHeader;
  if (!header) return '';

  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  return match?.[1]?.trim() ?? '';
}

/**
 * Verifies the caller's Supabase access token and returns their user id.
 */
export async function verifyAuthToken(
  authHeader: string | string[] | null | undefined
): Promise<{ userId: string }> {
  loadEnvFile();

  const token = extractBearerToken(authHeader);

  const isDev = process.env.NODE_ENV !== 'production';
  const allowBypass = process.env.ALLOW_DEV_AUTH_BYPASS === 'true' || process.env.VITE_DISABLE_AUTH === 'true';

  if (isDev && allowBypass) {
    return { userId: DEV_USER_ID };
  }

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
  const supabaseKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY ||
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
    '';

  if (!supabaseUrl || !supabaseKey) {
    if (isDev) {
      return { userId: DEV_USER_ID };
    }
    throw new Error(
      'Server auth is not configured: set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (or VITE_SUPABASE_ANON_KEY).'
    );
  }

  if (!token) {
    if (isDev) {
      return { userId: DEV_USER_ID };
    }
    throw new UnauthorizedError('Authentication token is required');
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const {
      data: { user },
      error,
    } = await supabase.auth.getUser(token);

    if (error || !user) {
      if (isDev && (token === 'mock' || token.startsWith('dev-'))) {
        return { userId: DEV_USER_ID };
      }
      throw new UnauthorizedError(error?.message || 'Invalid or expired authentication token');
    }

    return { userId: user.id };
  } catch (err: unknown) {
    if (err instanceof UnauthorizedError) throw err;
    if (isDev) {
      return { userId: DEV_USER_ID };
    }
    throw err;
  }
}
