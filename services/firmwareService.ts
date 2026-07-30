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
    .createSignedUrl(storagePath, 60 * 15);

  if (error) {
    console.error('[FirmwareService] Signed URL error:', error.message);
    return null;
  }

  return data?.signedUrl || null;
}

export async function downloadFirmwareFile(item: FirmwareItem): Promise<void> {
  const { data, error } = await supabase.storage
    .from(FIRMWARE_BUCKET)
    .download(item.storage_path);

  if (error || !data) {
    throw error || new Error('Não foi possível baixar o firmware.');
  }

  const url = URL.createObjectURL(data);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `${item.model}_${item.versao}.bin`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export async function deactivateFirmware(id: string): Promise<void> {
  const { error } = await supabase
    .from('firmware')
    .update({ is_active: false })
    .eq('id', id);

  if (error) throw error;
}
