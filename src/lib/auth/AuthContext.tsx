import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { supabase } from '../supabase/client';
import { profilesRepo } from '../db';
import type { User, Session } from '@supabase/supabase-js';
import type { Tables } from '../supabase/types';

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  profile: Tables<'profiles'> | null;
  isLoading: boolean;
  isGuest: boolean;
  signInWithEmail: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUpWithEmail: (
    email: string,
    password: string,
    profileData: { fullName: string; sex?: 'male' | 'female' | 'other' | 'undisclosed'; dateOfBirth?: string }
  ) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

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

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(DISABLE_AUTH ? DEV_TEST_USER : null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Tables<'profiles'> | null>(DISABLE_AUTH ? DEV_TEST_PROFILE : null);
  const [isLoading, setIsLoading] = useState(!DISABLE_AUTH);

  const fetchProfile = async (authUser: User | null) => {
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
        // Create initial profile in database for this new Supabase user
        p = await profilesRepo.updateProfile(authUser.id, {
          id: authUser.id,
          user_id: authUser.id,
          full_name: authUser.user_metadata?.full_name || authUser.email?.split('@')[0] || 'Patient',
          is_default: true,
          sex: 'undisclosed',
        });
      }
      setProfile(p);
    } catch (err) {
      console.warn('Error loading user profile:', err);
    }
  };

  useEffect(() => {
    if (DISABLE_AUTH) {
      setUser(DEV_TEST_USER);
      setProfile(DEV_TEST_PROFILE);
      setIsLoading(false);
      return;
    }

    // 1. Get initial Supabase session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      fetchProfile(session?.user ?? null).finally(() => setIsLoading(false));
    });

    // 2. Listen to real Supabase auth state changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      fetchProfile(session?.user ?? null).finally(() => setIsLoading(false));
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const signInWithEmail = async (email: string, password: string) => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) return { error };
      if (data.user) {
        setUser(data.user);
        setSession(data.session);
        await fetchProfile(data.user);
      }
      return { error: null };
    } catch (err: unknown) {
      return { error: err instanceof Error ? err : new Error('Sign in failed') };
    }
  };

  const signUpWithEmail = async (
    email: string,
    password: string,
    profileData: { fullName: string; sex?: 'male' | 'female' | 'other' | 'undisclosed'; dateOfBirth?: string }
  ) => {
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: profileData.fullName,
          },
        },
      });

      if (error) return { error };

      if (data.user) {
        // Supabase returns a session here only when email confirmation is off.
        setUser(data.user);
        setSession(data.session);

        // Create initial profile in database
        try {
          const newProfile = await profilesRepo.updateProfile(data.user.id, {
            id: data.user.id,
            user_id: data.user.id,
            full_name: profileData.fullName,
            sex: profileData.sex || 'undisclosed',
            date_of_birth: profileData.dateOfBirth || null,
            is_default: true,
          });
          setProfile(newProfile);
        } catch (profileErr) {
          console.warn('Could not create initial profile:', profileErr);
        }
      }

      return { error: null };
    } catch (err: unknown) {
      return { error: err instanceof Error ? err : new Error('Sign up failed') };
    }
  };

  const signOut = async () => {
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
    }
  };

  const refreshProfile = async () => {
    if (user) {
      await fetchProfile(user);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        profile,
        isLoading,
        isGuest: !user,
        signInWithEmail,
        signUpWithEmail,
        signOut,
        refreshProfile,
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
