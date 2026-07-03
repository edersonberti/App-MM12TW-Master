import { createClient } from '@supabase/supabase-js';

// Global/module state for the real Supabase client instance
let realSupabaseInstance: any = null;

// Helper to check if credentials are valid and not placeholder values
const isValidConfig = (url: string, key: string): boolean => {
  if (!url || !key) return false;
  const lowerUrl = url.toLowerCase();
  const lowerKey = key.toLowerCase();
  if (lowerUrl.includes('your-supabase-project') || lowerUrl.includes('placeholder')) return false;
  if (lowerKey.includes('your-supabase-anon-key') || lowerKey.includes('placeholder')) return false;
  return true;
};

// Lazy initializer / Configurer
export const configureSupabase = (url: string, key: string): boolean => {
  if (isValidConfig(url, key)) {
    try {
      realSupabaseInstance = createClient(url, key);
      
      // Save to client-side localStorage cache so it is immediately available on next page reload
      if (typeof window !== 'undefined') {
        localStorage.setItem('supabase_url_cache', url);
        localStorage.setItem('supabase_anon_key_cache', key);
        (window as any).__supabase_url = url;
        (window as any).__supabase_key = key;
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

// Synchronously load from localStorage cache during client boot so first render has access immediately
if (typeof window !== 'undefined') {
  const cachedUrl = localStorage.getItem('supabase_url_cache');
  const cachedKey = localStorage.getItem('supabase_anon_key_cache');
  if (cachedUrl && cachedKey) {
    configureSupabase(cachedUrl, cachedKey);
  }
}

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
