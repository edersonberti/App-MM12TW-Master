import { supabase } from '../lib/supabase';

export interface SupabaseDevice {
  id: string;
  model: string;
  pairing_token?: string;
  serial?: string | null;
  user_id: string;
  status: 'active' | 'deleted';
  deleted_at: string | null;
}

export async function fetchUserDevices(userId: string): Promise<SupabaseDevice[]> {
  try {
    const { data, error } = await supabase
      .from('devices')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'active');

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

export async function fetchAllDevices(): Promise<SupabaseDevice[]> {
  try {
    const { data, error } = await supabase
      .from('devices')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[DeviceService] Error fetching all devices:', error.message);
      return [];
    }
    return data || [];
  } catch (err) {
    console.error('[DeviceService] Fetch all devices error:', err);
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
    const { data, error } = await supabase.rpc('soft_delete_device', {
      target_device_id: deviceId,
    });

    if (error) {
      console.error('[DeviceService] Error soft-deleting device:', error.message);
      return false;
    }
    return data === true;
  } catch (err) {
    console.error('[DeviceService] Soft-delete device error:', err);
    return false;
  }
}

export async function hardDeleteDevice(deviceId: string): Promise<boolean> {
  try {
    const { data, error } = await supabase.rpc('owner_hard_delete_device', {
      target_device_id: deviceId,
    });

    if (error) {
      console.error('[DeviceService] Hard-delete device error:', error.message);
      return false;
    }
    return data === true;
  } catch (err) {
    console.error('[DeviceService] Hard-delete device error:', err);
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
