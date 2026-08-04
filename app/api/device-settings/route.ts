import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const cleanCredential = (val: string): string => {
  if (!val) return '';
  let cleaned = val.trim();
  if (
    (cleaned.startsWith('"') && cleaned.endsWith('"')) ||
    (cleaned.startsWith("'") && cleaned.endsWith("'"))
  ) {
    cleaned = cleaned.slice(1, -1).trim();
  }
  return cleaned;
};

const DEFAULT_URL = 'https://bjkjyaejzlatdclpcdjs.supabase.co';
const DEFAULT_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJqa2p5YWVqemxhdGRjbHBjZGpzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI5MzQwOTUsImV4cCI6MjA5ODUxMDA5NX0.BTlT9PtnXmBxejXJGmQBfPGhf82V4t7_RoO7MOlR7YY';

function resolveSupabaseConfig() {
  let url = cleanCredential(process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '');
  let key = cleanCredential(
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
      process.env.SUPABASE_ANON_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
      process.env.SUPABASE_PUBLISHABLE_KEY ||
      ''
  );
  if (!url || !key || !key.startsWith('eyJ')) {
    url = DEFAULT_URL;
    key = DEFAULT_KEY;
  }
  return { url, key };
}

function createUserClient(req: NextRequest) {
  const authHeader = req.headers.get('authorization') || '';
  const { url, key } = resolveSupabaseConfig();
  return createClient(url, key, {
    global: {
      headers: authHeader ? { Authorization: authHeader } : {},
    },
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

const SOLAR_MODES = new Set(['off', 'manual', 'auto']);
const HEATING_TYPES = new Set(['solar', 'eletrico']);

function sanitizeSettingsPatch(body: Record<string, unknown>) {
  const patch: Record<string, unknown> = {};

  const copyText = (key: string) => {
    if (body[key] === undefined) return;
    patch[key] = body[key] === null ? null : String(body[key]);
  };

  [
    'motor1_name',
    'motor2_name',
    'motor3_name',
    'motor4_name',
    'motor5_name',
    'motor6_name',
    'motor7_name',
    'motor8_name',
    'filter_init1',
    'filter_hours1',
    'filter_init2',
    'filter_hours2',
    'led_start_hour',
    'led_start_minute',
    'led_duration',
    'led_program',
    'hidro_timer_hours',
  ].forEach(copyText);

  if (body.filter_days !== undefined) {
    patch.filter_days = body.filter_days;
  }
  if (body.hidro_timer_enabled !== undefined) {
    patch.hidro_timer_enabled = Boolean(body.hidro_timer_enabled);
  }

  if (body.solar_work_mode !== undefined) {
    const mode = String(body.solar_work_mode);
    if (!SOLAR_MODES.has(mode)) {
      return { error: 'solar_work_mode inválido (off|manual|auto)' };
    }
    patch.solar_work_mode = mode;
  }
  if (body.solar_heating_type !== undefined) {
    const type = String(body.solar_heating_type);
    if (!HEATING_TYPES.has(type)) {
      return { error: 'solar_heating_type inválido (solar|eletrico)' };
    }
    patch.solar_heating_type = type;
  }
  if (body.solar_pool_max !== undefined) {
    const n = Number(body.solar_pool_max);
    if (!Number.isFinite(n) || n < 25 || n > 40) {
      return { error: 'solar_pool_max deve ser entre 25 e 40' };
    }
    patch.solar_pool_max = Math.round(n);
  }
  if (body.solar_dif !== undefined) {
    const n = Number(body.solar_dif);
    if (!Number.isFinite(n) || n < 2 || n > 20) {
      return { error: 'solar_dif deve ser entre 2 e 20' };
    }
    patch.solar_dif = Math.round(n);
  }

  return { patch };
}

/** GET /api/device-settings?device_id=... */
export async function GET(req: NextRequest) {
  const deviceId = (req.nextUrl.searchParams.get('device_id') || '').trim();
  if (!deviceId) {
    return NextResponse.json({ error: 'device_id é obrigatório' }, { status: 400 });
  }

  const authHeader = req.headers.get('authorization') || '';
  if (!authHeader.toLowerCase().startsWith('bearer ')) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
  }

  const supabase = createUserClient(req);
  const { data, error } = await supabase
    .from('device_settings')
    .select('*')
    .eq('device_id', deviceId)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ settings: data });
}

/** PUT /api/device-settings — upsert settings for a device (RLS via user JWT) */
export async function PUT(req: NextRequest) {
  const authHeader = req.headers.get('authorization') || '';
  if (!authHeader.toLowerCase().startsWith('bearer ')) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }

  const deviceId = String(body.device_id || '').trim();
  if (!deviceId) {
    return NextResponse.json({ error: 'device_id é obrigatório' }, { status: 400 });
  }

  const sanitized = sanitizeSettingsPatch(body);
  if ('error' in sanitized && sanitized.error) {
    return NextResponse.json({ error: sanitized.error }, { status: 400 });
  }

  const supabase = createUserClient(req);

  const { data: canManage, error: canErr } = await supabase.rpc('can_manage_device_settings', {
    p_device_id: deviceId,
  });
  if (canErr) {
    return NextResponse.json({ error: canErr.message }, { status: 400 });
  }
  if (canManage !== true) {
    return NextResponse.json(
      { error: 'Sem permissão para alterar configurações deste equipamento' },
      { status: 403 }
    );
  }

  const { data, error } = await supabase
    .from('device_settings')
    .upsert(
      {
        device_id: deviceId,
        ...(sanitized.patch || {}),
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'device_id' }
    )
    .select()
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ settings: data });
}
