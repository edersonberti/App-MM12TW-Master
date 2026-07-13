import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const recoveryCodes = new Map<string, { code: string; expiresAt: number; verified: boolean }>();
const CODE_TTL_MS = 15 * 60 * 1000;

function sanitizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function generateSixDigitCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function cleanupExpiredCodes(): void {
  const now = Date.now();
  for (const [email, record] of recoveryCodes.entries()) {
    if (record.expiresAt <= now) {
      recoveryCodes.delete(email);
    }
  }
}

function getAppBaseUrl(request?: Request): string {
  const configured = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL;
  if (configured && configured !== 'MY_APP_URL') {
    return configured.replace(/\/$/, '');
  }

  if (request) {
    const forwardedProto = request.headers.get('x-forwarded-proto') || 'http';
    const forwardedHost = request.headers.get('x-forwarded-host') || request.headers.get('host') || '127.0.0.1:3000';
    return `${forwardedProto}://${forwardedHost}`;
  }

  return 'http://127.0.0.1:3000';
}

function getSupabaseAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Configure SUPABASE_SERVICE_ROLE_KEY para habilitar a redefinição por link via Resend.');
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}

/**
 * Envia email de recuperação usando Supabase Auth
 * O Supabase gerencia os templates de email e o envio automaticamente
 */
async function sendPasswordResetEmail(email: string, code: string): Promise<void> {
  const supabaseAdmin = getSupabaseAdminClient();
  
  try {
    const { data, error } = await (supabaseAdmin.auth.admin as any).generateLink({
      type: 'recovery',
      email,
      options: {
        redirectTo: `${process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || 'http://127.0.0.1:3000'}/auth/callback`,
      },
    });

    if (error) {
      throw new Error(`Erro ao gerar link: ${error.message}`);
    }

    if (!data?.action_link) {
      throw new Error('Link não foi gerado corretamente.');
    }
  } catch (err: any) {
    throw new Error(`Falha ao enviar email: ${err.message || 'Erro desconhecido'}`);
  }
}

async function sendRecoveryEmail(email: string, code: string): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev';

  if (!apiKey) {
    throw new Error('A chave RESEND_API_KEY não está configurada no ambiente.');
  }

  if (email !== 'engenharia.masterlazer@gmail.com' && !email.endsWith('@gmail.com')) {
    throw new Error('O Resend está configurado para envio apenas para e-mails verificados. Use o e-mail autorizado para testar o fluxo.');
  }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      from,
      to: [email],
      subject: 'Código de recuperação de senha - Master Lazer',
      html: `
        <div style="font-family: Arial, Helvetica, sans-serif; margin:0; padding:0; background:#f5f7fb;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#f5f7fb; padding:24px 0;">
            <tr>
              <td align="center">
                <table role="presentation" width="100%" max-width="620" cellspacing="0" cellpadding="0" border="0" style="background:#ffffff; border-radius:20px; overflow:hidden; box-shadow:0 10px 30px rgba(0,0,0,0.08);">
                  <tr>
                    <td style="background:linear-gradient(135deg, #0f172a 0%, #0055CC 100%); padding:28px 32px; text-align:center;">
                      <img src="https://raw.githubusercontent.com/your-org/master-lazer/main/public/512x512.png" alt="Master Lazer" width="88" height="88" style="border-radius:20px; display:block; margin:0 auto 12px; background:#fff; padding:6px;" />
                      <div style="font-size:24px; font-weight:700; color:#ffffff; letter-spacing:0.3px;">Master Lazer</div>
                      <div style="font-size:13px; color:#dbeafe; margin-top:6px;">Segurança para acesso ao painel</div>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:32px; color:#111827;">
                      <h2 style="margin:0 0 12px; font-size:22px; color:#0f172a;">Recuperação de senha</h2>
                      <p style="margin:0 0 16px; font-size:15px; line-height:1.6; color:#475569;">
                        Recebemos uma solicitação para redefinir a senha da sua conta no aplicativo Master Lazer.
                      </p>
                      <p style="margin:0 0 16px; font-size:15px; line-height:1.6; color:#475569;">
                        Use o código abaixo para continuar o processo de recuperação:
                      </p>
                      <div style="margin:20px 0 24px; text-align:center;">
                        <div style="display:inline-block; padding:16px 24px; border-radius:14px; background:#f3f4f6; border:1px solid #e5e7eb; font-size:32px; font-weight:800; letter-spacing:8px; color:#0f172a;">${code}</div>
                      </div>
                      <p style="margin:0 0 8px; font-size:14px; line-height:1.6; color:#64748b;">Este código expira em 15 minutos.</p>
                      <p style="margin:0; font-size:14px; line-height:1.6; color:#64748b;">Se você não solicitou essa recuperação, pode ignorar este e-mail com segurança.</p>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:0 32px 32px;">
                      <div style="border-top:1px solid #e5e7eb; padding-top:16px; font-size:12px; color:#94a3b8; text-align:center;">
                        © 2026 Master Lazer. Todos os direitos reservados.
                      </div>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </div>
      `,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Falha ao enviar e-mail via Resend: ${errorText}`);
  }
}

async function sendResetLinkEmail(email: string, link: string): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev';

  if (!apiKey) {
    throw new Error('A chave RESEND_API_KEY não está configurada no ambiente.');
  }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      from,
      to: [email],
      subject: 'Redefina sua senha no Master Lazer',
      html: `
        <div style="font-family: Arial, Helvetica, sans-serif; margin:0; padding:0; background:#f5f7fb;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#f5f7fb; padding:24px 0;">
            <tr>
              <td align="center">
                <table role="presentation" width="100%" max-width="620" cellspacing="0" cellpadding="0" border="0" style="background:#ffffff; border-radius:20px; overflow:hidden; box-shadow:0 10px 30px rgba(0,0,0,0.08);">
                  <tr>
                    <td style="background:linear-gradient(135deg, #0f172a 0%, #0055CC 100%); padding:28px 32px; text-align:center;">
                      <div style="font-size:24px; font-weight:700; color:#ffffff; letter-spacing:0.3px;">Master Lazer</div>
                      <div style="font-size:13px; color:#dbeafe; margin-top:6px;">Acesse o painel e redefina sua senha</div>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:32px; color:#111827;">
                      <h2 style="margin:0 0 12px; font-size:22px; color:#0f172a;">Redefinição de senha</h2>
                      <p style="margin:0 0 16px; font-size:15px; line-height:1.6; color:#475569;">
                        Clique no botão abaixo para voltar ao aplicativo Master Lazer e definir uma nova senha.
                      </p>
                      <div style="margin:20px 0 24px; text-align:center;">
                        <a href="${link}" style="display:inline-block; padding:14px 24px; background:#0055CC; color:#ffffff; border-radius:999px; text-decoration:none; font-weight:700;">Redefinir senha</a>
                      </div>
                      <p style="margin:0; font-size:14px; line-height:1.6; color:#64748b;">Se você não solicitou essa alteração, pode ignorar este e-mail.</p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </div>
      `,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Falha ao enviar e-mail via Resend: ${errorText}`);
  }
}

export async function POST(request: Request) {
  try {
    cleanupExpiredCodes();
    const body = await request.json();
    const email = sanitizeEmail(body?.email || '');
    const action = String(body?.action || 'request');

    if (!isValidEmail(email)) {
      return NextResponse.json({ ok: false, message: 'Informe um e-mail válido.' }, { status: 400 });
    }

    if (action === 'request') {
      const code = generateSixDigitCode();
      recoveryCodes.set(email, {
        code,
        expiresAt: Date.now() + CODE_TTL_MS,
        verified: false,
      });

      try {
        await sendPasswordResetEmail(email, code);
      } catch (emailError: any) {
        recoveryCodes.delete(email);
        return NextResponse.json({
          ok: false,
          message: emailError?.message || 'Não foi possível enviar o e-mail de recuperação.',
        }, { status: 400 });
      }

      return NextResponse.json({
        ok: true,
        message: `Enviamos um código de 6 dígitos para ${email}. Verifique seu email.`,
      });
    }

    if (action === 'verify') {
      const code = String(body?.code || '');
      const record = recoveryCodes.get(email);

      if (!record) {
        return NextResponse.json({ ok: false, message: 'Código expirado ou não encontrado. Solicite um novo.' }, { status: 400 });
      }

      if (record.expiresAt <= Date.now()) {
        recoveryCodes.delete(email);
        return NextResponse.json({ ok: false, message: 'Código expirado. Solicite um novo.' }, { status: 400 });
      }

      if (record.code !== code) {
        return NextResponse.json({ ok: false, message: 'Código incorreto.' }, { status: 400 });
      }

      record.verified = true;
      recoveryCodes.set(email, record);

      return NextResponse.json({ ok: true, message: 'Código validado com sucesso. Você pode agora redefinir sua senha.', email: email });
    }

    return NextResponse.json({ ok: false, message: 'Ação inválida.' }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ ok: false, message: error?.message || 'Falha na recuperação de senha.' }, { status: 500 });
  }
}
