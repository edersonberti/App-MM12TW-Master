import { supabase } from '../lib/supabase';

export interface SupabaseDevice {
  id: string;
  model: string;
  pairing_token?: string;
  serial?: string;
  user_id: string;
  status?: 'active' | 'deleted';
  deleted_at?: string | null;
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
        status: 'active',
        deleted_at: null,
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
        status: 'active',
        deleted_at: null,
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
        status: 'active',
        deleted_at: null,
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
      status: 'active',
      deleted_at: null,
    };
  } catch (err) {
    console.warn('[DeviceService] Register device exception, fallback to local instance:', err);
    return {
      id: deviceId,
      model: model,
      serial: serial || undefined,
      pairing_token: pairingToken || undefined,
      user_id: userId,
      status: 'active',
      deleted_at: null,
    };
  }
}

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
 * Soft-deletes a device (status = deleted). Keeps the row in Supabase
 * so the equipment can be reassociated later without a hard DELETE.
 */
export async function deleteDevice(deviceId: string, userId?: string): Promise<boolean> {
  try {
    const rawId = (deviceId || '').trim();
    if (!rawId) return true;

    const clean = cleanDeviceIdStr(rawId);
    const isMlz = rawId.toLowerCase().startsWith('mlz-');
    const withoutMlz = isMlz ? rawId.substring(4) : rawId;
    const withMlz = isMlz ? rawId : `MLZ-${rawId}`;
    const cleanWithoutMlz = cleanDeviceIdStr(withoutMlz);
    const cleanWithMlz = `MLZ-${cleanWithoutMlz}`;

    const candidates = new Set<string>([
      rawId,
      rawId.toLowerCase(),
      rawId.toUpperCase(),
      clean,
      clean.toLowerCase(),
      clean.toUpperCase(),
      withoutMlz,
      withoutMlz.toLowerCase(),
      withoutMlz.toUpperCase(),
      withMlz,
      withMlz.toLowerCase(),
      withMlz.toUpperCase(),
      cleanWithoutMlz,
      cleanWithoutMlz.toLowerCase(),
      cleanWithoutMlz.toUpperCase(),
      cleanWithMlz,
      cleanWithMlz.toLowerCase(),
      cleanWithMlz.toUpperCase(),
    ]);

    const dbIdsToSoftDelete = Array.from(candidates);
    try {
      let query = supabase.from('devices').select('id, user_id, status');
      if (userId) {
        query = query.eq('user_id', userId);
      }
      const { data: dbDevices } = await query;
      if (dbDevices && dbDevices.length > 0) {
        const cleanTarget = clean.toLowerCase();
        const withoutMlzLower = withoutMlz.toLowerCase();
        for (const d of dbDevices) {
          const dClean = cleanDeviceIdStr(d.id).toLowerCase();
          const dLower = d.id.toLowerCase();
          if (
            dLower === rawId.toLowerCase() ||
            (cleanTarget && dClean === cleanTarget) ||
            (cleanTarget && dLower.includes(cleanTarget)) ||
            (withoutMlzLower && dLower.includes(withoutMlzLower))
          ) {
            dbIdsToSoftDelete.push(d.id);
          }
        }
      }
    } catch (e) {
      console.warn('[DeviceService] Query devices for soft-delete warning:', e);
    }

    const uniqueIds = Array.from(new Set(dbIdsToSoftDelete.filter(Boolean)));
    const softDeletePayload = {
      status: 'deleted',
      deleted_at: new Date().toISOString(),
    };

    let updateQuery = supabase
      .from('devices')
      .update(softDeletePayload)
      .in('id', uniqueIds)
      .eq('status', 'active');

    if (userId) {
      updateQuery = updateQuery.eq('user_id', userId);
    }

    const { error: softDeleteError, data } = await updateQuery.select('id');

    if (softDeleteError) {
      console.warn('[DeviceService] Soft-delete error:', softDeleteError.message);
      return false;
    }

    console.log('[DeviceService] Soft-deleted device(s):', data?.map((d: { id: string }) => d.id) || uniqueIds);
    return true;
  } catch (err) {
    console.warn('[DeviceService] Soft-delete device exception:', err);
    return false;
  }
}

export async function updateDeviceOwner(deviceId: string, userId: string): Promise<SupabaseDevice | null> {
  try {
    const { data, error } = await supabase
      .from('devices')
      .update({
        user_id: userId,
        status: 'active',
        deleted_at: null,
      })
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
