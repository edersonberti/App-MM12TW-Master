import { supabase } from '../lib/supabase';

export interface SupabaseDeviceSettings {
  device_id: string;
  motor1_name?: string;
  motor2_name?: string;
  motor3_name?: string;
  motor4_name?: string;
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

export async function saveDeviceSettings(
  deviceId: string,
  settings: {
    motor1_name?: string;
    motor2_name?: string;
    motor3_name?: string;
    motor4_name?: string;
  }
): Promise<SupabaseDeviceSettings | null> {
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
      console.error('[SettingsService] Error saving settings:', error.message);
      return null;
    }
    return data;
  } catch (err) {
    console.error('[SettingsService] Save settings error:', err);
    return null;
  }
}
