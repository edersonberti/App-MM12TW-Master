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
  updated_at?: string;
}

export type DeviceSettingsUpdate = Partial<
  Omit<SupabaseDeviceSettings, 'device_id'>
>;

async function assertManagedDevice(deviceId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('devices')
    .select('id')
    .eq('id', deviceId)
    .maybeSingle();

  if (error) {
    console.error('[SettingsService] Device ownership check failed:', error.message);
    return false;
  }

  return !!data;
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

  // Never create settings for a device the user cannot see in `devices`
  // (deleted, unassigned, or another user's equipment) — that triggers RLS 42501.
  const canManage = await assertManagedDevice(deviceId);
  if (!canManage) {
    console.warn(
      '[SettingsService] Skipping settings create: device not found or not accessible for current user:',
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
  const canManage = await assertManagedDevice(deviceId);
  if (!canManage) {
    console.error(
      '[SettingsService] Cannot save settings: device missing or not owned/accessible:',
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
