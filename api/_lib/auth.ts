import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

/**
 * Explicit, opt-in development bypass.
 *
 * This is deliberately NOT inferred from missing configuration: a production
 * deploy that forgets SUPABASE_SERVICE_ROLE_KEY must fail closed rather than
 * silently authenticate every caller as a shared dev user.
 */
const AUTH_BYPASS_ENABLED =
  process.env.ALLOW_DEV_AUTH_BYPASS === 'true' && process.env.NODE_ENV !== 'production';

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
 *
 * Throws {@link UnauthorizedError} when the token is missing or invalid, or when
 * the server is not configured to verify tokens at all. Callers should map that
 * to a 401 response.
 */
export async function verifyAuthToken(
  authHeader: string | string[] | null | undefined
): Promise<{ userId: string }> {
  const token = extractBearerToken(authHeader);

  if (AUTH_BYPASS_ENABLED) {
    return { userId: DEV_USER_ID };
  }

  if (!supabaseUrl || !supabaseServiceKey) {
    // Misconfiguration is a server error, not an invitation to skip auth.
    throw new Error(
      'Server auth is not configured: set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY, ' +
        'or set ALLOW_DEV_AUTH_BYPASS=true for local development.'
    );
  }

  if (!token) {
    throw new UnauthorizedError();
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser(token);

  if (error || !user) {
    throw new UnauthorizedError();
  }

  return { userId: user.id };
}
