'use client';

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
  type ReactNode,
} from 'react';
import type { User } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import type { Database } from '@finlonexa/database';

type UserProfile = Database['public']['Tables']['user_profiles']['Row'];
type Role = Database['public']['Tables']['roles']['Row'];

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  roles: Role[];
  roleIds: string[];
  permissions: string[];
  hasPermission: (action: string) => boolean;
  hasRole: (roleId: string) => boolean;
  isSuperAdmin: boolean;
  isLoading: boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [roles, setRoles] = useState<Role[]>([]);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const supabase = createClient();

  const queryClient = useQueryClient();
  const identity = useRef<string | null>(null);
  const requestVersion = useRef(0);
  const fetchUserData = useCallback(async (currentUser: User | null, forceReset = false) => {
    const version = ++requestVersion.current;
    const nextIdentity = currentUser?.id ?? null;
    const isIdentityChange = identity.current !== nextIdentity || forceReset;

    if (isIdentityChange) {
      if (identity.current !== nextIdentity) {
        queryClient.clear();
        identity.current = nextIdentity;
      }
      setUser(currentUser);
      setProfile(null);
      setRoles([]);
      setPermissions([]);
      setIsLoading(Boolean(currentUser));
    } else {
      setUser(currentUser);
    }

    if (!currentUser) {
      identity.current = null;
      setUser(null);
      setProfile(null);
      setRoles([]);
      setPermissions([]);
      setIsLoading(false);
      return;
    }

    try {
      const [profileResult, roleResult] = await Promise.all([
        supabase.from('user_profiles').select('*').eq('id', currentUser.id).single(),
        supabase.from('user_roles').select('role_id, roles(id, name, description, is_active)').eq('user_id', currentUser.id),
      ]);
      if (profileResult.error || roleResult.error || !profileResult.data?.is_active) {
        throw new Error('Active user authorization unavailable');
      }
      const rawRoles = (roleResult.data ?? []).map((item: any) => item.roles).filter(Boolean);
      const assignedRoles: Role[] = rawRoles.filter((r: any) => r.is_active);
      const roleIds = assignedRoles.map(role => role.id);
      let effective: string[] = [];
      if (roleIds.length) {
        const result = await supabase.from('role_permissions').select('permission_id, is_granted')
          .in('role_id', roleIds).eq('is_granted', true);
        if (result.error) throw new Error('Permissions unavailable');
        effective = [...new Set((result.data ?? []).map(rp => rp.permission_id))];
      }
      if (version !== requestVersion.current) return;
      setProfile(profileResult.data);
      setRoles(assignedRoles);
      setPermissions(effective);
    } catch {
      // Fail closed; do not retain another identity's permissions or expose DB details.
      if (version === requestVersion.current && isIdentityChange) {
        identity.current = null;
        queryClient.clear();
      }
    } finally {
      if (version === requestVersion.current) {
        setIsLoading(false);
      }
    }
  }, [supabase, queryClient]);

  useEffect(() => {
    // Initial user fetch
    supabase.auth.getUser().then(({ data: { user: currentUser } }) => {
      fetchUserData(currentUser);
    });

    // Listen for auth state changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'TOKEN_REFRESHED') {
        if (session?.user) {
          setUser(session.user);
        }
        return;
      }
      setTimeout(() => { void fetchUserData(session?.user ?? null); }, 0);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [supabase, fetchUserData]);

  const hasPermission = useCallback(
    (action: string): boolean => {
      return permissions.includes(action);
    },
    [permissions]
  );

  const hasRole = useCallback(
    (roleId: string): boolean => {
      return roles.some((r) => r.id === roleId);
    },
    [roles]
  );

  const isSuperAdmin = roles.some((r) => r.id === 'SUPER_ADMIN');

  const signOut = async () => {
    ++requestVersion.current;
    identity.current = null;
    queryClient.clear();
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
    setRoles([]);
    setPermissions([]);
    setIsLoading(false);
  };

  const refreshProfile = async () => {
    const {
      data: { user: currentUser },
    } = await supabase.auth.getUser();
    await fetchUserData(currentUser, true);
  };

  const roleIds = roles.map((r) => r.id);

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        roles,
        roleIds,
        permissions,
        hasPermission,
        hasRole,
        isSuperAdmin,
        isLoading,
        signOut,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
