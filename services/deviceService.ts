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
      .eq('user_id', userId)
      .neq('status', 'deleted');

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
          if (device.status === 'deleted') continue;
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
      .select('id, model, pairing_token, serial, user_id, status, profiles:user_id(email)')
      .neq('status', 'deleted');

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

/**
 * Soft-deletes a device via `soft_delete_device` RPC.
 * Sets status=deleted + deleted_at and writes audit_events (device_soft_deleted).
 * Hard DELETE is intentionally avoided — there is no DELETE RLS policy on devices.
 */
export async function deleteDevice(deviceId: string, _userId?: string): Promise<boolean> {
  try {
    const rawId = (deviceId || '').trim();
    if (!rawId) return true;

    const resolvedIds = await resolveActiveDeviceIds(rawId);
    if (resolvedIds.length === 0) {
      console.warn('[DeviceService] No active device found to soft-delete for:', rawId);
      return false;
    }

    let anySuccess = false;
    for (const id of resolvedIds) {
      const { data, error } = await supabase.rpc('soft_delete_device', {
        target_device_id: id,
      });

      if (error) {
        console.error('[DeviceService] soft_delete_device failed for', id, error.message);
        continue;
      }

      if (data === true || data === null) {
        console.log('[DeviceService] Soft-deleted device:', id);
        anySuccess = true;
      } else {
        console.warn('[DeviceService] soft_delete_device returned false for', id);
      }
    }

    return anySuccess;
  } catch (err) {
    console.error('[DeviceService] Delete device exception:', err);
    return false;
  }
}

/** Find active device row IDs that match the given id (MLZ prefix / clean variants). */
async function resolveActiveDeviceIds(rawId: string): Promise<string[]> {
  const clean = cleanDeviceIdStr(rawId);
  const isMlz = rawId.toLowerCase().startsWith('mlz-');
  const withoutMlz = isMlz ? rawId.substring(4) : rawId;
  const withMlz = isMlz ? rawId : `MLZ-${rawId}`;
  const cleanWithoutMlz = cleanDeviceIdStr(withoutMlz);
  const cleanWithMlz = `MLZ-${cleanWithoutMlz}`;

  const candidates = new Set<string>([
    rawId,
    clean,
    withoutMlz,
    withMlz,
    cleanWithoutMlz,
    cleanWithMlz,
  ]);

  const matched = new Set<string>();

  // Exact id matches first
  try {
    const { data } = await supabase
      .from('devices')
      .select('id, status')
      .in('id', Array.from(candidates))
      .neq('status', 'deleted');

    for (const d of data || []) {
      matched.add(d.id);
    }
  } catch (e) {
    console.warn('[DeviceService] Exact id lookup warning:', e);
  }

  if (matched.size > 0) return Array.from(matched);

  // Fuzzy fallback (legacy id formats)
  try {
    const { data: dbDevices } = await supabase
      .from('devices')
      .select('id, status')
      .neq('status', 'deleted');

    const cleanTarget = clean.toLowerCase();
    const withoutMlzLower = withoutMlz.toLowerCase();
    for (const d of dbDevices || []) {
      const dClean = cleanDeviceIdStr(d.id).toLowerCase();
      const dLower = d.id.toLowerCase();
      if (
        dLower === rawId.toLowerCase() ||
        (cleanTarget && dClean === cleanTarget) ||
        (cleanTarget && dLower.includes(cleanTarget)) ||
        (withoutMlzLower && dLower.includes(withoutMlzLower))
      ) {
        matched.add(d.id);
      }
    }
  } catch (e) {
    console.warn('[DeviceService] Fuzzy device lookup warning:', e);
  }

  return Array.from(matched);
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
