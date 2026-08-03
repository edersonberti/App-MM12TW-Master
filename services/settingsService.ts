import { supabase } from '../lib/supabase';

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
  // Filtration timers
  filter_init1?: string | null;
  filter_hours1?: string | null;
  filter_init2?: string | null;
  filter_hours2?: string | null;
  filter_days?: boolean[] | null;
  // LED timer
  led_start_hour?: string | null;
  led_start_minute?: string | null;
  led_duration?: string | null;
  led_program?: string | null;
  // Hydro timer
  hidro_timer_enabled?: boolean | null;
  hidro_timer_hours?: string | null;
  updated_at?: string;
}

export type DeviceSettingsUpdate = Partial<
  Omit<SupabaseDeviceSettings, 'device_id'>
>;

/** True when the current user may INSERT/UPDATE device_settings (RLS WITH CHECK). */
async function assertCanManageSettings(deviceId: string): Promise<boolean> {
  const { data, error } = await supabase.rpc('can_manage_device_settings', {
    p_device_id: deviceId,
  });

  if (error) {
    // Fallback: active device the user can still see (owner / configure / elevated).
    console.warn(
      '[SettingsService] can_manage_device_settings RPC failed, falling back to devices lookup:',
      error.message
    );
    const { data: device, error: deviceError } = await supabase
      .from('devices')
      .select('id')
      .eq('id', deviceId)
      .eq('status', 'active')
      .maybeSingle();

    if (deviceError) {
      console.error('[SettingsService] Device ownership check failed:', deviceError.message);
      return false;
    }
    return !!device;
  }

  return data === true;
}

export async function fetchDeviceSettings(deviceId: string): Promise<SupabaseDeviceSettings | null> {
  try {
    const { data, error } = await supabase
      .from('device_settings')
      .select('*')
      .eq('device_id', deviceId)
      .maybeSingle();

    if (error) {
      console.error('[SettingsService] Error fetching settings:', error.message);
      return null;
    }
    return data;
  } catch (err) {
    console.error('[SettingsService] Fetch settings error:', err);
    return null;
  }
}

export async function ensureDeviceSettings(deviceId: string): Promise<SupabaseDeviceSettings | null> {
  const existing = await fetchDeviceSettings(deviceId);
  if (existing) return existing;

  // Soft-deleted / control-only / foreign devices: SELECT on devices may still
  // succeed, but INSERT into device_settings is blocked by RLS (status=active + configure).
  const canManage = await assertCanManageSettings(deviceId);
  if (!canManage) {
    console.warn(
      '[SettingsService] Skipping settings create: no configure access or device not active:',
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
      // 42501 = RLS — expected for races / permission changes; do not alarm.
      if (error.code === '42501' || /row-level security/i.test(error.message || '')) {
        console.warn('[SettingsService] Settings create blocked by RLS:', deviceId);
        return await fetchDeviceSettings(deviceId);
      }
      console.error('[SettingsService] Error creating default settings:', error.message);
      return null;
    }
    return data;
  } catch (err) {
    console.error('[SettingsService] Create default settings error:', err);
    return await fetchDeviceSettings(deviceId);
  }
}

export async function saveDeviceSettings(
  deviceId: string,
  settings: DeviceSettingsUpdate
): Promise<SupabaseDeviceSettings | null> {
  const canManage = await assertCanManageSettings(deviceId);
  if (!canManage) {
    console.error(
      '[SettingsService] Cannot save settings: device missing, deleted, or not configurable:',
      deviceId
    );
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
      console.error('[SettingsService] Error saving settings:', error.message);
      return null;
    }
    return data;
  } catch (err) {
    console.error('[SettingsService] Save settings error:', err);
    return null;
  }
}
