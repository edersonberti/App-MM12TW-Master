import { supabase } from '../lib/supabase';
import type { SharePermission } from './shareService';

export interface SupabaseDevice {
  id: string;
  model: string;
  pairing_token?: string;
  serial?: string;
  user_id: string;
  /** owner = registered by this user; shared = access granted via invite */
  access?: 'owner' | 'shared';
  permission?: SharePermission | 'owner';
}

export interface SupabaseDeviceWithOwner extends SupabaseDevice {
  owner_email?: string | null;
}

/**
 * Fetches devices owned by the user plus any devices shared with them
 * (via device_members / invite acceptance). Owned devices always win on id conflicts.
 */
export async function fetchUserDevices(userId: string): Promise<SupabaseDevice[]> {
  try {
    const { data: owned, error } = await supabase
      .from('devices')
      .select('*')
      .eq('user_id', userId);

    if (error) {
      console.error('[DeviceService] Error fetching devices:', error.message);
    }

    const byId = new Map<string, SupabaseDevice>();
    for (const row of owned || []) {
      byId.set(row.id, { ...row, access: 'owner', permission: 'owner' });
    }

    try {
      const { data: memberships, error: memberError } = await supabase
        .from('device_members')
        .select('permission, devices:device_id(*)')
        .eq('user_id', userId);

      if (memberError) {
        console.warn('[DeviceService] Error fetching shared devices:', memberError.message);
      } else {
        for (const row of memberships || []) {
          const rawDevice = (row as any).devices;
          const device = Array.isArray(rawDevice) ? rawDevice[0] : rawDevice;
          if (!device || byId.has(device.id)) continue;
          const permission: SharePermission =
            (row as any).permission === 'configure' ? 'configure' : 'control';
          byId.set(device.id, {
            id: device.id,
            model: device.model,
            pairing_token: device.pairing_token,
            serial: device.serial,
            user_id: device.user_id,
            access: 'shared',
            permission,
          });
        }
      }
    } catch (memberErr) {
      console.warn('[DeviceService] Shared devices lookup exception (device_members):', memberErr);
    }

    return Array.from(byId.values());
  } catch (err) {
    console.error('[DeviceService] Fetch devices error:', err);
    return [];
  }
}

/** Owner/admin/support: all registered devices, with the owning user's email attached. */
export async function fetchAllActiveDevices(): Promise<SupabaseDeviceWithOwner[]> {
  try {
    const { data, error } = await supabase
      .from('devices')
      .select('id, model, pairing_token, serial, user_id, profiles:user_id(email)');

    if (error) {
      console.error('[DeviceService] Error fetching all devices:', error.message);
      return [];
    }

    return (data || []).map((row: any) => ({
      id: row.id,
      model: row.model,
      pairing_token: row.pairing_token,
      serial: row.serial,
      user_id: row.user_id,
      owner_email: row.profiles?.email ?? null,
      access: 'owner' as const,
      permission: 'owner' as const,
    }));
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

    // Query Supabase to find any device IDs that match by clean ID
    const dbIdsToDelete = Array.from(candidates);
    try {
      const { data: dbDevices } = await supabase.from('devices').select('id, user_id');
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
            dbIdsToDelete.push(d.id);
          }
        }
      }
    } catch (e) {
      console.warn('[DeviceService] Query devices for deletion warning:', e);
    }

    const uniqueIds = Array.from(new Set(dbIdsToDelete.filter(Boolean)));

    // 1. Delete associated settings first to prevent foreign key constraint failures
    try {
      await supabase
        .from('device_settings')
        .delete()
        .in('device_id', uniqueIds);
    } catch (e) {
      console.warn('[DeviceService] Delete device_settings warning:', e);
    }

    // 2. Delete devices from devices table (first try with userId filter if provided)
    if (userId) {
      try {
        await supabase
          .from('devices')
          .delete()
          .in('id', uniqueIds)
          .eq('user_id', userId);
      } catch (e) {
        console.warn('[DeviceService] User-filtered delete warning:', e);
      }
    }

    // Direct delete by id in case user_id is null or different in DB
    const { error: directDeleteError } = await supabase
      .from('devices')
      .delete()
      .in('id', uniqueIds);

    if (!directDeleteError) {
      console.log('[DeviceService] Successfully deleted device(s) from Supabase by ID:', uniqueIds);
      return true;
    }

    console.warn('[DeviceService] Direct delete error, trying disassociate user_id = null fallback:', directDeleteError.message);

    // 3. Fallback: disassociate user_id = null so it stops appearing for this user
    await supabase
      .from('devices')
      .update({ user_id: null })
      .in('id', uniqueIds);

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
