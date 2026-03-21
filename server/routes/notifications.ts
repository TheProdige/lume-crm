import { Router } from 'express';
import { requireAuthedClient, getServiceClient } from '../lib/supabase';

const router = Router();

// GET /api/notifications — list notifications for current user
router.get('/notifications', async (req, res) => {
  try {
    const authed = await requireAuthedClient(req, res);
    if (!authed) return;
    const { orgId } = authed;
    const serviceClient = getServiceClient();

    const { data, error } = await serviceClient
      .from('notifications')
      .select('*')
      .eq('org_id', orgId)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) throw error;
    return res.json(data || []);
  } catch (error: any) {
    return res.status(500).json({ error: error?.message || 'Failed to load notifications' });
  }
});

// POST /api/notifications/read — mark notifications as read
router.post('/notifications/read', async (req, res) => {
  try {
    const authed = await requireAuthedClient(req, res);
    if (!authed) return;

    const { ids } = req.body || {};
    const serviceClient = getServiceClient();

    if (ids && Array.isArray(ids)) {
      await serviceClient.from('notifications').update({ is_read: true }).in('id', ids);
    } else {
      // Mark all as read
      await serviceClient.from('notifications').update({ is_read: true }).eq('org_id', authed.orgId);
    }

    return res.json({ ok: true });
  } catch (error: any) {
    return res.status(500).json({ error: error?.message || 'Failed to mark as read' });
  }
});

export default router;
