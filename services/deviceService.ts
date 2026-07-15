import { supabase } from '../lib/supabase';

export interface SupabaseDevice {
  id: string;
  model: string;
  pairing_token?: string | null;
  serial?: string | null;
  qr_version?: number | null;
  local_url?: string | null;
  user_id: string;
  created_at?: string;
}

export interface RegisterDevicePayload {
  id: string;
  model: string;
  userId: string;
  pairingToken?: string;
  serial?: string;
  qrVersion?: number;
  localUrl?: string;
}

/** Extrai modelo (ex: MM12TW) a partir do número de série do QR. */
export function extractModelFromSerial(serial: string, fallback = 'MM12TW'): string {
  const match = serial.match(/MM\d+[A-Z]*/i);
  return match ? match[0].toUpperCase() : fallback;
}

/**
 * Interpreta o payload do QR Code do equipamento.
 * Formato atual (v=1):
 * { "v":1, "serial":"MLZ-MM12TW-...", "token":"MLZ-...", "local":"http://192.168.4.1" }
 */
export function parseEquipmentQrPayload(raw: unknown): RegisterDevicePayload | null {
  if (!raw || typeof raw !== 'object') return null;

  const data = raw as Record<string, unknown>;
  const serial = typeof data.serial === 'string' ? data.serial.trim() : '';
  const token = typeof data.token === 'string' ? data.token.trim() : '';
  const local = typeof data.local === 'string' ? data.local.trim() : '';
  const versionRaw = data.v ?? data.qr_version ?? data.version;
  const qrVersion =
    typeof versionRaw === 'number'
      ? versionRaw
      : typeof versionRaw === 'string' && versionRaw.trim() !== ''
        ? Number(versionRaw)
        : undefined;

  // Novo formato com serial + token
  if (serial && token) {
    const modelFromField = typeof data.model === 'string' ? data.model.trim() : '';
    return {
      id: serial,
      model: modelFromField || extractModelFromSerial(serial),
      userId: '',
      pairingToken: token,
      serial,
      qrVersion: Number.isFinite(qrVersion) ? qrVersion : undefined,
      localUrl: local || undefined,
    };
  }

  // Compatibilidade com formato antigo { deviceId, model, serial, ... }
  const deviceId =
    typeof data.deviceId === 'string'
      ? data.deviceId.trim()
      : typeof data.id === 'string'
        ? data.id.trim()
        : '';

  if (!deviceId && !(typeof data.model === 'string' && serial)) return null;

  const resolvedId =
    deviceId ||
    `${String(data.model).trim()}-${serial}`;

  const model =
    (typeof data.model === 'string' && data.model.trim()) ||
    extractModelFromSerial(resolvedId);

  return {
    id: resolvedId,
    model,
    userId: '',
    pairingToken:
      (typeof data.pairing_token === 'string' && data.pairing_token.trim()) ||
      (typeof data.token === 'string' && data.token.trim()) ||
      serial ||
      undefined,
    serial: serial || undefined,
    qrVersion: Number.isFinite(qrVersion) ? qrVersion : undefined,
    localUrl: local || undefined,
  };
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
  deviceIdOrPayload: string | RegisterDevicePayload,
  model?: string,
  userId?: string,
  pairingToken: string = ''
): Promise<{ data: SupabaseDevice | null; error: string | null }> {
  try {
    const payload: RegisterDevicePayload =
      typeof deviceIdOrPayload === 'string'
        ? {
            id: deviceIdOrPayload,
            model: model || 'MM12TW',
            userId: userId || '',
            pairingToken,
          }
        : deviceIdOrPayload;

    if (!payload.id || !payload.userId) {
      return { data: null, error: 'ID do equipamento e usuário são obrigatórios.' };
    }

    const row: Record<string, unknown> = {
      id: payload.id,
      model: payload.model || 'MM12TW',
      pairing_token:
        payload.pairingToken ||
        'TOKEN-' + Math.random().toString(36).substring(2, 8).toUpperCase(),
      user_id: payload.userId,
    };

    if (payload.serial !== undefined) row.serial = payload.serial;
    if (payload.qrVersion !== undefined) row.qr_version = payload.qrVersion;
    if (payload.localUrl !== undefined) row.local_url = payload.localUrl;

    const { data, error } = await supabase
      .from('devices')
      .upsert(row, { onConflict: 'id' })
      .select()
      .single();

    if (error) {
      console.error('[DeviceService] Error registering device:', error.message, error);
      return { data: null, error: error.message };
    }
    return { data, error: null };
  } catch (err: any) {
    console.error('[DeviceService] Register device error:', err);
    return { data: null, error: err?.message || 'Falha ao registrar equipamento.' };
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
