import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import { supabase } from '../supabase/client';
import { profilesRepo } from '../db';
import type { User, Session, AuthError } from '@supabase/supabase-js';
import type { Tables } from '../supabase/types';

// ---------------------------------------------------------------------------
// Error message mapping — translate Supabase error codes into user-friendly
// messages so patients see clear guidance instead of cryptic API strings.
// ---------------------------------------------------------------------------

const ERROR_MESSAGES: Record<string, string> = {
  'Invalid login credentials': 'Incorrect email or password. Please try again.',
  'Email not confirmed': 'Please verify your email address before signing in. Check your inbox for a confirmation link.',
  'User already registered': 'An account with this email already exists. Try signing in instead.',
  'Password should be at least 6 characters': 'Password must be at least 6 characters long.',
  'Signup requires a valid password': 'Please enter a valid password (at least 6 characters).',
  'Unable to validate email address: invalid format': 'Please enter a valid email address.',
  'Email rate limit exceeded': 'Too many attempts. Please wait a few minutes and try again.',
  'For security purposes, you can only request this after 60 seconds.': 'Please wait 60 seconds before requesting another email.',
};

function friendlyError(error: AuthError | Error): string {
  const msg = error.message || 'An unexpected error occurred.';
  return ERROR_MESSAGES[msg] || msg;
}

// ---------------------------------------------------------------------------
// Context shape
// ---------------------------------------------------------------------------

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  profile: Tables<'profiles'> | null;
  isLoading: boolean;
  isGuest: boolean;
  /** True when signup succeeded but the user must verify their email first. */
  needsEmailVerification: boolean;
  /** Email that needs verification (for showing in the "check your inbox" UI). */
  pendingVerificationEmail: string | null;
  signInWithEmail: (email: string, password: string) => Promise<{ error: string | null }>;
  signUpWithEmail: (
    email: string,
    password: string,
    profileData: { fullName: string; sex?: 'male' | 'female' | 'other' | 'undisclosed'; dateOfBirth?: string }
  ) => Promise<{ error: string | null; needsVerification: boolean }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  resendVerificationEmail: (email: string) => Promise<{ error: string | null }>;
  clearVerificationState: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

// ---------------------------------------------------------------------------
// Development auth bypass
// ---------------------------------------------------------------------------

/**
 * Local development auth bypass.
 *
 * Opt in per-environment with `VITE_DISABLE_AUTH=true` in `.env.local`. It is
 * force-disabled in production builds so a stray env var cannot ship an app that
 * serves one shared patient record to everyone.
 */
export const DISABLE_AUTH =
  import.meta.env.VITE_DISABLE_AUTH === 'true' && !import.meta.env.PROD;

const DEV_TEST_USER: User = {
  id: '00000000-0000-0000-0000-000000000001',
  app_metadata: {},
  user_metadata: { full_name: 'Test Patient' },
  aud: 'authenticated',
  created_at: new Date().toISOString(),
  email: 'test.patient@medfolio.dev',
  role: 'authenticated',
  updated_at: new Date().toISOString(),
} as User;

const DEV_TEST_PROFILE: Tables<'profiles'> = {
  id: '00000000-0000-0000-0000-000000000001',
  user_id: '00000000-0000-0000-0000-000000000001',
  full_name: 'Test Patient',
  relationship: 'self',
  sex: 'male',
  date_of_birth: '1990-01-01',
  blood_group: 'B+',
  height_cm: 175,
  weight_kg: 70,
  allergies: null,
  chronic_conditions: 'Type 2 Diabetes, Hypertension',
  emergency_contact_name: null,
  emergency_contact_phone: null,
  is_default: true,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(DISABLE_AUTH ? DEV_TEST_USER : null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Tables<'profiles'> | null>(DISABLE_AUTH ? DEV_TEST_PROFILE : null);
  const [isLoading, setIsLoading] = useState(!DISABLE_AUTH);
  const [needsEmailVerification, setNeedsEmailVerification] = useState(false);
  const [pendingVerificationEmail, setPendingVerificationEmail] = useState<string | null>(null);

  // -----------------------------------------------------------------------
  // Profile fetching — tries remote, falls back to local store
  // -----------------------------------------------------------------------

  const fetchProfile = useCallback(async (authUser: User | null) => {
    if (DISABLE_AUTH) {
      setProfile(DEV_TEST_PROFILE);
      return;
    }

    if (!authUser) {
      setProfile(null);
      return;
    }

    try {
      let p = await profilesRepo.getDefaultProfile(authUser.id);
      if (!p) {
        // The database trigger should have created the profile on signup.
        // If it doesn't exist yet (e.g. trigger hasn't been deployed), create
        // it client-side as a fallback.
        p = await profilesRepo.updateProfile(authUser.id, {
          id: authUser.id,
          user_id: authUser.id,
          full_name: authUser.user_metadata?.full_name || authUser.email?.split('@')[0] || 'Patient',
          is_default: true,
          sex: authUser.user_metadata?.sex || 'undisclosed',
          date_of_birth: authUser.user_metadata?.date_of_birth || null,
        });
      }
      setProfile(p);
    } catch (err) {
      console.warn('Error loading user profile:', err);
    }
  }, []);

  // -----------------------------------------------------------------------
  // Session bootstrap + auth state listener
  // -----------------------------------------------------------------------

  useEffect(() => {
    if (DISABLE_AUTH) {
      setUser(DEV_TEST_USER);
      setProfile(DEV_TEST_PROFILE);
      setIsLoading(false);
      return;
    }

    let mounted = true;

    // 1. Get initial session
    supabase.auth.getSession().then(({ data: { session: initialSession } }) => {
      if (!mounted) return;
      setSession(initialSession);
      setUser(initialSession?.user ?? null);
      if (initialSession?.user) {
        fetchProfile(initialSession.user).finally(() => {
          if (mounted) setIsLoading(false);
        });
      } else {
        setIsLoading(false);
      }
    });

    // 2. Listen to auth state changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, newSession) => {
      if (!mounted) return;

      setSession(newSession);
      setUser(newSession?.user ?? null);

      switch (event) {
        case 'SIGNED_IN':
          // User signed in — clear any verification state, load profile
          setNeedsEmailVerification(false);
          setPendingVerificationEmail(null);
          fetchProfile(newSession?.user ?? null).finally(() => {
            if (mounted) setIsLoading(false);
          });
          break;

        case 'SIGNED_OUT':
          setProfile(null);
          setNeedsEmailVerification(false);
          setPendingVerificationEmail(null);
          setIsLoading(false);
          break;

        case 'TOKEN_REFRESHED':
          // Session refreshed — no need to reload profile
          break;

        case 'USER_UPDATED':
          // User metadata changed (e.g. after email verification)
          fetchProfile(newSession?.user ?? null);
          break;

        case 'PASSWORD_RECOVERY':
          // User clicked password reset link — they now have a session
          // The SettingsPage or a dedicated reset page handles the actual
          // password update via supabase.auth.updateUser().
          break;

        default:
          // INITIAL_SESSION, MFA_CHALLENGE_VERIFIED, etc.
          if (newSession?.user) {
            fetchProfile(newSession.user).finally(() => {
              if (mounted) setIsLoading(false);
            });
          }
          break;
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [fetchProfile]);

  // -----------------------------------------------------------------------
  // Sign in
  // -----------------------------------------------------------------------

  const signInWithEmail = useCallback(async (email: string, password: string): Promise<{ error: string | null }> => {
    try {
      const trimmedEmail = email.trim().toLowerCase();
      const { data, error } = await supabase.auth.signInWithPassword({
        email: trimmedEmail,
        password,
      });

      if (error) {
        // Special handling: if email not confirmed, surface the verification flow
        if (error.message.includes('Email not confirmed')) {
          setNeedsEmailVerification(true);
          setPendingVerificationEmail(trimmedEmail);
        }
        return { error: friendlyError(error) };
      }

      if (data.user) {
        setUser(data.user);
        setSession(data.session);
        setNeedsEmailVerification(false);
        setPendingVerificationEmail(null);
        await fetchProfile(data.user);
      }

      return { error: null };
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error('Sign in failed');
      return { error: friendlyError(error) };
    }
  }, [fetchProfile]);

  // -----------------------------------------------------------------------
  // Sign up
  // -----------------------------------------------------------------------

  const signUpWithEmail = useCallback(async (
    email: string,
    password: string,
    profileData: { fullName: string; sex?: 'male' | 'female' | 'other' | 'undisclosed'; dateOfBirth?: string }
  ): Promise<{ error: string | null; needsVerification: boolean }> => {
    try {
      const trimmedEmail = email.trim().toLowerCase();

      const metadata: Record<string, string> = {
        full_name: profileData.fullName.trim(),
        sex: profileData.sex || 'undisclosed',
      };

      if (profileData.dateOfBirth && /^\d{4}-\d{2}-\d{2}$/.test(profileData.dateOfBirth)) {
        metadata.date_of_birth = profileData.dateOfBirth;
      }

      const { data, error } = await supabase.auth.signUp({
        email: trimmedEmail,
        password,
        options: {
          data: metadata,
          // The callback URL Supabase appends the verification token to.
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      if (error) {
        return { error: friendlyError(error), needsVerification: false };
      }

      // Supabase v2: when email confirmation is ENABLED, `data.session` is
      // null and `data.user.identities` is an empty array for a brand-new
      // user. When confirmation is DISABLED, a full session is returned.
      //
      // Edge case: if the email already exists, Supabase may return a fake
      // user with no identities to avoid leaking whether the email is taken.

      const isConfirmationRequired = !data.session;
      const isFakeUser = data.user && data.user.identities && data.user.identities.length === 0;

      if (isFakeUser) {
        // Email is already registered — Supabase returns a dummy user
        return {
          error: 'An account with this email already exists. Try signing in instead.',
          needsVerification: false,
        };
      }

      if (isConfirmationRequired) {
        // Email confirmation is on — user must verify before they can sign in.
        setNeedsEmailVerification(true);
        setPendingVerificationEmail(trimmedEmail);
        return { error: null, needsVerification: true };
      }

      // Email confirmation is off — user is immediately signed in.
      if (data.user) {
        setUser(data.user);
        setSession(data.session);

        // Profile should be auto-created by the database trigger, but if not,
        // fetchProfile handles the fallback creation.
        await fetchProfile(data.user);
      }

      return { error: null, needsVerification: false };
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error('Sign up failed');
      return { error: friendlyError(error), needsVerification: false };
    }
  }, [fetchProfile]);

  // -----------------------------------------------------------------------
  // Sign out
  // -----------------------------------------------------------------------

  const signOut = useCallback(async () => {
    try {
      await supabase.auth.signOut();
    } catch (err) {
      console.warn('Sign out error:', err);
    } finally {
      // Always clear local state, even in DISABLE_AUTH mode — a sign-out button
      // that leaves you signed in is worse than no button.
      setUser(null);
      setSession(null);
      setProfile(null);
      setNeedsEmailVerification(false);
      setPendingVerificationEmail(null);
    }
  }, []);

  // -----------------------------------------------------------------------
  // Resend verification email
  // -----------------------------------------------------------------------

  const resendVerificationEmail = useCallback(async (email: string): Promise<{ error: string | null }> => {
    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: email.trim().toLowerCase(),
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      if (error) {
        return { error: friendlyError(error) };
      }

      return { error: null };
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error('Failed to resend verification email');
      return { error: friendlyError(error) };
    }
  }, []);

  // -----------------------------------------------------------------------
  // Helpers
  // -----------------------------------------------------------------------

  const refreshProfile = useCallback(async () => {
    if (user) {
      await fetchProfile(user);
    }
  }, [user, fetchProfile]);

  const clearVerificationState = useCallback(() => {
    setNeedsEmailVerification(false);
    setPendingVerificationEmail(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        profile,
        isLoading,
        isGuest: !user,
        needsEmailVerification,
        pendingVerificationEmail,
        signInWithEmail,
        signUpWithEmail,
        signOut,
        refreshProfile,
        resendVerificationEmail,
        clearVerificationState,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
