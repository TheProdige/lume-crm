import { supabase } from './supabase';

export interface InvoiceTemplate {
  id: string;
  org_id: string;
  created_by: string | null;
  name: string;
  title: string;
  description: string;
  line_items: Array<{ description: string; qty: number; unit_price_cents: number }>;
  taxes: Array<{ name: string; rate: number }>;
  payment_terms: string;
  client_note: string;
  branding: Record<string, any>;
  payment_methods: Record<string, any>;
  email_subject: string;
  email_body: string;
  is_default: boolean;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
}

export type InvoiceTemplateInput = Omit<
  InvoiceTemplate,
  'id' | 'org_id' | 'created_by' | 'created_at' | 'updated_at' | 'archived_at'
>;

export async function listInvoiceTemplates(): Promise<InvoiceTemplate[]> {
  const { data, error } = await supabase
    .from('invoice_templates')
    .select('*')
    .is('archived_at', null)
    .order('is_default', { ascending: false })
    .order('name', { ascending: true });
  if (error) throw error;
  return (data || []) as InvoiceTemplate[];
}

export async function getInvoiceTemplate(id: string): Promise<InvoiceTemplate> {
  const { data, error } = await supabase
    .from('invoice_templates')
    .select('*')
    .eq('id', id)
    .single();
  if (error) throw error;
  return data as InvoiceTemplate;
}

export async function createInvoiceTemplate(input: InvoiceTemplateInput): Promise<InvoiceTemplate> {
  const { data, error } = await supabase
    .from('invoice_templates')
    .insert({
      name: input.name,
      title: input.title,
      description: input.description,
      line_items: input.line_items,
      taxes: input.taxes,
      payment_terms: input.payment_terms,
      client_note: input.client_note,
      branding: input.branding,
      payment_methods: input.payment_methods,
      email_subject: input.email_subject,
      email_body: input.email_body,
      is_default: input.is_default,
    })
    .select()
    .single();
  if (error) throw error;
  return data as InvoiceTemplate;
}

export async function updateInvoiceTemplate(
  id: string,
  input: Partial<InvoiceTemplateInput>
): Promise<InvoiceTemplate> {
  const { data, error } = await supabase
    .from('invoice_templates')
    .update({ ...input, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data as InvoiceTemplate;
}

export async function duplicateInvoiceTemplate(id: string): Promise<InvoiceTemplate> {
  const source = await getInvoiceTemplate(id);

  const { data, error } = await supabase
    .from('invoice_templates')
    .insert({
      name: `${source.name} (Copy)`,
      title: source.title,
      description: source.description,
      line_items: source.line_items,
      taxes: source.taxes,
      payment_terms: source.payment_terms,
      client_note: source.client_note,
      branding: source.branding,
      payment_methods: source.payment_methods,
      email_subject: source.email_subject,
      email_body: source.email_body,
      is_default: false,
    })
    .select()
    .single();
  if (error) throw error;
  return data as InvoiceTemplate;
}

export async function setDefaultInvoiceTemplate(id: string): Promise<void> {
  // Unset all defaults for the org
  const { error: unsetError } = await supabase
    .from('invoice_templates')
    .update({ is_default: false, updated_at: new Date().toISOString() })
    .eq('is_default', true);
  if (unsetError) throw unsetError;

  // Set this one as default
  const { error: setError } = await supabase
    .from('invoice_templates')
    .update({ is_default: true, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (setError) throw setError;
}

export async function deleteInvoiceTemplate(id: string): Promise<void> {
  const { error } = await supabase
    .from('invoice_templates')
    .update({ archived_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
}
