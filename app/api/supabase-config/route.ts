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

export async function GET() {
  const supabaseUrl = cleanCredential(process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '');
  const supabaseAnonKey = cleanCredential(
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 
    process.env.SUPABASE_ANON_KEY || 
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || 
    process.env.SUPABASE_PUBLISHABLE_KEY || 
    ''
  );

  return NextResponse.json({
    supabaseUrl,
    supabaseAnonKey,
  });
}
