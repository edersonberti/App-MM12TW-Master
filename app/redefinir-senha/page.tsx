'use client';

import { createClient } from '@supabase/supabase-js';
import { useEffect, useState } from 'react';
import Link from 'next/link';

let supabaseClientInstance: any = null;
const getSupabaseClient = () => {
  if (supabaseClientInstance) return supabaseClientInstance;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

  supabaseClientInstance = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: true,
    },
  });
  return supabaseClientInstance;
};

export default function ResetPasswordPage() {
  const [status, setStatus] = useState<'checking' | 'ready' | 'success' | 'error'>('checking');
  const [message, setMessage] = useState('Validando seu link de recuperação...');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const client = getSupabaseClient();

    const verifyRecovery = async () => {
      try {
        const { data: { session }, error } = await client.auth.getSession();

        if (error) {
          setStatus('error');
          setMessage(error.message || 'Não foi possível validar o link de recuperação.');
          return;
        }

        if (session) {
          setStatus('ready');
          setMessage('Seu link está válido. Defina uma nova senha para continuar.');
          return;
        }

        const hash = window.location.hash || '';
        const search = window.location.search || '';

        if (!hash && !search) {
          setStatus('error');
          setMessage('O link de recuperação não contém os dados necessários. Solicite um novo e-mail.');
          return;
        }

        const { data: userData, error: userError } = await client.auth.getUser();
        if (userError) {
          setStatus('error');
          setMessage(userError.message || 'Seu link pode ter expirado. Solicite um novo e-mail.');
          return;
        }

        if (userData?.user) {
          setStatus('ready');
          setMessage('Seu link está válido. Defina uma nova senha para continuar.');
        } else {
          setStatus('error');
          setMessage('Seu link pode ter expirado ou já foi usado. Solicite um novo e-mail.');
        }
      } catch (err: any) {
        setStatus('error');
        setMessage(err.message || 'Não foi possível validar o link.');
      }
    };

    verifyRecovery();
  }, []);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    const client = getSupabaseClient();
    if (!client) {
      setStatus('error');
      setMessage('Cliente de autenticação indisponível.');
      return;
    }

    if (password.length < 8) {
      setStatus('error');
      setMessage('A nova senha deve ter pelo menos 8 caracteres.');
      return;
    }

    if (password !== confirmPassword) {
      setStatus('error');
      setMessage('As senhas não coincidem.');
      return;
    }

    try {
      setLoading(true);
      setStatus('checking');
      setMessage('Atualizando sua senha...');

      const { error } = await client.auth.updateUser({ password });
      if (error) {
        throw error;
      }

      setStatus('success');
      setMessage('Senha redefinida com sucesso. Você já pode entrar no aplicativo.');
      setPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      setStatus('error');
      setMessage(err.message || 'Não foi possível redefinir sua senha.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_#0f172a,_#020617)] px-4 py-10 text-white">
      <div className="mx-auto flex max-w-md flex-col rounded-3xl border border-white/10 bg-slate-900/80 p-6 shadow-2xl shadow-black/30 backdrop-blur">
        <div className="mb-6 flex items-center justify-center gap-3">
          <img src="/512x512.png" alt="Master Lazer" className="h-14 w-14 rounded-2xl border border-white/10 bg-white/95 p-2" />
          <div>
            <h1 className="text-xl font-semibold">Master Lazer</h1>
            <p className="text-sm text-slate-400">Redefinição de senha</p>
          </div>
        </div>

        <div className="mb-5 rounded-2xl border border-cyan-500/20 bg-cyan-500/10 p-3 text-sm text-cyan-200">
          {message}
        </div>

        {status === 'ready' && (
          <form onSubmit={handleSubmit} className="space-y-3">
            <label className="block text-sm text-slate-300">
              Nova senha
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-3 text-sm text-white outline-none ring-0 focus:border-cyan-400"
                placeholder="Mínimo 8 caracteres"
              />
            </label>

            <label className="block text-sm text-slate-300">
              Confirmar nova senha
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="mt-1 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-3 text-sm text-white outline-none ring-0 focus:border-cyan-400"
                placeholder="Digite novamente"
              />
            </label>

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-gradient-to-r from-[#0055CC] to-[#4398fa] px-3 py-3 text-sm font-semibold text-white transition hover:brightness-110 disabled:opacity-70"
            >
              {loading ? 'Salvando...' : 'Salvar nova senha'}
            </button>
          </form>
        )}

        {status === 'success' && (
          <div className="space-y-3">
            <Link
              href="/"
              className="flex w-full items-center justify-center rounded-xl bg-emerald-600 px-3 py-3 text-sm font-semibold text-white transition hover:bg-emerald-500"
            >
              Voltar para o login
            </Link>
          </div>
        )}

        {status === 'error' && (
          <div className="space-y-3">
            <Link
              href="/"
              className="flex w-full items-center justify-center rounded-xl border border-white/10 bg-white/5 px-3 py-3 text-sm font-semibold text-slate-200 transition hover:bg-white/10"
            >
              Voltar ao início
            </Link>
          </div>
        )}
      </div>
    </main>
  );
}
