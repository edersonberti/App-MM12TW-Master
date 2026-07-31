import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// Global/module state for the real Supabase client instance
let realSupabaseInstance: SupabaseClient | null = null;
let resolvedUrl = '';
let resolvedKey = '';

// Helper to clean credentials of any accidental whitespace or surrounding quotes
const cleanCredential = (val: string): string => {
  if (!val) return '';
  let cleaned = val.trim();
  if (cleaned.startsWith('"') && cleaned.endsWith('"')) {
    cleaned = cleaned.slice(1, -1).trim();
  }
  if (cleaned.startsWith("'") && cleaned.endsWith("'")) {
    cleaned = cleaned.slice(1, -1).trim();
  }
  return cleaned;
};

// Helper to check if credentials are valid and not placeholder values
const isValidConfig = (url: string, key: string): boolean => {
  const cleanUrl = cleanCredential(url);
  const cleanKey = cleanCredential(key);
  if (!cleanUrl || !cleanKey) return false;
  const lowerUrl = cleanUrl.toLowerCase();
  const lowerKey = cleanKey.toLowerCase();
  if (lowerUrl.includes('your-supabase-project') || lowerUrl.includes('placeholder')) return false;
  if (lowerKey.includes('your-supabase-anon-key') || lowerKey.includes('placeholder')) return false;

  // A standard Supabase anon key is a JWT (JSON Web Token).
  // It always starts with 'eyJ' and contains exactly 3 parts separated by dots.
  if (cleanKey.startsWith('sb_publishable_') || !cleanKey.startsWith('eyJ') || cleanKey.split('.').length !== 3) {
    return false;
  }

  return true;
};

const DEFAULT_URL = 'https://bjkjyaejzlatdclpcdjs.supabase.co';
const DEFAULT_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJqa2p5YWVqemxhdGRjbHBjZGpzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI5MzQwOTUsImV4cCI6MjA5ODUxMDA5NX0.BTlT9PtnXmBxejXJGmQBfPGhf82V4t7_RoO7MOlR7YY';

function resolveConfig(url?: string, key?: string): { url: string; key: string } {
  let nextUrl = cleanCredential(url || '');
  let nextKey = cleanCredential(key || '');

  if (!isValidConfig(nextUrl, nextKey) && typeof window !== 'undefined') {
    nextUrl = cleanCredential(localStorage.getItem('local_supabase_url') || '');
    nextKey = cleanCredential(localStorage.getItem('local_supabase_key') || '');
  }

  if (!isValidConfig(nextUrl, nextKey) && typeof window !== 'undefined') {
    nextUrl = cleanCredential((window as any).__supabase_url || '');
    nextKey = cleanCredential((window as any).__supabase_key || '');
  }

  if (!isValidConfig(nextUrl, nextKey)) {
    const envUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '';
    const envKey =
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
      process.env.SUPABASE_ANON_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
      process.env.SUPABASE_PUBLISHABLE_KEY ||
      '';
    if (isValidConfig(envUrl, envKey)) {
      nextUrl = cleanCredential(envUrl);
      nextKey = cleanCredential(envKey);
    }
  }

  if (!isValidConfig(nextUrl, nextKey)) {
    nextUrl = DEFAULT_URL;
    nextKey = DEFAULT_KEY;
  }

  return { url: nextUrl, key: nextKey };
}

/** Ensures a real Supabase JS client exists and returns it. */
export const ensureSupabaseClient = (url?: string, key?: string): SupabaseClient => {
  if (realSupabaseInstance && (!url || !key)) {
    return realSupabaseInstance;
  }

  const cfg = resolveConfig(url, key);
  if (!isValidConfig(cfg.url, cfg.key)) {
    throw new Error('Credenciais do Supabase inválidas.');
  }

  // Reuse existing client when URL/key did not change (keeps auth session)
  if (realSupabaseInstance && resolvedUrl === cfg.url && resolvedKey === cfg.key) {
    return realSupabaseInstance;
  }

  realSupabaseInstance = createClient(cfg.url, cfg.key, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });
  resolvedUrl = cfg.url;
  resolvedKey = cfg.key;

  if (typeof window !== 'undefined') {
    (window as any).__supabase_url = cfg.url;
    (window as any).__supabase_key = cfg.key;
  }

  return realSupabaseInstance;
};

export const getSupabaseUrl = (): string => {
  ensureSupabaseClient();
  return resolvedUrl;
};

export const getSupabaseAnonKey = (): string => {
  ensureSupabaseClient();
  return resolvedKey;
};

// Lazy initializer / Configurer
export const configureSupabase = (url: string, key: string): boolean => {
  try {
    ensureSupabaseClient(url, key);
    return true;
  } catch (err) {
    console.error('[Supabase] Failed to initialize dynamic client:', err);
    realSupabaseInstance = null;
    resolvedUrl = '';
    resolvedKey = '';
    if (typeof window !== 'undefined') {
      (window as any).__supabase_url = '';
      (window as any).__supabase_key = '';
    }
    return false;
  }
};

// Helper functions for manual override of Supabase credentials
export const saveLocalConfig = (url: string, key: string): boolean => {
  if (typeof window !== 'undefined') {
    const cleanUrl = cleanCredential(url);
    const cleanKey = cleanCredential(key);
    localStorage.setItem('local_supabase_url', cleanUrl);
    localStorage.setItem('local_supabase_key', cleanKey);
    return configureSupabase(cleanUrl, cleanKey);
  }
  return false;
};

export const clearLocalConfig = (): void => {
  if (typeof window !== 'undefined') {
    localStorage.removeItem('local_supabase_url');
    localStorage.removeItem('local_supabase_key');
    const envUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '';
    const envKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '';
    if (isValidConfig(envUrl, envKey)) {
      configureSupabase(envUrl, envKey);
    } else {
      configureSupabase(DEFAULT_URL, DEFAULT_KEY);
    }
  }
};

// Initialize immediately
try {
  ensureSupabaseClient();
} catch (err) {
  console.warn('[Supabase] Initial configure skipped:', err);
}

// A thenable query builder that always resolves with a real error object (never fake success)
const createDummyProxy = (path: string = 'supabase'): any => {
  const notConfiguredError = {
    message: 'Supabase is not configured yet. Please configure credentials.',
    code: 'SUPABASE_NOT_CONFIGURED',
  };

  const builder: any = {
    select: () => builder,
    insert: () => builder,
    update: () => builder,
    upsert: () => builder,
    delete: () => builder,
    eq: () => builder,
    in: () => builder,
    order: () => builder,
    limit: () => builder,
    single: () => Promise.resolve({ data: null, error: notConfiguredError }),
    maybeSingle: () => Promise.resolve({ data: null, error: notConfiguredError }),
    then: (onFulfilled?: any, onRejected?: any) =>
      Promise.resolve({ data: null, error: notConfiguredError }).then(onFulfilled, onRejected),
  };

  return new Proxy((() => builder) as any, {
    get(_target, prop) {
      if (prop === 'then') return undefined;
      if (prop in builder) return builder[prop as keyof typeof builder];
      console.warn(`[Supabase] Attempted to access ${path}.${String(prop)} but Supabase is not configured yet.`);
      return createDummyProxy(`${path}.${String(prop)}`);
    },
    apply() {
      console.warn(`[Supabase] Attempted to call ${path}() but Supabase is not configured yet.`);
      return builder;
    },
  });
};

const dummyProxy = createDummyProxy();

// The main exported supabase client is a proxy that delegates dynamically to the real client if initialized, or the dummy proxy if not.
export const supabase: any = new Proxy(
  {},
  {
    get(_target, prop) {
      try {
        const client = ensureSupabaseClient();
        const val = (client as any)[prop];
        if (typeof val === 'function') {
          return val.bind(client);
        }
        return val;
      } catch {
        return dummyProxy[prop];
      }
    },
  }
);

/** True only when a real client instance is available. */
export const isSupabaseConfigured = (): boolean => {
  try {
    ensureSupabaseClient();
    return realSupabaseInstance != null;
  } catch {
    return false;
  }
};

export const getSupabaseConfigError = (): string | null => {
  const url =
    typeof window !== 'undefined' && (window as any).__supabase_url
      ? (window as any).__supabase_url
      : resolvedUrl || DEFAULT_URL;
  const key =
    typeof window !== 'undefined' && (window as any).__supabase_key
      ? (window as any).__supabase_key
      : resolvedKey || DEFAULT_KEY;

  const cleanUrl = cleanCredential(url);
  const cleanKey = cleanCredential(key);

  if (!cleanUrl || !cleanKey) {
    return 'Nenhuma credencial do Supabase foi configurada. Cadastre NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY no painel de Secrets do AI Studio.';
  }

  if (cleanUrl.includes('your-supabase-project') || cleanUrl.includes('placeholder')) {
    return 'URL do Supabase inválida nos Secrets. Substitua o placeholder pela sua URL real.';
  }

  if (cleanKey.includes('your-supabase-anon-key') || cleanKey.includes('placeholder')) {
    return "Chave anon do Supabase inválida nos Secrets. Substitua o placeholder pela sua chave 'anon public' real.";
  }

  if (cleanKey.startsWith('sb_publishable_') || !cleanKey.startsWith('eyJ') || cleanKey.split('.').length !== 3) {
    return "Chave Inválida: A chave configurada nos Secrets começa com 'sb_publishable_'. No Supabase, a chave pública para o cliente web é a chave 'anon public' (que começa obrigatoriamente com 'eyJ...').";
  }

  return null;
};
