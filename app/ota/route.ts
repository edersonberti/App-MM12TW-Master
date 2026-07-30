import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const DEFAULT_URL = 'https://bjkjyaejzlatdclpcdjs.supabase.co';
const DEFAULT_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJqa2p5YWVqemxhdGRjbHBjZGpzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI5MzQwOTUsImV4cCI6MjA5ODUxMDA5NX0.BTlT9PtnXmBxejXJGmQBfPGhf82V4t7_RoO7MOlR7YY';

function getSupabase() {
  const url = (process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || DEFAULT_URL).trim();
  const key = (
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    DEFAULT_KEY
  ).trim();
  return createClient(url, key);
}

/**
 * OTA endpoint for ESP32 devices.
 * The phone never downloads the .bin — the device pulls it from here.
 * Requires a short-lived token created when the user taps "Atualizar".
 *
 * GET /ota/?t=<token>
 * GET /ota/?token=<token>
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const token = (searchParams.get('t') || searchParams.get('token') || '').trim();

    if (!token) {
      return NextResponse.json(
        {
          ok: false,
          error: 'Token OTA ausente. Use o botão Atualizar no app para iniciar a atualização.',
        },
        { status: 400 }
      );
    }

    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('ota_tokens')
      .select('signed_url, model, expires_at')
      .eq('token', token)
      .maybeSingle();

    if (error) {
      console.error('[OTA] token lookup error:', error.message);
      return NextResponse.json({ ok: false, error: 'Falha ao validar token OTA.' }, { status: 500 });
    }

    if (!data?.signed_url) {
      return NextResponse.json({ ok: false, error: 'Token OTA inválido ou expirado.' }, { status: 404 });
    }

    if (data.expires_at && new Date(data.expires_at).getTime() <= Date.now()) {
      return NextResponse.json({ ok: false, error: 'Token OTA expirado.' }, { status: 410 });
    }

    const upstream = await fetch(data.signed_url, { cache: 'no-store' });
    if (!upstream.ok || !upstream.body) {
      console.error('[OTA] upstream fetch failed:', upstream.status);
      return NextResponse.json(
        { ok: false, error: 'Não foi possível obter o firmware no storage.' },
        { status: 502 }
      );
    }

    const headers = new Headers();
    headers.set('Content-Type', 'application/octet-stream');
    headers.set('Cache-Control', 'no-store, max-age=0');
    headers.set(
      'Content-Disposition',
      `inline; filename="${(data.model || 'firmware').replace(/[^a-zA-Z0-9._-]/g, '_')}.bin"`
    );

    const contentLength = upstream.headers.get('content-length');
    if (contentLength) headers.set('Content-Length', contentLength);

    return new NextResponse(upstream.body, {
      status: 200,
      headers,
    });
  } catch (err: any) {
    console.error('[OTA] unexpected error:', err);
    return NextResponse.json(
      { ok: false, error: err?.message || 'Erro interno no endpoint OTA.' },
      { status: 500 }
    );
  }
}
