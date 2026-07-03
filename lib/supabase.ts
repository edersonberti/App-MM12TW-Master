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
  }
  return false;
};

// Try to initialize immediately from process.env (for server-side or dev runtime)
const initialUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const initialKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
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
