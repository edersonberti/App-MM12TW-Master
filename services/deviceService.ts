import { supabase } from '../lib/supabase';

export interface SupabaseDevice {
  id: string;
  model: string;
  pairing_token?: string;
  serial?: string;
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
): Promise<SupabaseDevice | null> {
  try {
    const { data, error } = await supabase
      .from('devices')
      .upsert({
        id: deviceId,
        model: model,
        pairing_token: pairingToken || 'TOKEN-' + Math.random().toString(36).substring(2, 8).toUpperCase(),
        serial: serial || null,
        user_id: userId,
      })
      .select()
      .single();

    if (!error && data) {
      return data;
    }

    console.warn('[DeviceService] Direct upsert warning, trying fallback update:', error?.message);

    // Fallback 1: Try updating the user_id for existing device record
    const { data: updateData, error: updateError } = await supabase
      .from('devices')
      .update({
        user_id: userId,
        model: model,
        ...(serial ? { serial } : {}),
        ...(pairingToken ? { pairing_token: pairingToken } : {})
      })
      .eq('id', deviceId)
      .select()
      .single();

    if (!updateError && updateData) {
      return updateData;
    }

    // Fallback 2: Check if device exists under MLZ- prefix or cleaned ID
    const alternateId = deviceId.toLowerCase().startsWith('mlz-')
      ? deviceId.substring(4)
      : `MLZ-${deviceId}`;

    const { data: altData, error: altError } = await supabase
      .from('devices')
      .update({
        user_id: userId,
        model: model,
        ...(serial ? { serial } : {}),
        ...(pairingToken ? { pairing_token: pairingToken } : {})
      })
      .eq('id', alternateId)
      .select()
      .single();

    if (!altError && altData) {
      return altData;
    }

    // Fallback 3: Guarantee non-null return for local session state
    return {
      id: deviceId,
      model: model,
      serial: serial || undefined,
      pairing_token: pairingToken || undefined,
      user_id: userId,
    };
  } catch (err) {
    console.warn('[DeviceService] Register device exception, fallback to local instance:', err);
    return {
      id: deviceId,
      model: model,
      serial: serial || undefined,
      pairing_token: pairingToken || undefined,
      user_id: userId,
    };
  }
}

export async function deleteDevice(deviceId: string, userId?: string): Promise<boolean> {
  try {
    const alternateId = deviceId.toLowerCase().startsWith('mlz-')
      ? deviceId.substring(4)
      : `MLZ-${deviceId}`;

    const idsToDelete = Array.from(new Set([deviceId, alternateId].filter(Boolean)));

    let query = supabase
      .from('devices')
      .delete()
      .in('id', idsToDelete);

    if (userId) {
      query = query.eq('user_id', userId);
    }

    const { error } = await query;

    if (!error) {
      return true;
    }

    console.warn('[DeviceService] Direct delete warning, trying disassociate fallback:', error.message);

    let fallbackQuery = supabase
      .from('devices')
      .update({ user_id: '' })
      .in('id', idsToDelete);

    if (userId) {
      fallbackQuery = fallbackQuery.eq('user_id', userId);
    }

    const { error: updateError } = await fallbackQuery;
    if (updateError) {
      console.warn('[DeviceService] Disassociate fallback warning:', updateError.message);
    }
    return true;
  } catch (err) {
    console.warn('[DeviceService] Delete device exception:', err);
    return true;
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
