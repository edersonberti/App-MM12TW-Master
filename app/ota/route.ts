import { NextRequest } from 'next/server';
import { serveOtaFirmware } from '../../lib/otaHandler';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * OTA endpoint for ESP32 devices (query-string form).
 * GET /ota/?t=<token>
 * GET /ota/?token=<token>
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const token = (searchParams.get('t') || searchParams.get('token') || '').trim();
  return serveOtaFirmware(token);
}
