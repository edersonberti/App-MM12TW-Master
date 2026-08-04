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
  filter_init1?: string | null;
  filter_hours1?: string | null;
  filter_init2?: string | null;
  filter_hours2?: string | null;
  filter_days?: boolean[] | null;
  led_start_hour?: string | null;
  led_start_minute?: string | null;
  led_duration?: string | null;
  led_program?: string | null;
  hidro_timer_enabled?: boolean | null;
  hidro_timer_hours?: string | null;
  solar_work_mode?: 'off' | 'manual' | 'auto' | null;
  solar_heating_type?: 'solar' | 'eletrico' | null;
  solar_pool_max?: number | null;
  solar_dif?: number | null;
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
 * Soft-deletes a device in Supabase (same as deviceService.deleteDevice).
 * Kept for callers that historically used this sync helper.
 */
export async function deleteDeviceInSupabase(deviceId: string, userId?: string): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;

  try {
    const rawId = (deviceId || '').trim();
    if (!rawId) return true;

    const { data: exact } = await supabase
      .from('devices')
      .select('id')
      .eq('id', rawId)
      .neq('status', 'deleted')
      .maybeSingle();

    let targetIds: string[] = exact?.id ? [exact.id] : [];

    if (targetIds.length === 0) {
      const clean = cleanDeviceIdStr(rawId);
      const { data: dbDevices } = await supabase
        .from('devices')
        .select('id')
        .neq('status', 'deleted');

      const cleanTarget = clean.toLowerCase();
      for (const d of dbDevices || []) {
        if (
          d.id.toLowerCase() === rawId.toLowerCase() ||
          cleanDeviceIdStr(d.id).toLowerCase() === cleanTarget
        ) {
          targetIds.push(d.id);
        }
      }
    }

    if (targetIds.length === 0) {
      console.warn('[Supabase Sync] No active device to soft-delete:', rawId);
      return false;
    }

    let ok = false;
    for (const id of Array.from(new Set(targetIds))) {
      const { data, error } = await supabase.rpc('soft_delete_device', {
        target_device_id: id,
      });
      if (error) {
        console.error('[Supabase Sync] soft_delete_device failed:', id, error.message);
        continue;
      }
      if (data === true || data === null) ok = true;
    }

    // userId kept for API compatibility; ownership is enforced inside the RPC via auth.uid()
    void userId;
    return ok;
  } catch (err) {
    console.warn('[Supabase Sync] Delete device exception:', err);
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

/** Matches device_settings INSERT/UPDATE RLS (active + configure permission). */
async function assertCanManageSettings(deviceId: string): Promise<boolean> {
  const { data, error } = await supabase.rpc('can_manage_device_settings', {
    p_device_id: deviceId,
  });

  if (error) {
    console.warn(
      '[Supabase Sync] can_manage_device_settings RPC failed, falling back:',
      error.message
    );
    const { data: device, error: deviceError } = await supabase
      .from('devices')
      .select('id')
      .eq('id', deviceId)
      .eq('status', 'active')
      .maybeSingle();

    if (deviceError) {
      console.warn('[Supabase Sync] Device access check failed:', deviceError.message);
      return false;
    }
    return !!device;
  }

  return data === true;
}

/**
 * Creates default device_settings row when missing (INSERT only).
 */
export async function ensureDeviceSettings(deviceId: string): Promise<SupabaseDeviceSettings | null> {
  if (!isSupabaseConfigured()) return null;

  const existing = await fetchDeviceSettings(deviceId);
  if (existing) return existing;

  const canManage = await assertCanManageSettings(deviceId);
  if (!canManage) {
    console.warn(
      '[Supabase Sync] Skipping settings create: no configure access or device not active:',
      deviceId
    );
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
      if (error.code === '42501' || /row-level security/i.test(error.message || '')) {
        console.warn('[Supabase Sync] Settings create blocked by RLS:', deviceId);
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
 * Updates device_settings (UPSERT based on device_id) — motor names and/or timer config.
 */
export async function saveDeviceSettings(
  deviceId: string,
  settings: Partial<Omit<SupabaseDeviceSettings, 'device_id' | 'id'>>
): Promise<SupabaseDeviceSettings | null> {
  if (!isSupabaseConfigured()) return null;

  const canManage = await assertCanManageSettings(deviceId);
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
