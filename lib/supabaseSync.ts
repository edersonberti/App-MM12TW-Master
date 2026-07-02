import { supabase, isSupabaseConfigured } from './supabase';

export interface SupabaseProfile {
  id: string;
  email: string;
  full_name: string;
  role: string;
}

export interface SupabaseDevice {
  id: string;
  model: string;
  pairing_token?: string;
  user_id: string;
}

export interface SupabaseDeviceSettings {
  device_id: string;
  motor1_name?: string;
  motor2_name?: string;
  motor3_name?: string;
  motor4_name?: string;
}

/**
 * Syncs the user's profile with Supabase Auth/Profiles table.
 */
export async function syncUserProfile(
  userId: string,
  email: string,
  role: string,
  fullName: string = ''
): Promise<SupabaseProfile | null> {
  if (!isSupabaseConfigured()) return null;

  try {
    const { data, error } = await supabase
      .from('profiles')
      .upsert({
        id: userId,
        email: email,
        full_name: fullName || email.split('@')[0],
        role: role,
      })
      .select()
      .single();

    if (error) {
      console.warn('[Supabase Sync] Error upserting profile:', error.message);
      return null;
    }
    return data;
  } catch (err: any) {
    console.error('[Supabase Sync] Profile sync error:', err);
    return null;
  }
}

/**
 * Fetches all registered equipment/devices associated with the user.
 */
export async function fetchUserDevices(userId: string): Promise<SupabaseDevice[]> {
  if (!isSupabaseConfigured()) return [];

  try {
    const { data, error } = await supabase
      .from('devices')
      .select('*')
      .eq('user_id', userId);

    if (error) {
      console.warn('[Supabase Sync] Error fetching devices:', error.message);
      return [];
    }
    return data || [];
  } catch (err: any) {
    console.error('[Supabase Sync] Fetch devices error:', err);
    return [];
  }
}

/**
 * Registers a new device/equipment under the current user's profile.
 */
export async function registerDeviceInSupabase(
  deviceId: string,
  model: string,
  userId: string,
  pairingToken: string = ''
): Promise<SupabaseDevice | null> {
  if (!isSupabaseConfigured()) return null;

  try {
    const { data, error } = await supabase
      .from('devices')
      .upsert({
        id: deviceId,
        model: model,
        pairing_token: pairingToken || 'TOKEN-' + Math.random().toString(36).substring(2, 8).toUpperCase(),
        user_id: userId,
      })
      .select()
      .single();

    if (error) {
      console.warn('[Supabase Sync] Error registering device:', error.message);
      return null;
    }
    return data;
  } catch (err: any) {
    console.error('[Supabase Sync] Register device error:', err);
    return null;
  }
}

/**
 * Unregisters/Deletes a device from Supabase.
 */
export async function deleteDeviceInSupabase(deviceId: string): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;

  try {
    const { error } = await supabase
      .from('devices')
      .delete()
      .eq('id', deviceId);

    if (error) {
      console.warn('[Supabase Sync] Error deleting device:', error.message);
      return false;
    }
    return true;
  } catch (err: any) {
    console.error('[Supabase Sync] Delete device error:', err);
    return false;
  }
}

/**
 * Fetches the custom motor names/settings for a specific device.
 */
export async function fetchDeviceSettings(deviceId: string): Promise<SupabaseDeviceSettings | null> {
  if (!isSupabaseConfigured()) return null;

  try {
    const { data, error } = await supabase
      .from('device_settings')
      .select('*')
      .eq('device_id', deviceId)
      .maybeSingle();

    if (error) {
      console.warn('[Supabase Sync] Error fetching device settings:', error.message);
      return null;
    }
    return data;
  } catch (err: any) {
    console.error('[Supabase Sync] Fetch device settings error:', err);
    return null;
  }
}

/**
 * Upserts custom motor names or other device-specific configurations in Supabase.
 */
export async function saveDeviceSettings(
  deviceId: string,
  settings: {
    motor1_name?: string;
    motor2_name?: string;
    motor3_name?: string;
    motor4_name?: string;
  }
): Promise<SupabaseDeviceSettings | null> {
  if (!isSupabaseConfigured()) return null;

  try {
    const { data, error } = await supabase
      .from('device_settings')
      .upsert({
        device_id: deviceId,
        ...settings,
      })
      .select()
      .single();

    if (error) {
      console.warn('[Supabase Sync] Error saving device settings:', error.message);
      return null;
    }
    return data;
  } catch (err: any) {
    console.error('[Supabase Sync] Save device settings error:', err);
    return null;
  }
}
