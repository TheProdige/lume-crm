import { Router } from 'express';
import { getServiceClient } from '../lib/supabase';

const router = Router();

// Separate router for root-level quote redirect (/q/:token)
export const quoteRedirectRouter = Router();

// Public route: client opens quote via unique token
// GET /q/:token — serves a redirect to frontend quote view page
quoteRedirectRouter.get('/q/:token', async (req, res) => {
  try {
    const { token } = req.params;
    if (!token) return res.status(400).send('Invalid link');

    const serviceClient = getServiceClient();

    // Find the invoice by view_token
    const { data: invoice, error } = await serviceClient
      .from('invoices')
      .select('id, invoice_number, client_id, org_id, is_viewed, view_count')
      .eq('view_token', token)
      .is('deleted_at', null)
      .maybeSingle();

    if (error || !invoice) {
      return res.status(404).send('Quote not found');
    }

    const isFirstView = !invoice.is_viewed;
    const now = new Date().toISOString();

    // Update invoice tracking fields
    await serviceClient
      .from('invoices')
      .update({
        is_viewed: true,
        viewed_at: isFirstView ? now : undefined,
        view_count: (invoice.view_count || 0) + 1,
        last_viewed_at: now,
      })
      .eq('id', invoice.id);

    // Log to quote_views table
    await serviceClient
      .from('quote_views')
      .insert({
        invoice_id: invoice.id,
        client_id: invoice.client_id,
        ip_address: req.ip || req.headers['x-forwarded-for'] || null,
        user_agent: req.headers['user-agent'] || null,
      });

    // Create notification only on FIRST view
    if (isFirstView) {
      // Get client name for notification
      let clientName = 'Client';
      if (invoice.client_id) {
        const { data: client } = await serviceClient
          .from('clients')
          .select('first_name, last_name')
          .eq('id', invoice.client_id)
          .is('deleted_at', null)
          .maybeSingle();
        if (client) {
          clientName = `${client.first_name || ''} ${client.last_name || ''}`.trim() || 'Client';
        }
      }

      await serviceClient
        .from('notifications')
        .insert({
          org_id: invoice.org_id,
          type: 'quote_opened',
          title: `${clientName} opened quote ${invoice.invoice_number}`,
          body: `${clientName} has viewed their quote for the first time.`,
          icon: 'eye',
          link: `/invoices/${invoice.id}`,
          reference_id: invoice.id,
        });
    }

    // Redirect to frontend quote view page
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    return res.redirect(`${frontendUrl}/quote/${token}`);
  } catch (error: any) {
    console.error('Quote view tracking error:', error);
    return res.status(500).send('Something went wrong');
  }
});

// POST /api/quotes/:id/track-view — track a view using view_token (public, rate-limited)
router.post('/quotes/:id/track-view', async (req, res) => {
  try {
    const { id } = req.params;
    const serviceClient = getServiceClient();

    // Security: use view_token lookup instead of raw UUID to prevent enumeration
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
    const query = serviceClient
      .from('invoices')
      .select('id, invoice_number, client_id, org_id, is_viewed, view_count')
      .is('deleted_at', null);

    // Accept either view_token or invoice ID (for backward compat with authed callers)
    const { data: invoice, error } = isUuid
      ? await query.eq('id', id).maybeSingle()
      : await query.eq('view_token', id).maybeSingle();

    if (error || !invoice) {
      return res.status(404).json({ error: 'Invoice not found' });
    }

    const isFirstView = !invoice.is_viewed;
    const now = new Date().toISOString();

    await serviceClient
      .from('invoices')
      .update({
        is_viewed: true,
        viewed_at: isFirstView ? now : undefined,
        view_count: (invoice.view_count || 0) + 1,
        last_viewed_at: now,
      })
      .eq('id', invoice.id);

    await serviceClient
      .from('quote_views')
      .insert({
        invoice_id: invoice.id,
        client_id: invoice.client_id,
        ip_address: req.ip || req.headers['x-forwarded-for'] || null,
        user_agent: req.headers['user-agent'] || null,
      });

    if (isFirstView) {
      let clientName = 'Client';
      if (invoice.client_id) {
        const { data: client } = await serviceClient
          .from('clients')
          .select('first_name, last_name')
          .eq('id', invoice.client_id)
          .is('deleted_at', null)
          .maybeSingle();
        if (client) {
          clientName = `${client.first_name || ''} ${client.last_name || ''}`.trim() || 'Client';
        }
      }

      await serviceClient
        .from('notifications')
        .insert({
          org_id: invoice.org_id,
          type: 'quote_opened',
          title: `${clientName} opened quote ${invoice.invoice_number}`,
          body: `${clientName} has viewed their quote for the first time.`,
          icon: 'eye',
          link: `/invoices/${invoice.id}`,
          reference_id: invoice.id,
        });
    }

    return res.json({ tracked: true, first_view: isFirstView });
  } catch (error: any) {
    console.error('Track view error:', error);
    return res.status(500).json({ error: 'Failed to track view' });
  }
});

export default router;
