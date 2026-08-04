import { serveOtaFirmware } from '../../../lib/otaHandler';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * OTA endpoint for ESP32 devices (path form — preferred; no query string).
 * GET /ota/<token>
 */
export async function GET(
  _request: Request,
  context: { params: Promise<{ token: string }> }
) {
  const { token } = await context.params;
  return serveOtaFirmware(token || '');
}
