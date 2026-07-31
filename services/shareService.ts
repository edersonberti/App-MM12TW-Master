import { supabase } from '../lib/supabase';

export type SharePermission = 'control' | 'configure';

export interface DeviceInvitePreview {
  status: 'pending' | 'accepted' | 'revoked' | 'expired' | 'invalid';
  device_id?: string;
  model?: string;
  serial?: string;
  permission?: SharePermission;
  expires_at?: string;
}

export interface CreatedInvite {
  id: string;
  token: string;
  device_id: string;
  permission: SharePermission;
  status: string;
  expires_at?: string;
}

export interface DeviceMember {
  id: string;
  device_id: string;
  user_id: string;
  permission: SharePermission;
  created_at?: string;
  email?: string | null;
  full_name?: string | null;
}

export type RegistrationCheck =
  | { status: 'available' }
  | { status: 'deleted'; device_id: string; model?: string }
  | { status: 'owned_by_you'; device_id: string; model?: string }
  | { status: 'owned_by_other'; device_id: string; model?: string }
  | { status: 'unauthenticated' }
  | { status: 'error'; message: string };

export async function checkDeviceRegistration(
  deviceId: string,
  serial?: string
): Promise<RegistrationCheck> {
  try {
    const { data, error } = await supabase.rpc('check_device_registration', {
      p_device_id: deviceId,
      p_serial: serial || null,
    });

    if (error) {
      console.error('[ShareService] check_device_registration:', error.message);
      return { status: 'error', message: error.message };
    }

    const result = data as RegistrationCheck;
    if (!result?.status) return { status: 'error', message: 'Resposta inválida' };
    return result;
  } catch (err: any) {
    return { status: 'error', message: err?.message || 'Falha ao verificar equipamento' };
  }
}

export async function createDeviceInvite(
  deviceId: string,
  permission: SharePermission
): Promise<{ invite: CreatedInvite | null; error?: string }> {
  try {
    const { data, error } = await supabase.rpc('create_device_invite', {
      p_device_id: deviceId,
      p_permission: permission,
    });

    if (error) {
      return { invite: null, error: error.message };
    }

    return { invite: data as CreatedInvite };
  } catch (err: any) {
    return { invite: null, error: err?.message || 'Falha ao criar convite' };
  }
}

export async function peekDeviceInvite(token: string): Promise<DeviceInvitePreview> {
  try {
    const { data, error } = await supabase.rpc('peek_device_invite', {
      p_token: token,
    });

    if (error || !data) {
      return { status: 'invalid' };
    }

    return data as DeviceInvitePreview;
  } catch {
    return { status: 'invalid' };
  }
}

export async function acceptDeviceInvite(
  token: string
): Promise<{ ok: true; device_id: string; permission: SharePermission } | { ok: false; error: string }> {
  try {
    const { data, error } = await supabase.rpc('accept_device_invite', {
      p_token: token,
    });

    if (error) {
      return { ok: false, error: error.message };
    }

    const result = data as { device_id: string; permission: SharePermission };
    return { ok: true, device_id: result.device_id, permission: result.permission };
  } catch (err: any) {
    return { ok: false, error: err?.message || 'Falha ao aceitar convite' };
  }
}

export async function listDeviceMembers(deviceId: string): Promise<DeviceMember[]> {
  try {
    const { data, error } = await supabase.rpc('list_device_members', {
      p_device_id: deviceId,
    });

    if (error) {
      console.error('[ShareService] listDeviceMembers:', error.message);
      return [];
    }

    return (Array.isArray(data) ? data : []) as DeviceMember[];
  } catch (err) {
    console.error('[ShareService] listDeviceMembers exception:', err);
    return [];
  }
}

export async function revokeDeviceMember(
  deviceId: string,
  userId: string
): Promise<{ ok: boolean; error?: string }> {
  try {
    const { error } = await supabase.rpc('revoke_device_member', {
      p_device_id: deviceId,
      p_user_id: userId,
    });

    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (err: any) {
    return { ok: false, error: err?.message || 'Falha ao revogar acesso' };
  }
}

export async function leaveSharedDevice(
  deviceId: string
): Promise<{ ok: boolean; error?: string }> {
  try {
    const { error } = await supabase.rpc('leave_shared_device', {
      p_device_id: deviceId,
    });

    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (err: any) {
    return { ok: false, error: err?.message || 'Falha ao sair do equipamento' };
  }
}

export function buildInviteUrl(token: string): string {
  if (typeof window === 'undefined') return `/?invite=${token}`;
  return `${window.location.origin}/?invite=${encodeURIComponent(token)}`;
}

export function buildWhatsAppShareUrl(
  inviteUrl: string,
  model: string,
  serialOrId: string,
  permission: SharePermission
): string {
  const permLabel =
    permission === 'configure'
      ? 'controle e configuração'
      : 'controle';
  const text =
    `Olá! Você foi convidado a ter acesso (${permLabel}) ao equipamento ${model} (${serialOrId}) no Master Lazer.\n\n` +
    `Abra o link em até 24 horas, entre na sua conta (ou crie uma) e aceite o convite:\n${inviteUrl}`;
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}

export const INVITE_STORAGE_KEY = 'pending_device_invite_token';
