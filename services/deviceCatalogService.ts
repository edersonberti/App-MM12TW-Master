import {
  ensureSupabaseClient,
  getSupabaseAnonKey,
  getSupabaseUrl,
} from '../lib/supabase';

export interface DeviceCatalogItem {
  id: string;
  model: string;
  motor_count: number;
  has_filter_timer: boolean;
  has_led_timer: boolean;
  has_hidro_timer: boolean;
  has_solar_heating: boolean;
  created_by?: string;
  created_at?: string;
  updated_at?: string;
}

const CATALOG_SELECT =
  'id,model,motor_count,has_filter_timer,has_led_timer,has_hidro_timer,has_solar_heating,created_by,created_at,updated_at';

function normalizeCatalogItem(row: any): DeviceCatalogItem {
  if (!row || row.id == null || row.id === '') {
    throw new Error('Resposta inválida do Supabase para devices_catalog.');
  }

  return {
    id: String(row.id),
    model: String(row.model || '').trim().toUpperCase(),
    motor_count: Number(row.motor_count) || 0,
    has_filter_timer: row.has_filter_timer === true,
    has_led_timer: row.has_led_timer === true,
    has_hidro_timer: row.has_hidro_timer === true,
    has_solar_heating: row.has_solar_heating === true,
    created_by: row.created_by ?? undefined,
    created_at: row.created_at ?? undefined,
    updated_at: row.updated_at ?? undefined,
  };
}

function buildPayload(
  model: string,
  motorCount: number,
  hasFilterTimer: boolean,
  hasLedTimer: boolean,
  hasHidroTimer: boolean,
  hasSolarHeating: boolean
) {
  return {
    model: model.trim().toUpperCase(),
    motor_count: motorCount,
    has_filter_timer: !!hasFilterTimer,
    has_led_timer: !!hasLedTimer,
    has_hidro_timer: !!hasHidroTimer,
    has_solar_heating: !!hasSolarHeating,
  };
}

function assertPayloadMatches(
  item: DeviceCatalogItem,
  payload: ReturnType<typeof buildPayload>
) {
  const mismatches: string[] = [];
  if (item.model !== payload.model) mismatches.push('model');
  if (item.motor_count !== payload.motor_count) mismatches.push('motor_count');
  if (item.has_filter_timer !== payload.has_filter_timer) mismatches.push('has_filter_timer');
  if (item.has_led_timer !== payload.has_led_timer) mismatches.push('has_led_timer');
  if (item.has_hidro_timer !== payload.has_hidro_timer) mismatches.push('has_hidro_timer');
  if (item.has_solar_heating !== payload.has_solar_heating) mismatches.push('has_solar_heating');

  if (mismatches.length > 0) {
    throw new Error(
      `Supabase não persistiu os atributos (${mismatches.join(', ')}). Recarregue o schema do PostgREST e tente de novo.`
    );
  }
}

async function getAccessToken(): Promise<string> {
  const client = ensureSupabaseClient();
  const { data, error } = await client.auth.getSession();
  if (error) {
    throw new Error(error.message || 'Falha ao validar sessão do Supabase.');
  }
  const token = data?.session?.access_token;
  if (!token) {
    throw new Error('Sessão Supabase ausente. Faça login novamente para gravar no catálogo.');
  }
  return token;
}

async function catalogFetch<T = any>(options: {
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  pathQuery: string;
  body?: Record<string, unknown>;
}): Promise<T> {
  const token = await getAccessToken();
  const baseUrl = getSupabaseUrl().replace(/\/$/, '');
  const anonKey = getSupabaseAnonKey();
  const url = `${baseUrl}/rest/v1/${options.pathQuery}`;

  const headers: Record<string, string> = {
    apikey: anonKey,
    Authorization: `Bearer ${token}`,
    Accept: 'application/json',
  };

  if (options.method !== 'GET') {
    headers['Content-Type'] = 'application/json';
    headers['Prefer'] = 'return=representation';
  }

  console.info(`[DevicesCatalogService] ${options.method} ${url}`, options.body || '');

  const response = await fetch(url, {
    method: options.method,
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  const text = await response.text();
  let json: any = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = text;
  }

  if (!response.ok) {
    const msg =
      (json && (json.message || json.error_description || json.hint)) ||
      text ||
      `HTTP ${response.status}`;
    console.error('[DevicesCatalogService] Request failed:', response.status, json);
    const err: any = new Error(typeof msg === 'string' ? msg : JSON.stringify(msg));
    err.status = response.status;
    err.code = json?.code;
    err.details = json?.details;
    throw err;
  }

  return json as T;
}

export async function fetchDeviceCatalog(): Promise<DeviceCatalogItem[]> {
  const data = await catalogFetch<any[]>({
    method: 'GET',
    pathQuery: `devices_catalog?select=${CATALOG_SELECT}&order=model.asc`,
  });

  return (Array.isArray(data) ? data : []).map(normalizeCatalogItem);
}

export async function createDeviceCatalogItem(
  model: string,
  motorCount: number,
  hasFilterTimer: boolean = true,
  hasLedTimer: boolean = true,
  hasHidroTimer: boolean = true,
  hasSolarHeating: boolean = true
): Promise<DeviceCatalogItem> {
  const payload = buildPayload(
    model,
    motorCount,
    hasFilterTimer,
    hasLedTimer,
    hasHidroTimer,
    hasSolarHeating
  );

  console.info('[DevicesCatalogService] Creating devices_catalog row:', payload);

  const data = await catalogFetch<any[]>({
    method: 'POST',
    pathQuery: `devices_catalog?select=${CATALOG_SELECT}`,
    body: payload,
  });

  const row = Array.isArray(data) ? data[0] : data;
  const created = normalizeCatalogItem(row);
  assertPayloadMatches(created, payload);

  console.info('[DevicesCatalogService] Created OK:', created);
  return created;
}

export async function updateDeviceCatalogItem(
  id: string,
  model: string,
  motorCount: number,
  hasFilterTimer: boolean = true,
  hasLedTimer: boolean = true,
  hasHidroTimer: boolean = true,
  hasSolarHeating: boolean = true
): Promise<DeviceCatalogItem> {
  if (!id || String(id).startsWith('local-') || String(id).startsWith('cat-')) {
    throw new Error('ID local inválido. Recarregue o catálogo do Supabase antes de editar.');
  }

  const payload = {
    ...buildPayload(model, motorCount, hasFilterTimer, hasLedTimer, hasHidroTimer, hasSolarHeating),
    updated_at: new Date().toISOString(),
  };

  console.info('[DevicesCatalogService] Updating devices_catalog row:', id, payload);

  const data = await catalogFetch<any[]>({
    method: 'PATCH',
    pathQuery: `devices_catalog?id=eq.${encodeURIComponent(id)}&select=${CATALOG_SELECT}`,
    body: payload,
  });

  const row = Array.isArray(data) ? data[0] : data;
  if (!row) {
    throw new Error('Nenhuma linha foi atualizada no Supabase (verifique permissão de owner).');
  }

  const updated = normalizeCatalogItem(row);
  assertPayloadMatches(updated, payload);

  console.info('[DevicesCatalogService] Updated OK:', updated);
  return updated;
}

export async function deleteDeviceCatalogItem(id: string): Promise<boolean> {
  if (!id || String(id).startsWith('local-') || String(id).startsWith('cat-')) {
    throw new Error('ID local inválido. Recarregue o catálogo do Supabase antes de excluir.');
  }

  console.info('[DevicesCatalogService] Deleting devices_catalog row:', id);

  const data = await catalogFetch<any[]>({
    method: 'DELETE',
    pathQuery: `devices_catalog?id=eq.${encodeURIComponent(id)}&select=id`,
  });

  const row = Array.isArray(data) ? data[0] : data;
  if (!row?.id) {
    throw new Error('Nenhuma linha foi removida no Supabase (verifique permissão de owner).');
  }

  return true;
}
