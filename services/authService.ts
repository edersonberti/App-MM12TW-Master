import { supabase } from '../lib/supabase';

export async function signInWithPassword(email: string, password: string) {
  return await supabase.auth.signInWithPassword({
    email,
    password,
  });
}

export async function signUp(email: string, password: string, fullName: string, role: string) {
  return await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: fullName,
        role: role,
      },
    },
  });
}

export async function signOut() {
  return await supabase.auth.signOut();
}

export async function getSession() {
  return await supabase.auth.getSession();
}

export function onAuthStateChange(callback: (event: any, session: any) => void) {
  return supabase.auth.onAuthStateChange(callback);
}

export async function resetPasswordForEmail(email: string, redirectTo: string) {
  return await supabase.auth.resetPasswordForEmail(email, {
    redirectTo,
  });
}

