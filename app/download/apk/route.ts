import { readFile } from 'node:fs/promises';
import path from 'node:path';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const apkPath = path.join(
      process.cwd(),
      'download',
      'Master Lazer.apk',
    );
    const apk = await readFile(apkPath);

    return new Response(new Uint8Array(apk), {
      headers: {
        'Content-Type': 'application/vnd.android.package-archive',
        'Content-Disposition': 'attachment; filename="Master-Lazer.apk"',
        'Content-Length': String(apk.byteLength),
        'Cache-Control': 'no-store',
      },
    });
  } catch {
    return new Response('Arquivo APK não encontrado.', { status: 404 });
  }
}
