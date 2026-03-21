import { supabase } from './supabase';

export interface PredefinedService {
  id: string;
  org_id: string;
  name: string;
  description: string | null;
  default_price_cents: number;
  category: string | null;
  default_duration_minutes: number | null;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export async function listPredefinedServices(): Promise<PredefinedService[]> {
  const { data, error } = await supabase
    .from('predefined_services')
    .select('*')
    .eq('is_active', true)
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true });
  if (error) throw error;
  return (data || []) as PredefinedService[];
}

export async function createPredefinedService(service: {
  name: string;
  description?: string;
  default_price_cents: number;
  category?: string;
  default_duration_minutes?: number;
}): Promise<PredefinedService> {
  // Get org_id from the user's membership
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data: membership } = await supabase
    .from('memberships')
    .select('org_id')
    .eq('user_id', user.id)
    .limit(1)
    .single();
  if (!membership) throw new Error('No organization found');

  const { data, error } = await supabase
    .from('predefined_services')
    .insert({
      org_id: membership.org_id,
      name: service.name,
      description: service.description || null,
      default_price_cents: service.default_price_cents,
      category: service.category || null,
      default_duration_minutes: service.default_duration_minutes || null,
    })
    .select()
    .single();
  if (error) throw error;
  return data as PredefinedService;
}

export async function updatePredefinedService(id: string, updates: Partial<{
  name: string;
  description: string;
  default_price_cents: number;
  category: string;
  default_duration_minutes: number;
  is_active: boolean;
  sort_order: number;
}>): Promise<PredefinedService> {
  const { data, error } = await supabase
    .from('predefined_services')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data as PredefinedService;
}

export async function deletePredefinedService(id: string): Promise<void> {
  const { error } = await supabase
    .from('predefined_services')
    .delete()
    .eq('id', id);
  if (error) throw error;
}
