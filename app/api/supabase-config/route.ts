import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

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

const DEFAULT_URL = 'https://bjkjyaejzlatdclpcdjs.supabase.co';
const DEFAULT_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJqa2p5YWVqemxhdGRjbHBjZGpzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI5MzQwOTUsImV4cCI6MjA5ODUxMDA5NX0.BTlT9PtnXmBxejXJGmQBfPGhf82V4t7_RoO7MOlR7YY';

const isValidConfig = (url: string, key: string): boolean => {
  if (!url || !key) return false;
  const lowerUrl = url.toLowerCase();
  const lowerKey = key.toLowerCase();
  if (lowerUrl.includes('your-supabase-project') || lowerUrl.includes('placeholder')) return false;
  if (lowerKey.includes('your-supabase-anon-key') || lowerKey.includes('placeholder')) return false;
  
  if (key.startsWith('sb_publishable_') || !key.startsWith('eyJ') || key.split('.').length !== 3) {
    return false;
  }
  return true;
};

export async function GET() {
  let supabaseUrl = cleanCredential(process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '');
  let supabaseAnonKey = cleanCredential(
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 
    process.env.SUPABASE_ANON_KEY || 
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || 
    process.env.SUPABASE_PUBLISHABLE_KEY || 
    ''
  );

  if (!isValidConfig(supabaseUrl, supabaseAnonKey)) {
    supabaseUrl = DEFAULT_URL;
    supabaseAnonKey = DEFAULT_KEY;
  }

  return NextResponse.json({
    supabaseUrl,
    supabaseAnonKey,
  });
}
