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
  id?: string;
  device_id: string;
  motor1_name?: string;
  motor2_name?: string;
  motor3_name?: string;
  motor4_name?: string;
  motor5_name?: string;
  motor6_name?: string;
  motor7_name?: string;
  motor8_name?: string;
  updated_at?: string;
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
function cleanDeviceIdStr(id: string): string {
  if (!id) return '';
  const trimmed = id.trim();
  const parts = trimmed.split('-');
  const isMlzPrefixed = trimmed.toLowerCase().startsWith('mlz-');
  
  if (isMlzPrefixed && parts.length >= 4) {
    return parts.slice(0, 4).join('-');
  } else if (!isMlzPrefixed && parts.length >= 3) {
    return parts.slice(0, 3).join('-');
  }
  return trimmed;
}

/**
 * Soft-deletes a device via public.soft_delete_device (status=deleted + audit_events).
 * Prefer services/deviceService.deleteDevice — this wrapper remains for sync callers.
 */
export async function deleteDeviceInSupabase(deviceId: string, _userId?: string): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;

  try {
    const rawId = (deviceId || '').trim();
    if (!rawId) return true;

    const clean = cleanDeviceIdStr(rawId);
    const isMlz = rawId.toLowerCase().startsWith('mlz-');
    const withoutMlz = isMlz ? rawId.substring(4) : rawId;
    const cleanTarget = clean.toLowerCase();
    const withoutMlzLower = withoutMlz.toLowerCase();
    const matched = new Set<string>();

    const { data: dbDevices } = await supabase
      .from('devices')
      .select('id')
      .eq('status', 'active');

    for (const d of dbDevices || []) {
      const dClean = cleanDeviceIdStr(d.id).toLowerCase();
      const dLower = d.id.toLowerCase();
      if (
        dLower === rawId.toLowerCase() ||
        (cleanTarget && dClean === cleanTarget) ||
        (cleanTarget && dLower.includes(cleanTarget)) ||
        (withoutMlzLower && dLower.includes(withoutMlzLower))
      ) {
        matched.add(d.id);
      }
    }

    if (matched.size === 0) matched.add(rawId);

    let anySuccess = false;
    for (const targetId of matched) {
      const { error } = await supabase.rpc('soft_delete_device', {
        target_device_id: targetId,
      });
      if (error) {
        console.warn('[Supabase Sync] soft_delete_device failed for', targetId, error.message);
        continue;
      }
      anySuccess = true;
    }

    return anySuccess;
  } catch (err) {
    console.warn('[Supabase Sync] Soft delete device exception:', err);
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

async function assertManagedDevice(deviceId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('devices')
    .select('id')
    .eq('id', deviceId)
    .maybeSingle();

  if (error) {
    console.warn('[Supabase Sync] Device access check failed:', error.message);
    return false;
  }
  return !!data;
}

/**
 * Creates default device_settings row when missing (INSERT only).
 */
export async function ensureDeviceSettings(deviceId: string): Promise<SupabaseDeviceSettings | null> {
  if (!isSupabaseConfigured()) return null;

  const existing = await fetchDeviceSettings(deviceId);
  if (existing) return existing;

  const canManage = await assertManagedDevice(deviceId);
  if (!canManage) {
    console.warn('[Supabase Sync] Skipping settings create for inaccessible device:', deviceId);
    return null;
  }

  try {
    const { data, error } = await supabase
      .from('device_settings')
      .upsert({ device_id: deviceId }, { onConflict: 'device_id' })
      .select()
      .maybeSingle();

    if (error) {
      if (error.message?.includes('duplicate key') || error.code === '23505') {
        return await fetchDeviceSettings(deviceId);
      }
      console.warn('[Supabase Sync] Error creating default device settings:', error.message);
      return null;
    }
    return data;
  } catch (err: any) {
    console.error('[Supabase Sync] Create default device settings error:', err);
    return await fetchDeviceSettings(deviceId);
  }
}

/**
 * Updates motor names in device_settings (UPSERT based on device_id).
 */
export async function saveDeviceSettings(
  deviceId: string,
  settings: {
    motor1_name?: string;
    motor2_name?: string;
    motor3_name?: string;
    motor4_name?: string;
    motor5_name?: string;
    motor6_name?: string;
    motor7_name?: string;
    motor8_name?: string;
  }
): Promise<SupabaseDeviceSettings | null> {
  if (!isSupabaseConfigured()) return null;

  const canManage = await assertManagedDevice(deviceId);
  if (!canManage) {
    console.warn('[Supabase Sync] Cannot save settings for inaccessible device:', deviceId);
    return null;
  }

  try {
    const { data, error } = await supabase
      .from('device_settings')
      .upsert(
        {
          device_id: deviceId,
          ...settings,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'device_id' }
      )
      .select()
      .maybeSingle();

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
