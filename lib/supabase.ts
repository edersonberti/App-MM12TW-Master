import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

// A recursive proxy that handles any nested properties and returns dummy builder methods to avoid runtime crashes
const createDummyProxy = (path: string = 'supabase'): any => {
  const dummy = () => {
    console.warn(`[Supabase] Attempted to call ${path} but Supabase is not configured.`);
    const result: any = {
      data: null,
      error: { message: 'Supabase is not configured yet. Please set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in your environment.' },
      select: () => createDummyProxy(`${path}.select`),
      insert: () => createDummyProxy(`${path}.insert`),
      upsert: () => createDummyProxy(`${path}.upsert`),
      delete: () => createDummyProxy(`${path}.delete`),
      eq: () => createDummyProxy(`${path}.eq`),
      single: () => Promise.resolve({ data: null, error: { message: 'Supabase is not configured.' } }),
      maybeSingle: () => Promise.resolve({ data: null, error: { message: 'Supabase is not configured.' } })
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

// Check if credentials are set and are not placeholder values
const hasCredentials = (): boolean => {
  if (!supabaseUrl || !supabaseAnonKey) return false;
  if (supabaseUrl.includes('your-supabase-project') || supabaseUrl.includes('placeholder')) return false;
  if (supabaseAnonKey.includes('your-supabase-anon-key') || supabaseAnonKey.includes('placeholder')) return false;
  return true;
};

let supabaseInstance: any;

if (hasCredentials()) {
  try {
    supabaseInstance = createClient(supabaseUrl, supabaseAnonKey);
  } catch (err) {
    console.error('[Supabase] Failed to initialize client:', err);
    supabaseInstance = createDummyProxy();
  }
} else {
  supabaseInstance = createDummyProxy();
}

export const supabase = supabaseInstance;

export const isSupabaseConfigured = (): boolean => {
  return hasCredentials();
};
