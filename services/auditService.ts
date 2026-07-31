import { supabase } from '../lib/supabase';

export interface AuditEvent {
  id: string;
  actor_user_id: string | null;
  actor_email: string | null;
  entity_type: string;
  entity_id: string;
  event_type: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface AuditEventFilters {
  search?: string;
  actorEmail?: string;
  entityType?: string;
  eventType?: string;
  entityId?: string;
  dateFrom?: string; // YYYY-MM-DD
  dateTo?: string;   // YYYY-MM-DD
  sort?: 'asc' | 'desc';
  limit?: number;
}

/** Owner/admin/elevated profiles: audit trail with optional server-side filters. */
export async function fetchAuditEvents(
  limitOrFilters: number | AuditEventFilters = 200
): Promise<AuditEvent[]> {
  const filters: AuditEventFilters =
    typeof limitOrFilters === 'number' ? { limit: limitOrFilters } : limitOrFilters;

  try {
    let query = supabase
      .from('audit_events')
      .select('id, actor_user_id, actor_email, entity_type, entity_id, event_type, metadata, created_at');

    if (filters.actorEmail) {
      query = query.eq('actor_email', filters.actorEmail);
    }
    if (filters.entityType) {
      query = query.eq('entity_type', filters.entityType);
    }
    if (filters.eventType) {
      query = query.eq('event_type', filters.eventType);
    }
    if (filters.entityId) {
      query = query.ilike('entity_id', `%${filters.entityId}%`);
    }
    if (filters.dateFrom) {
      query = query.gte('created_at', `${filters.dateFrom}T00:00:00.000Z`);
    }
    if (filters.dateTo) {
      query = query.lte('created_at', `${filters.dateTo}T23:59:59.999Z`);
    }

    query = query
      .order('created_at', { ascending: filters.sort === 'asc' })
      .limit(filters.limit ?? 500);

    const { data, error } = await query;

    if (error) {
      console.error('[AuditService] Error fetching audit events:', error.message);
      return [];
    }

    let rows = (data || []) as AuditEvent[];

    // Free-text search across several columns (client-side for flexibility)
    const search = (filters.search || '').trim().toLowerCase();
    if (search) {
      rows = rows.filter((row) => {
        const hay = [
          row.actor_email,
          row.entity_type,
          row.entity_id,
          row.event_type,
          JSON.stringify(row.metadata || {}),
        ]
          .join(' ')
          .toLowerCase();
        return hay.includes(search);
      });
    }

    return rows;
  } catch (err) {
    console.error('[AuditService] Fetch audit events error:', err);
    return [];
  }
}

/** Distinct filter options for building the audit UI dropdowns. */
export function deriveAuditFilterOptions(events: AuditEvent[]) {
  const actors = new Set<string>();
  const entityTypes = new Set<string>();
  const eventTypes = new Set<string>();

  for (const e of events) {
    if (e.actor_email) actors.add(e.actor_email);
    if (e.entity_type) entityTypes.add(e.entity_type);
    if (e.event_type) eventTypes.add(e.event_type);
  }

  return {
    actors: Array.from(actors).sort((a, b) => a.localeCompare(b)),
    entityTypes: Array.from(entityTypes).sort((a, b) => a.localeCompare(b)),
    eventTypes: Array.from(eventTypes).sort((a, b) => a.localeCompare(b)),
  };
}
