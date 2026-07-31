import { supabase } from '../lib/supabase';

export interface SupabaseProfile {
  id: string;
  email: string;
  full_name: string;
  role: string;
  status?: string;
  deleted_at?: string | null;
}

export async function fetchProfile(userId: string): Promise<SupabaseProfile | null> {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, email, full_name, role, status, deleted_at')
      .eq('id', userId)
      .maybeSingle();

    if (error) {
      console.error('[ProfileService] Error fetching profile:', error.message);
      return null;
    }
    return data;
  } catch (err) {
    console.error('[ProfileService] Fetch profile error:', err);
    return null;
  }
}

export async function updateProfile(userId: string, fullName: string): Promise<SupabaseProfile | null> {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .update({ full_name: fullName })
      .eq('id', userId)
      .select()
      .single();

    if (error) {
      console.error('[ProfileService] Error updating profile:', error.message);
      return null;
    }
    return data;
  } catch (err) {
    console.error('[ProfileService] Update profile error:', err);
    return null;
  }
}

/** Active profiles only (excludes soft-deleted accounts). */
export async function fetchAllProfiles(): Promise<SupabaseProfile[]> {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, email, full_name, role, status, deleted_at')
      .neq('status', 'deleted');

    if (error) {
      console.error('[ProfileService] Error fetching all profiles:', error.message);
      return [];
    }
    return data || [];
  } catch (err) {
    console.error('[ProfileService] Fetch all profiles error:', err);
    return [];
  }
}

export async function updateProfileRole(userId: string, role: string): Promise<SupabaseProfile | null> {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .update({ role })
      .eq('id', userId)
      .select()
      .single();

    if (error) {
      console.error('[ProfileService] Error updating profile role:', error.message);
      return null;
    }
    return data;
  } catch (err) {
    console.error('[ProfileService] Update profile role error:', err);
    return null;
  }
}

/**
 * Soft-deletes an operator account via `owner_soft_delete_operator` RPC.
 * Sets profiles.status=deleted + deleted_at, soft-deletes their devices,
 * writes audit_events, and revokes auth login.
 */
export async function deleteProfile(userId: string): Promise<boolean> {
  try {
    const { data, error } = await supabase.rpc('owner_soft_delete_operator', {
      target_user_id: userId,
    });

    if (error) {
      console.error('[ProfileService] owner_soft_delete_operator failed:', error.message);
      return false;
    }

    if (data !== true) {
      console.warn('[ProfileService] Soft-delete returned false (not operator, already deleted, or not found)');
      return false;
    }

    return true;
  } catch (err) {
    console.error('[ProfileService] Delete profile error:', err);
    return false;
  }
}
