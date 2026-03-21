import { JobDraftInitialValues } from '../components/NewJobModal';
import { PipelineDeal } from './pipelineApi';

function compact(parts: Array<string | null | undefined>) {
  return parts.filter((part) => !!part && String(part).trim().length > 0).join('\n');
}

export function mapLeadToJobDraft(deal: PipelineDeal): JobDraftInitialValues {
  const leadName =
    `${deal.lead?.first_name || ''} ${deal.lead?.last_name || ''}`.trim() ||
    deal.lead?.contact?.full_name ||
    null;
  const fallbackTitle = leadName || deal.title || 'New job';
  const title = (deal.title || deal.lead?.title || fallbackTitle).trim();
  const leadRef = deal.lead_id ? `From Lead #${deal.lead_id}` : 'From Pipeline';

  const notes = compact([
    deal.notes || null,
    deal.lead?.notes || null,
  ]);

  return {
    lead_id: deal.lead_id || null,
    title,
    client_id: deal.client_id || null,
    property_address: deal.lead?.address || null,
    description: notes || null,
    job_type: 'one_off',
    requires_invoicing: true,
    billing_split: false,
    line_items:
      deal.lead?.tags?.length
        ? deal.lead.tags.map((tag) => ({
            name: tag,
            qty: 1,
            unit_price_cents: 0,
          }))
        : undefined,
  };
}
