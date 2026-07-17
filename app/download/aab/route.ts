import { readFile } from 'node:fs/promises';
import path from 'node:path';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const aabPath = path.join(
      process.cwd(),
      'download',
      'Master Lazer.aab',
    );
    const aab = await readFile(aabPath);

    return new Response(new Uint8Array(aab), {
      headers: {
        'Content-Type': 'application/octet-stream',
        'Content-Disposition': 'attachment; filename="Master-Lazer.aab"',
        'Content-Length': String(aab.byteLength),
        'Cache-Control': 'no-store',
      },
    });
  } catch {
    return new Response('Arquivo AAB não encontrado.', { status: 404 });
  }
}
