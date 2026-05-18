import { create } from 'zustand';
import type { User } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase';
import { isSupabaseConfigured } from '@/lib/supabase';

export type AuthProfile = Database['public']['Tables']['profiles']['Row'];
export type AuthStaffInfo = Database['public']['Tables']['restaurant_staff']['Row'];

export type AuthStoreState = {
  user: User | null;
  profile: AuthProfile | null;
  staffInfo: AuthStaffInfo | null;
  loading: boolean;
  error: Error | null;
  isSupabaseConfigured: boolean;
};

export const useAuthStore = create<AuthStoreState>(() => ({
  user: null,
  profile: null,
  staffInfo: null,
  loading: isSupabaseConfigured,
  error: null,
  isSupabaseConfigured,
}));
