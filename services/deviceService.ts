import { supabase } from '../lib/supabase';

export interface SupabaseDevice {
  id: string;
  model: string;
  pairing_token?: string;
  serial?: string | null;
  user_id: string;
}

export async function fetchUserDevices(userId: string): Promise<SupabaseDevice[]> {
  try {
    const { data, error } = await supabase
      .from('devices')
      .select('*')
      .eq('user_id', userId);

    if (error) {
      console.error('[DeviceService] Error fetching devices:', error.message);
      return [];
    }
    return data || [];
  } catch (err) {
    console.error('[DeviceService] Fetch devices error:', err);
    return [];
  }
}

export async function registerDevice(
  deviceId: string,
  model: string,
  userId: string,
  serial: string = '',
  pairingToken: string = ''
): Promise<SupabaseDevice> {
  try {
    const { data, error } = await supabase
      .from('devices')
      .insert({
        id: deviceId,
        model: model,
        pairing_token: pairingToken || 'TOKEN-' + Math.random().toString(36).substring(2, 8).toUpperCase(),
        serial: serial || null,
        user_id: userId,
      })
      .select()
      .single();

    if (error) {
      console.error('[DeviceService] Error registering device:', error.message);
      throw error;
    }
    return data;
  } catch (err) {
    console.error('[DeviceService] Register device error:', err);
    throw err;
  }
}

export async function deleteDevice(deviceId: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('devices')
      .delete()
      .eq('id', deviceId);

    if (error) {
      console.error('[DeviceService] Error deleting device:', error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.error('[DeviceService] Delete device error:', err);
    return false;
  }
}

export async function updateDeviceOwner(deviceId: string, userId: string): Promise<SupabaseDevice | null> {
  try {
    const { data, error } = await supabase
      .from('devices')
      .update({ user_id: userId })
      .eq('id', deviceId)
      .select()
      .single();

    if (error) {
      console.error('[DeviceService] Error updating device owner:', error.message);
      return null;
    }
    return data;
  } catch (err) {
    console.error('[DeviceService] Update device owner error:', err);
    return null;
  }
}
