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

async function assertCanConfigureDevice(deviceId: string): Promise<boolean> {
  const { data, error } = await supabase.rpc('user_can_configure_device', {
    p_device_id: deviceId,
  });

  if (error) {
    console.error('[SettingsService] Configure permission check failed:', error.message);
    return false;
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

  // Creating settings requires configure permission (owner / share configure).
  const canConfigure = await assertCanConfigureDevice(deviceId);
  if (!canConfigure) {
    console.warn(
      '[SettingsService] Skipping settings create: no configure permission for',
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
  const canConfigure = await assertCanConfigureDevice(deviceId);
  if (!canConfigure) {
    console.error(
      '[SettingsService] Cannot save settings: control-only share or no access:',
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
