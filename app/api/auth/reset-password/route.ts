import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

// Track verified emails (in production, use a database or cache like Redis)
const verifiedEmails = new Map<string, { verifiedAt: number; expiresAt: number }>();
const VERIFICATION_TTL_MS = 30 * 60 * 1000; // 30 minutes

function getSupabaseAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Supabase não está configurado corretamente.');
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}

function cleanupExpiredVerifications(): void {
  const now = Date.now();
  for (const [email, record] of verifiedEmails.entries()) {
    if (record.expiresAt <= now) {
      verifiedEmails.delete(email);
    }
  }
}

function isEmailVerified(email: string): boolean {
  cleanupExpiredVerifications();
  const record = verifiedEmails.get(email);
  return !!record && record.expiresAt > Date.now();
}

export async function POST(request: Request) {
  try {
    cleanupExpiredVerifications();
    const body = await request.json();
    const email = (body?.email || '').trim().toLowerCase();
    const password = body?.password || '';
    const action = String(body?.action || 'reset');

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ ok: false, message: 'Informe um e-mail válido.' }, { status: 400 });
    }

    if (action === 'markVerified') {
      // Called after successful code verification
      verifiedEmails.set(email, {
        verifiedAt: Date.now(),
        expiresAt: Date.now() + VERIFICATION_TTL_MS,
      });
      return NextResponse.json({ ok: true, message: 'E-mail marcado como verificado.' });
    }

    if (action === 'reset') {
      if (!isEmailVerified(email)) {
        return NextResponse.json({ 
          ok: false, 
          message: 'E-mail não verificado. Por favor, valide o código de recuperação primeiro.' 
        }, { status: 403 });
      }

      if (!password || password.length < 8) {
        return NextResponse.json({ 
          ok: false, 
          message: 'A senha deve ter no mínimo 8 caracteres.' 
        }, { status: 400 });
      }

      try {
        const supabaseAdmin = getSupabaseAdminClient();

        // Get user by email
        const { data: { users }, error: getUserError } = await (supabaseAdmin.auth.admin as any).listUsers();

        if (getUserError) {
          throw new Error(getUserError.message || 'Falha ao buscar usuário.');
        }

        const user = users.find((u: any) => u.email === email);

        if (!user) {
          return NextResponse.json({ 
            ok: false, 
            message: 'Usuário não encontrado.' 
          }, { status: 404 });
        }

        // Update user password
        const { error: updateError } = await (supabaseAdmin.auth.admin as any).updateUserById(
          user.id,
          { password }
        );

        if (updateError) {
          throw new Error(updateError.message || 'Falha ao atualizar senha.');
        }

        // Clean up verified email
        verifiedEmails.delete(email);

        return NextResponse.json({ 
          ok: true, 
          message: 'Senha redefinida com sucesso! Você pode agora entrar com sua nova senha.' 
        });
      } catch (error: any) {
        return NextResponse.json({ 
          ok: false, 
          message: error?.message || 'Falha ao redefinir a senha.' 
        }, { status: 500 });
      }
    }

    return NextResponse.json({ ok: false, message: 'Ação inválida.' }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ 
      ok: false, 
      message: error?.message || 'Erro ao processar solicitação.' 
    }, { status: 500 });
  }
}
