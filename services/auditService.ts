import { supabase } from '../lib/supabase';

export interface AuditEvent {
  id: string;
  actor_user_id: string | null;
  actor_email: string | null;
  entity_type: 'profile' | 'device';
  entity_id: string;
  event_type: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

export async function fetchAuditEvents(): Promise<AuditEvent[]> {
  try {
    const { data, error } = await supabase
      .from('audit_events')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(200);

    if (error) {
      console.error('[AuditService] Error fetching audit events:', error.message);
      return [];
    }

    return data || [];
  } catch (err) {
    console.error('[AuditService] Fetch audit events error:', err);
    return [];
  }
}
