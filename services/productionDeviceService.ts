import { supabase } from '../lib/supabase';

export type ProductionDeviceStatus = 'available' | 'claimed' | 'disabled';

export interface ProductionDevice {
  serial: string;
  model: string;
  status: ProductionDeviceStatus;
  hw?: string | null;
  fw?: string | null;
  manufactured_at?: string | null;
  claimed_by?: string | null;
  claimed_at?: string | null;
  created_at?: string | null;
  /** Never expose provision to non-staff UI lists if avoidable; staff may see masked. */
  provision?: string | null;
  owner_email?: string | null;
}

export interface ProductionModelStats {
  model: string;
  produced: number;
  available: number;
  claimed: number;
  disabled: number;
  unique_users: number;
}

export interface ProductionQrPayload {
  serial: string;
  provision: string;
  model: string;
  hw?: string;
  fw?: string;
  date?: string;
  ssid?: string;
  password?: string;
}

export interface ClaimedDevice {
  id: string;
  model: string;
  serial?: string;
  pairing_token?: string;
  user_id: string;
}

export type ClaimResult =
  | { ok: true; device: ClaimedDevice }
  | { ok: false; error: 'unrecognized' | 'unauthenticated' | string };

export type RegisterProductionResult =
  | {
      ok: true;
      serial: string;
      model: string;
      status: ProductionDeviceStatus;
      hw?: string | null;
      fw?: string | null;
      manufactured_at?: string | null;
    }
  | { ok: false; error: string; model?: string };

const GENERIC_UNRECOGNIZED = 'Dispositivo não reconhecido';

export function getUnrecognizedDeviceMessage(): string {
  return GENERIC_UNRECOGNIZED;
}

/** Parse factory production QR JSON. Ignores Wi-Fi credentials (ssid/password). */
export function parseProductionQrPayload(text: string): ProductionQrPayload | null {
  try {
    const parsed = JSON.parse(text.trim());
    if (!parsed || typeof parsed !== 'object') return null;

    const serial = String(parsed.serial || '').trim();
    const provision = String(parsed.provision || parsed.pairing_token || parsed.token || '').trim();
    let model = String(parsed.model || '').trim().toUpperCase();

    if (!serial || !provision) return null;

    if (!model) {
      const modelMatch = serial.match(/(MM\d+T?S?W?)/i);
      model = modelMatch ? modelMatch[1].toUpperCase() : '';
    }

    if (!model) return null;

    return {
      serial: serial.toUpperCase(),
      provision,
      model,
      hw: parsed.hw != null ? String(parsed.hw) : undefined,
      fw: parsed.fw != null ? String(parsed.fw) : undefined,
      date: parsed.date != null ? String(parsed.date) : undefined,
    };
  } catch {
    return null;
  }
}

export async function registerProductionDeviceFromQr(
  payload: ProductionQrPayload
): Promise<RegisterProductionResult> {
  try {
    const { data, error } = await supabase.rpc('register_production_device', {
      p_serial: payload.serial,
      p_provision: payload.provision,
      p_model: payload.model,
      p_hw: payload.hw || null,
      p_fw: payload.fw || null,
      p_manufactured_at: payload.date || null,
    });

    if (error) {
      console.error('[ProductionDeviceService] register_production_device:', error.message);
      return { ok: false, error: error.message };
    }

    const result = data as RegisterProductionResult;
    if (!result?.ok) {
      return {
        ok: false,
        error: (result as any)?.error || 'Falha ao cadastrar na produção',
        model: (result as any)?.model,
      };
    }
    return result;
  } catch (err: any) {
    return { ok: false, error: err?.message || 'Falha ao cadastrar na produção' };
  }
}

export async function claimProductionDevice(
  serial: string,
  provision: string,
  model?: string
): Promise<ClaimResult> {
  try {
    const { data, error } = await supabase.rpc('claim_production_device', {
      p_serial: serial,
      p_provision: provision,
      p_model: model || null,
    });

    if (error) {
      console.error('[ProductionDeviceService] claim_production_device:', error.message);
      return { ok: false, error: 'unrecognized' };
    }

    if (!data?.ok || !data?.device) {
      return { ok: false, error: data?.error === 'unauthenticated' ? 'unauthenticated' : 'unrecognized' };
    }

    const device = data.device as ClaimedDevice;
    return {
      ok: true,
      device: {
        id: device.id,
        model: device.model,
        serial: device.serial,
        pairing_token: device.pairing_token,
        user_id: device.user_id,
      },
    };
  } catch (err) {
    console.error('[ProductionDeviceService] claim exception:', err);
    return { ok: false, error: 'unrecognized' };
  }
}

export async function fetchProductionDevices(): Promise<ProductionDevice[]> {
  try {
    const { data, error } = await supabase
      .from('production_devices')
      .select(
        'serial, model, status, hw, fw, manufactured_at, claimed_by, claimed_at, created_at, provision, profiles:claimed_by(email)'
      )
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[ProductionDeviceService] fetchProductionDevices:', error.message);
      return [];
    }

    return (data || []).map((row: any) => ({
      serial: row.serial,
      model: row.model,
      status: row.status,
      hw: row.hw,
      fw: row.fw,
      manufactured_at: row.manufactured_at,
      claimed_by: row.claimed_by,
      claimed_at: row.claimed_at,
      created_at: row.created_at,
      provision: row.provision
        ? `${String(row.provision).slice(0, 8)}…`
        : null,
      owner_email: row.profiles?.email ?? null,
    }));
  } catch (err) {
    console.error('[ProductionDeviceService] fetch exception:', err);
    return [];
  }
}

export async function fetchProductionStatsByModel(): Promise<ProductionModelStats[]> {
  try {
    const { data, error } = await supabase.rpc('production_stats_by_model');

    if (error) {
      console.error('[ProductionDeviceService] production_stats_by_model:', error.message);
      return [];
    }

    const rows = Array.isArray(data) ? data : [];
    return rows.map((row: any) => ({
      model: String(row.model || ''),
      produced: Number(row.produced) || 0,
      available: Number(row.available) || 0,
      claimed: Number(row.claimed) || 0,
      disabled: Number(row.disabled) || 0,
      unique_users: Number(row.unique_users) || 0,
    }));
  } catch (err) {
    console.error('[ProductionDeviceService] stats exception:', err);
    return [];
  }
}

export async function setProductionDeviceStatus(
  serial: string,
  status: ProductionDeviceStatus
): Promise<boolean> {
  try {
    const patch: Record<string, unknown> = {
      status,
      updated_at: new Date().toISOString(),
    };
    if (status !== 'claimed') {
      patch.claimed_by = null;
      patch.claimed_at = null;
    }

    const { error } = await supabase
      .from('production_devices')
      .update(patch)
      .eq('serial', serial);

    if (error) {
      console.error('[ProductionDeviceService] setStatus:', error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.error('[ProductionDeviceService] setStatus exception:', err);
    return false;
  }
}
