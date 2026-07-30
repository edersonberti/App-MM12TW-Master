import { supabase } from '../lib/supabase';
import { checkDeviceRegistration, type SharePermission } from './shareService';

export interface SupabaseDevice {
  id: string;
  model: string;
  pairing_token?: string;
  serial?: string;
  user_id: string;
  /** owner = registered by this user; shared = access via invite */
  access?: 'owner' | 'shared';
  permission?: SharePermission | 'owner';
}

export type RegisterDeviceResult =
  | { ok: true; device: SupabaseDevice }
  | { ok: false; code: 'owned_by_other' | 'failed'; message: string };

export async function fetchUserDevices(userId: string): Promise<SupabaseDevice[]> {
  try {
    const { data: owned, error: ownedError } = await supabase
      .from('devices')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'active')
      .order('created_at', { ascending: true });

    if (ownedError) {
      console.error('[DeviceService] Error fetching owned devices:', ownedError.message);
    }

    const { data: memberships, error: memberError } = await supabase
      .from('device_members')
      .select('permission, devices:device_id(*)')
      .eq('user_id', userId);

    if (memberError) {
      console.error('[DeviceService] Error fetching shared devices:', memberError.message);
    }

    const byId = new Map<string, SupabaseDevice>();

    for (const row of owned || []) {
      byId.set(row.id, {
        ...row,
        access: 'owner',
        permission: 'owner',
      });
    }

    for (const row of memberships || []) {
      const rawDevice = (row as any).devices;
      const device = Array.isArray(rawDevice) ? rawDevice[0] : rawDevice;
      if (!device || device.status !== 'active') continue;
      if (byId.has(device.id)) continue;
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

    return Array.from(byId.values());
  } catch (err) {
    console.error('[DeviceService] Fetch devices error:', err);
    return [];
  }
}

export interface SupabaseDeviceWithOwner extends SupabaseDevice {
  owner_email?: string | null;
}

/** Owner/admin: all active devices (RLS allows elevated profiles). */
export async function fetchAllActiveDevices(): Promise<SupabaseDeviceWithOwner[]> {
  try {
    const { data, error } = await supabase
      .from('devices')
      .select('id, model, pairing_token, serial, user_id, profiles:user_id(email)')
      .eq('status', 'active')
      .order('created_at', { ascending: true });

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
): Promise<RegisterDeviceResult> {
  try {
    const check = await checkDeviceRegistration(deviceId, serial || undefined);

    if (check.status === 'owned_by_other') {
      return {
        ok: false,
        code: 'owned_by_other',
        message:
          'Este equipamento já está cadastrado na conta de outro usuário. Peça ao dono para compartilhar o acesso com você.',
      };
    }

    if (check.status === 'error') {
      return { ok: false, code: 'failed', message: check.message };
    }

    if (check.status === 'unauthenticated') {
      return { ok: false, code: 'failed', message: 'Sessão expirada. Faça login novamente.' };
    }

    // Soft-deleted — reactivate and assign to current user
    if (check.status === 'deleted') {
      const { data: revived, error: reviveError } = await supabase.rpc('reactivate_deleted_device', {
        p_device_id: check.device_id,
        p_model: model,
        p_serial: serial || null,
        p_pairing_token: pairingToken || null,
      });

      if (reviveError) {
        console.error('[DeviceService] reactivate_deleted_device:', reviveError.message);
        return { ok: false, code: 'failed', message: reviveError.message };
      }

      const device = revived as SupabaseDevice;
      return { ok: true, device: { ...device, access: 'owner', permission: 'owner' } };
    }

    // Already yours — refresh metadata and return
    if (check.status === 'owned_by_you') {
      const { data: updated, error: updateError } = await supabase
        .from('devices')
        .update({
          model,
          ...(serial ? { serial } : {}),
          ...(pairingToken ? { pairing_token: pairingToken } : {}),
        })
        .eq('id', check.device_id)
        .eq('user_id', userId)
        .select()
        .maybeSingle();

      if (updateError) {
        return { ok: false, code: 'failed', message: updateError.message };
      }

      if (updated) {
        return { ok: true, device: { ...updated, access: 'owner', permission: 'owner' } };
      }

      // Fallback: fetch existing
      const { data: existing } = await supabase
        .from('devices')
        .select('*')
        .eq('id', check.device_id)
        .maybeSingle();

      if (existing) {
        return { ok: true, device: { ...existing, access: 'owner', permission: 'owner' } };
      }

      return { ok: false, code: 'failed', message: 'Não foi possível atualizar o equipamento.' };
    }

    // available — insert new row
    const { data, error } = await supabase
      .from('devices')
      .insert({
        id: deviceId,
        model,
        pairing_token:
          pairingToken || 'TOKEN-' + Math.random().toString(36).substring(2, 8).toUpperCase(),
        serial: serial || null,
        user_id: userId,
        status: 'active',
      })
      .select()
      .single();

    if (!error && data) {
      return { ok: true, device: { ...data, access: 'owner', permission: 'owner' } };
    }

    // Race / unique conflict — re-check (may now be deleted/owned)
    const recheck = await checkDeviceRegistration(deviceId, serial || undefined);
    if (recheck.status === 'owned_by_other') {
      return {
        ok: false,
        code: 'owned_by_other',
        message:
          'Este equipamento já está cadastrado na conta de outro usuário. Peça ao dono para compartilhar o acesso com você.',
      };
    }
    if (recheck.status === 'owned_by_you') {
      const { data: existing } = await supabase
        .from('devices')
        .select('*')
        .eq('id', recheck.device_id)
        .maybeSingle();
      if (existing) {
        return { ok: true, device: { ...existing, access: 'owner', permission: 'owner' } };
      }
    }
    if (recheck.status === 'deleted') {
      const { data: revived, error: reviveError } = await supabase.rpc('reactivate_deleted_device', {
        p_device_id: recheck.device_id,
        p_model: model,
        p_serial: serial || null,
        p_pairing_token: pairingToken || null,
      });
      if (!reviveError && revived) {
        const device = revived as SupabaseDevice;
        return { ok: true, device: { ...device, access: 'owner', permission: 'owner' } };
      }
      return {
        ok: false,
        code: 'failed',
        message: reviveError?.message || 'Não foi possível reativar o equipamento.',
      };
    }

    console.error('[DeviceService] Register device failed:', error?.message);
    return {
      ok: false,
      code: 'failed',
      message: error?.message || 'Não foi possível associar este equipamento à sua conta.',
    };
  } catch (err: any) {
    console.error('[DeviceService] Register device exception:', err);
    return {
      ok: false,
      code: 'failed',
      message: err?.message || 'Erro inesperado ao cadastrar equipamento.',
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

async function resolveActiveDeviceIds(deviceId: string): Promise<string[]> {
  const rawId = (deviceId || '').trim();
  if (!rawId) return [];

  const clean = cleanDeviceIdStr(rawId);
  const isMlz = rawId.toLowerCase().startsWith('mlz-');
  const withoutMlz = isMlz ? rawId.substring(4) : rawId;
  const cleanTarget = clean.toLowerCase();
  const withoutMlzLower = withoutMlz.toLowerCase();
  const matched = new Set<string>();

  const { data: dbDevices, error } = await supabase
    .from('devices')
    .select('id')
    .eq('status', 'active');

  if (error) {
    console.warn('[DeviceService] Query devices for soft delete warning:', error.message);
    return [rawId];
  }

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

  if (matched.size === 0) matched.add(rawId);
  return Array.from(matched);
}

/**
 * Soft-deletes a device: sets status='deleted', deleted_at, and writes audit_events
 * via public.soft_delete_device RPC (no hard DELETE).
 */
export async function deleteDevice(deviceId: string, _userId?: string): Promise<boolean> {
  try {
    const targetIds = await resolveActiveDeviceIds(deviceId);
    if (targetIds.length === 0) return true;

    let anySuccess = false;
    for (const targetId of targetIds) {
      const { error } = await supabase.rpc('soft_delete_device', {
        target_device_id: targetId,
      });

      if (error) {
        console.warn('[DeviceService] soft_delete_device failed for', targetId, error.message);
        continue;
      }

      console.log('[DeviceService] Soft-deleted device:', targetId);
      anySuccess = true;
    }

    return anySuccess;
  } catch (err) {
    console.warn('[DeviceService] Soft delete device exception:', err);
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
