import { createClient } from '@supabase/supabase-js';

// Global/module state for the real Supabase client instance
let realSupabaseInstance: any = null;

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

// Lazy initializer / Configurer
export const configureSupabase = (url: string, key: string): boolean => {
  const cleanUrl = cleanCredential(url);
  const cleanKey = cleanCredential(key);
  if (isValidConfig(cleanUrl, cleanKey)) {
    try {
      realSupabaseInstance = createClient(cleanUrl, cleanKey);
      
      if (typeof window !== 'undefined') {
        (window as any).__supabase_url = cleanUrl;
        (window as any).__supabase_key = cleanKey;
      }
      return true;
    } catch (err) {
      console.error('[Supabase] Failed to initialize dynamic client:', err);
    }
  } else {
    // If invalid config, make sure we clear the real instance so it doesn't try to make broken requests
    realSupabaseInstance = null;
    if (typeof window !== 'undefined') {
      (window as any).__supabase_url = '';
      (window as any).__supabase_key = '';
    }
  }
  return false;
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

const DEFAULT_URL = 'https://bjkjyaejzlatdclpcdjs.supabase.co';
const DEFAULT_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJqa2p5YWVqemxhdGRjbHBjZGpzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI5MzQwOTUsImV4cCI6MjA5ODUxMDA5NX0.BTlT9PtnXmBxejXJGmQBfPGhf82V4t7_RoO7MOlR7YY';

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

// Try to initialize immediately from process.env or localStorage fallback
const getInitialConfig = () => {
  let url = '';
  let key = '';

  if (typeof window !== 'undefined') {
    url = localStorage.getItem('local_supabase_url') || '';
    key = localStorage.getItem('local_supabase_key') || '';
  }

  if (!isValidConfig(url, key)) {
    const envUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '';
    const envKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 
                  process.env.SUPABASE_ANON_KEY || 
                  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || 
                  process.env.SUPABASE_PUBLISHABLE_KEY || 
                  '';
    if (isValidConfig(envUrl, envKey)) {
      url = envUrl;
      key = envKey;
    } else {
      url = DEFAULT_URL;
      key = DEFAULT_KEY;
    }
  }
  return { url, key };
};

const initialConfig = getInitialConfig();
const initialUrl = initialConfig.url;
const initialKey = initialConfig.key;
configureSupabase(initialUrl, initialKey);

// A recursive proxy that handles any nested properties and returns dummy builder methods to avoid runtime crashes
const createDummyProxy = (path: string = 'supabase'): any => {
  const dummy = () => {
    console.warn(`[Supabase] Attempted to call ${path} but Supabase is not configured yet.`);
    const result: any = {
      data: null,
      error: { message: 'Supabase is not configured yet. Please configure credentials.' },
      select: () => createDummyProxy(`${path}.select`),
      insert: () => createDummyProxy(`${path}.insert`),
      upsert: () => createDummyProxy(`${path}.upsert`),
      delete: () => createDummyProxy(`${path}.delete`),
      eq: () => createDummyProxy(`${path}.eq`),
      single: () => Promise.resolve({ data: null, error: { message: 'Supabase is not configured yet.' } }),
      maybeSingle: () => Promise.resolve({ data: null, error: { message: 'Supabase is not configured yet.' } })
    };
    return result;
  };

  return new Proxy(dummy, {
    get(target, prop) {
      if (prop === 'then') return undefined; // Prevent issues with Promise resolution on the proxy
      return createDummyProxy(`${path}.${String(prop)}`);
    }
  });
};

const dummyProxy = createDummyProxy();

// The main exported supabase client is a proxy that delegates dynamically to the real client if initialized, or the dummy proxy if not.
export const supabase: any = new Proxy({}, {
  get(target, prop) {
    if (realSupabaseInstance) {
      const val = realSupabaseInstance[prop];
      if (typeof val === 'function') {
        return val.bind(realSupabaseInstance);
      }
      return val;
    }
    // Try window-level fallback check
    if (typeof window !== 'undefined' && (window as any).__supabase_url && (window as any).__supabase_key) {
      if (configureSupabase((window as any).__supabase_url, (window as any).__supabase_key)) {
        const val = realSupabaseInstance[prop];
        if (typeof val === 'function') {
          return val.bind(realSupabaseInstance);
        }
        return val;
      }
    }
    return dummyProxy[prop];
  }
});

export const isSupabaseConfigured = (): boolean => {
  if (realSupabaseInstance) return true;
  if (typeof window !== 'undefined' && (window as any).__supabase_url && (window as any).__supabase_key) {
    return isValidConfig((window as any).__supabase_url, (window as any).__supabase_key);
  }
  return isValidConfig(initialUrl, initialKey);
};

export const getSupabaseConfigError = (): string | null => {
  const url = typeof window !== 'undefined' && (window as any).__supabase_url ? (window as any).__supabase_url : initialUrl;
  const key = typeof window !== 'undefined' && (window as any).__supabase_key ? (window as any).__supabase_key : initialKey;
  
  const cleanUrl = cleanCredential(url);
  const cleanKey = cleanCredential(key);
  
  if (!cleanUrl || !cleanKey) {
    return "Nenhuma credencial do Supabase foi configurada. Cadastre NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY no painel de Secrets do AI Studio.";
  }
  
  if (cleanUrl.includes('your-supabase-project') || cleanUrl.includes('placeholder')) {
    return "URL do Supabase inválida nos Secrets. Substitua o placeholder pela sua URL real.";
  }
  
  if (cleanKey.includes('your-supabase-anon-key') || cleanKey.includes('placeholder')) {
    return "Chave anon do Supabase inválida nos Secrets. Substitua o placeholder pela sua chave 'anon public' real.";
  }
  
  // A standard Supabase anon key is a JWT (JSON Web Token).
  // It always starts with 'eyJ' and contains exactly 3 parts separated by dots.
  if (cleanKey.startsWith('sb_publishable_') || !cleanKey.startsWith('eyJ') || cleanKey.split('.').length !== 3) {
    return "Chave Inválida: A chave configurada nos Secrets começa com 'sb_publishable_'. No Supabase, a chave pública para o cliente web é a chave 'anon public' (que começa obrigatoriamente com 'eyJ...').";
  }
  
  return null;
};

