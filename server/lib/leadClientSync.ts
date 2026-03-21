/**
 * Lead ↔ Client Synchronization Service
 *
 * Central logic for keeping leads and clients in sync.
 * Every lead MUST have a linked client (client_id).
 * clients = authoritative identity source
 * leads = sales/pipeline extension of a client
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { getServiceClient } from './supabase';

/**
 * Ensure a client record exists for a lead.
 * - If a client with the same email already exists in the org, returns that client_id.
 * - Otherwise, creates a new client with status='lead'.
 */
export async function ensureClientForLead(
  client: SupabaseClient,
  params: {
    orgId: string;
    createdBy: string;
    firstName: string;
    lastName: string;
    email?: string | null;
    phone?: string | null;
    address?: string | null;
    company?: string | null;
  }
): Promise<string> {
  // Try the RPC first (uses SECURITY DEFINER, handles email dedup)
  const { data, error } = await client.rpc('ensure_client_for_lead', {
    p_org_id: params.orgId,
    p_created_by: params.createdBy,
    p_first_name: params.firstName,
    p_last_name: params.lastName,
    p_email: params.email || null,
    p_phone: params.phone || null,
    p_address: params.address || null,
    p_company: params.company || null,
  });

  if (error) throw error;
  if (!data) throw new Error('ensure_client_for_lead returned null');
  return String(data);
}

/**
 * Sync key identity fields from a lead to its linked client.
 * Called after lead update.
 */
export async function syncLeadToClient(
  client: SupabaseClient,
  params: {
    clientId: string;
    firstName: string;
    lastName: string;
    email?: string | null;
    phone?: string | null;
    address?: string | null;
    company?: string | null;
  }
): Promise<void> {
  const updatePayload: Record<string, any> = {
    first_name: params.firstName,
    last_name: params.lastName,
    updated_at: new Date().toISOString(),
  };
  // Only overwrite non-null values (don't erase client data with empty lead fields)
  if (params.email) updatePayload.email = params.email;
  if (params.phone) updatePayload.phone = params.phone;
  if (params.address) updatePayload.address = params.address;
  if (params.company) updatePayload.company = params.company;

  const { error } = await client
    .from('clients')
    .update(updatePayload)
    .eq('id', params.clientId);

  if (error) {
    // eslint-disable-next-line no-console
    console.error('syncLeadToClient failed', { clientId: params.clientId, code: error.code, message: error.message });
  }
}

/**
 * Resolve the client_id for a lead. Used when creating a job from a lead.
 * If the lead somehow has no client_id (legacy data), attempt to create one.
 */
export async function resolveClientIdForLead(
  client: SupabaseClient,
  leadId: string
): Promise<string> {
  const { data: lead, error: leadErr } = await client
    .from('leads')
    .select('id, client_id, converted_to_client_id, org_id, created_by, first_name, last_name, email, phone, address, company')
    .eq('id', leadId)
    .maybeSingle();

  if (leadErr) throw leadErr;
  if (!lead) throw new Error('Lead not found');

  // Best case: client_id is set
  if (lead.client_id) return String(lead.client_id);

  // Fallback: converted_to_client_id
  if (lead.converted_to_client_id) {
    // Backfill client_id
    await client
      .from('leads')
      .update({ client_id: lead.converted_to_client_id })
      .eq('id', leadId);
    return String(lead.converted_to_client_id);
  }

  // Last resort: create a client
  const clientId = await ensureClientForLead(getServiceClient(), {
    orgId: lead.org_id,
    createdBy: lead.created_by,
    firstName: lead.first_name || '',
    lastName: lead.last_name || '',
    email: lead.email,
    phone: lead.phone,
    address: lead.address,
    company: lead.company,
  });

  // Link it
  await client
    .from('leads')
    .update({ client_id: clientId, converted_to_client_id: clientId })
    .eq('id', leadId);

  return clientId;
}

/**
 * When converting a lead's status to "won", update the linked client status to "active".
 */
export async function promoteClientFromLead(
  client: SupabaseClient,
  clientId: string
): Promise<void> {
  const { error } = await client
    .from('clients')
    .update({ status: 'active', updated_at: new Date().toISOString() })
    .eq('id', clientId)
    .eq('status', 'lead');

  if (error) {
    // eslint-disable-next-line no-console
    console.error('promoteClientFromLead failed', { clientId, code: error.code });
  }
}
