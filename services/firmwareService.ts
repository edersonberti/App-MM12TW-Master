import { supabase } from '../lib/supabase';

export interface FirmwareItem {
  id: string;
  model: string;
  nome: string;
  versao: string;
  storage_path: string;
  file_size: number | null;
  checksum: string | null;
  uploaded_by: string | null;
  data_upload: string;
  is_active: boolean;
}

const FIRMWARE_BUCKET = 'firmware';

function normalizeModel(model: string): string {
  return model.trim().toUpperCase();
}

function buildStoragePath(model: string, versao: string, fileName: string): string {
  const safeVersion = versao.trim().replace(/[^a-zA-Z0-9._-]/g, '_');
  const safeName = fileName.trim().replace(/[^a-zA-Z0-9._-]/g, '_') || 'firmware.bin';
  return `${normalizeModel(model)}/${safeVersion}/${safeName}`;
}

export async function fetchActiveFirmware(): Promise<FirmwareItem[]> {
  const { data, error } = await supabase
    .from('firmware')
    .select('*')
    .eq('is_active', true)
    .order('model', { ascending: true });

  if (error) {
    console.error('[FirmwareService] Error fetching active firmware:', error.message);
    return [];
  }

  return data || [];
}

export async function fetchFirmwareByModels(models: string[]): Promise<FirmwareItem[]> {
  const normalized = [...new Set(models.map(normalizeModel).filter(Boolean))];
  if (normalized.length === 0) return [];

  const { data, error } = await supabase
    .from('firmware')
    .select('*')
    .eq('is_active', true)
    .in('model', normalized)
    .order('model', { ascending: true });

  if (error) {
    console.error('[FirmwareService] Error fetching firmware by models:', error.message);
    return [];
  }

  return data || [];
}

export async function fetchAllFirmware(): Promise<FirmwareItem[]> {
  const { data, error } = await supabase
    .from('firmware')
    .select('*')
    .order('data_upload', { ascending: false });

  if (error) {
    console.error('[FirmwareService] Error fetching firmware history:', error.message);
    return [];
  }

  return data || [];
}

/** POST: new version (activates it for the model). */
export async function uploadFirmware(params: {
  model: string;
  nome: string;
  versao: string;
  file: File;
  uploadedBy?: string;
}): Promise<FirmwareItem> {
  const model = normalizeModel(params.model);
  const nome = params.nome.trim();
  const versao = params.versao.trim();

  if (!model) throw new Error('Informe o modelo do equipamento.');
  if (!nome) throw new Error('Informe o nome do firmware.');
  if (!versao) throw new Error('Informe a versão do firmware.');
  if (!params.file) throw new Error('Selecione o arquivo .bin.');

  const storagePath = buildStoragePath(model, versao, params.file.name);

  const { error: uploadError } = await supabase.storage
    .from(FIRMWARE_BUCKET)
    .upload(storagePath, params.file, {
      upsert: true,
      contentType: 'application/octet-stream',
      cacheControl: '3600',
    });

  if (uploadError) {
    console.error('[FirmwareService] Storage upload error:', uploadError.message);
    throw uploadError;
  }

  const { data, error } = await supabase
    .from('firmware')
    .insert({
      model,
      nome,
      versao,
      storage_path: storagePath,
      file_size: params.file.size,
      uploaded_by: params.uploadedBy || null,
      is_active: true,
    })
    .select()
    .single();

  if (error) {
    console.error('[FirmwareService] Insert error:', error.message);
    // Unique (model, versao) → treat as PUT
    if (error.code === '23505') {
      return updateFirmwareByModelVersion({
        model,
        versao,
        nome,
        file: params.file,
        storagePath,
        uploadedBy: params.uploadedBy,
      });
    }
    throw error;
  }

  return data;
}

/** PUT: replace active firmware metadata/file for an existing row, or same model+version. */
export async function updateFirmware(params: {
  id: string;
  nome?: string;
  versao?: string;
  file?: File;
  uploadedBy?: string;
}): Promise<FirmwareItem> {
  const { data: existing, error: fetchError } = await supabase
    .from('firmware')
    .select('*')
    .eq('id', params.id)
    .single();

  if (fetchError || !existing) {
    throw fetchError || new Error('Firmware não encontrado.');
  }

  let storagePath = existing.storage_path as string;
  let fileSize = existing.file_size as number | null;

  if (params.file) {
    const nextVersion = (params.versao || existing.versao).trim();
    storagePath = buildStoragePath(existing.model, nextVersion, params.file.name);
    const { error: uploadError } = await supabase.storage
      .from(FIRMWARE_BUCKET)
      .upload(storagePath, params.file, {
        upsert: true,
        contentType: 'application/octet-stream',
        cacheControl: '3600',
      });
    if (uploadError) throw uploadError;
    fileSize = params.file.size;
  }

  const { data, error } = await supabase
    .from('firmware')
    .update({
      nome: params.nome?.trim() || existing.nome,
      versao: params.versao?.trim() || existing.versao,
      storage_path: storagePath,
      file_size: fileSize,
      uploaded_by: params.uploadedBy ?? existing.uploaded_by,
      data_upload: new Date().toISOString(),
      is_active: true,
    })
    .eq('id', params.id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

async function updateFirmwareByModelVersion(params: {
  model: string;
  versao: string;
  nome: string;
  file: File;
  storagePath: string;
  uploadedBy?: string;
}): Promise<FirmwareItem> {
  const { data, error } = await supabase
    .from('firmware')
    .update({
      nome: params.nome,
      storage_path: params.storagePath,
      file_size: params.file.size,
      uploaded_by: params.uploadedBy || null,
      data_upload: new Date().toISOString(),
      is_active: true,
    })
    .eq('model', params.model)
    .eq('versao', params.versao)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function getFirmwareDownloadUrl(storagePath: string): Promise<string | null> {
  const { data, error } = await supabase.storage
    .from(FIRMWARE_BUCKET)
    .createSignedUrl(storagePath, 60 * 30);

  if (error) {
    console.error('[FirmwareService] Signed URL error:', error.message);
    return null;
  }

  return data?.signedUrl || null;
}

/** Public OTA base used by ESP32 devices (never expose .bin download in the phone UI). */
export const OTA_PUBLIC_BASE_URL = 'https://app-mm-12-tw-master.vercel.app/ota';

export function getOtaBaseUrl(): string {
  if (typeof window === 'undefined') return OTA_PUBLIC_BASE_URL;
  const origin = window.location.origin;
  if (/localhost|127\.0\.0\.1/i.test(origin)) {
    return OTA_PUBLIC_BASE_URL;
  }
  return `${origin}/ota`;
}

/**
 * Creates a short-lived OTA token and returns the public URL the device should fetch.
 * The phone does NOT download the .bin — only the ESP32 pulls it from /ota/.
 */
export async function createOtaUpdateUrl(item: FirmwareItem): Promise<string> {
  const signedUrl = await getFirmwareDownloadUrl(item.storage_path);
  if (!signedUrl) {
    throw new Error('Não foi possível gerar URL assinada do firmware.');
  }

  const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();
  const { data, error } = await supabase
    .from('ota_tokens')
    .insert({
      signed_url: signedUrl,
      model: item.model,
      storage_path: item.storage_path,
      expires_at: expiresAt,
    })
    .select('token')
    .single();

  if (error || !data?.token) {
    console.error('[FirmwareService] OTA token insert error:', error?.message);
    throw error || new Error('Não foi possível criar token OTA.');
  }

  return `${getOtaBaseUrl()}/?t=${encodeURIComponent(data.token)}`;
}

export async function deactivateFirmware(id: string): Promise<void> {
  const { error } = await supabase
    .from('firmware')
    .update({ is_active: false })
    .eq('id', id);

  if (error) throw error;
}
