/* ═══════════════════════════════════════════════════════════════
   Routes — Automation Event Hooks

   These endpoints allow the frontend to notify the automation
   engine when events happen that are managed client-side
   (appointments, job status changes, etc.) and therefore
   can't emit server-side events on their own.

   The frontend calls these AFTER performing the Supabase
   operation successfully, purely to trigger automation rules.
   ═══════════════════════════════════════════════════════════════ */

import { Router } from 'express';
import { requireAuthedClient, getServiceClient } from '../lib/supabase';
import { eventBus } from '../lib/eventBus';
import { validate, automationEventSchema } from '../lib/validation';

const router = Router();

// ── POST /automations/events/appointment-created ──
// Called after a schedule_event is created
router.post('/automations/events/appointment-created', validate(automationEventSchema), async (req, res) => {
  try {
    const auth = await requireAuthedClient(req, res);
    if (!auth) return;

    const { eventId, jobId, clientId, startTime, title, address } = req.body;
    if (!eventId) return res.status(400).json({ error: 'eventId is required' });

    // Fetch details for variable resolution
    const admin = getServiceClient();
    let clientName = '';
    let clientEmail = '';
    let clientPhone = '';
    let jobName = '';

    if (jobId) {
      const { data: job } = await admin
        .from('jobs')
        .select('title, client_id')
        .eq('id', jobId)
        .maybeSingle();
      if (job) {
        jobName = job.title || '';
        const cid = clientId || job.client_id;
        if (cid) {
          const { data: client } = await admin
            .from('clients')
            .select('first_name, last_name, email, phone')
            .eq('id', cid)
            .maybeSingle();
          if (client) {
            clientName = `${client.first_name || ''} ${client.last_name || ''}`.trim();
            clientEmail = client.email || '';
            clientPhone = client.phone || '';
          }
        }
      }
    }

    await eventBus.emit('appointment.created', {
      orgId: auth.orgId,
      entityType: 'schedule_event',
      entityId: eventId,
      actorId: auth.user.id,
      metadata: {
        job_id: jobId || null,
        client_id: clientId || null,
        start_time: startTime || null,
        title: title || jobName || '',
        address: address || '',
        client_name: clientName,
        client_email: clientEmail,
        client_phone: clientPhone,
        job_name: jobName,
      },
      relatedEntityType: jobId ? 'job' : undefined,
      relatedEntityId: jobId || undefined,
    });

    return res.json({ ok: true });
  } catch (err: any) {
    console.error('[automation-events] appointment.created error:', err.message);
    return res.status(500).json({ error: err.message });
  }
});

// ── POST /automations/events/appointment-cancelled ──
// Called after a schedule_event is deleted/cancelled
router.post('/automations/events/appointment-cancelled', validate(automationEventSchema), async (req, res) => {
  try {
    const auth = await requireAuthedClient(req, res);
    if (!auth) return;

    const { eventId, jobId, clientId } = req.body;
    if (!eventId) return res.status(400).json({ error: 'eventId is required' });

    await eventBus.emit('appointment.cancelled', {
      orgId: auth.orgId,
      entityType: 'schedule_event',
      entityId: eventId,
      actorId: auth.user.id,
      metadata: {
        job_id: jobId || null,
        client_id: clientId || null,
      },
    });

    return res.json({ ok: true });
  } catch (err: any) {
    console.error('[automation-events] appointment.cancelled error:', err.message);
    return res.status(500).json({ error: err.message });
  }
});

// ── POST /automations/events/job-completed ──
// Called when a job status is changed to "completed"
router.post('/automations/events/job-completed', validate(automationEventSchema), async (req, res) => {
  try {
    const auth = await requireAuthedClient(req, res);
    if (!auth) return;

    const { jobId } = req.body;
    if (!jobId) return res.status(400).json({ error: 'jobId is required' });

    // Fetch job + client details for variable resolution
    const admin = getServiceClient();
    const { data: job } = await admin
      .from('jobs')
      .select('title, client_id, status')
      .eq('id', jobId)
      .maybeSingle();

    if (!job) return res.status(404).json({ error: 'Job not found' });

    let clientName = '';
    let clientEmail = '';
    let clientPhone = '';

    if (job.client_id) {
      const { data: client } = await admin
        .from('clients')
        .select('first_name, last_name, email, phone')
        .eq('id', job.client_id)
        .maybeSingle();
      if (client) {
        clientName = `${client.first_name || ''} ${client.last_name || ''}`.trim();
        clientEmail = client.email || '';
        clientPhone = client.phone || '';
      }
    }

    await eventBus.emit('job.completed', {
      orgId: auth.orgId,
      entityType: 'job',
      entityId: jobId,
      actorId: auth.user.id,
      metadata: {
        job_name: job.title || '',
        client_id: job.client_id || null,
        client_name: clientName,
        client_email: clientEmail,
        client_phone: clientPhone,
      },
    });

    return res.json({ ok: true });
  } catch (err: any) {
    console.error('[automation-events] job.completed error:', err.message);
    return res.status(500).json({ error: err.message });
  }
});

export default router;
