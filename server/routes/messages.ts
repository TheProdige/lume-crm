import { Router } from 'express';
import { requireAuthedClient } from '../lib/supabase';
import { getServiceClient } from '../lib/supabase';
import { twilioClient, twilioPhoneNumber, twilioAuthToken, Twilio } from '../lib/config';
import { normalizeE164, findOrCreateConversation, resolvePublicBaseUrl } from '../lib/helpers';
import { validate, messageSendSchema } from '../lib/validation';

const router = Router();

// POST /api/messages/send — Send SMS via Twilio
router.post('/messages/send', validate(messageSendSchema), async (req, res) => {
  try {
    const authed = await requireAuthedClient(req, res);
    if (!authed) return;
    const { client: userClient, orgId, user } = authed;

    if (!twilioClient) {
      return res.status(503).json({ error: 'Twilio is not configured. Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_PHONE_NUMBER.' });
    }

    const { phone_number, message_text, client_id, client_name } = req.body || {};
    if (!phone_number || !message_text) {
      return res.status(400).json({ error: 'phone_number and message_text are required.' });
    }

    const normalizedPhone = normalizeE164(phone_number);
    const serviceClient = getServiceClient();

    // Find or create conversation
    const conversation = await findOrCreateConversation(serviceClient, orgId, normalizedPhone, client_id, client_name);

    // Send via Twilio
    const twilioMessage = await twilioClient.messages.create({
      body: message_text,
      from: twilioPhoneNumber,
      to: normalizedPhone,
    });

    // Save message to database
    const { data: message, error: msgError } = await serviceClient
      .from('messages')
      .insert({
        conversation_id: conversation.id,
        org_id: orgId,
        client_id: conversation.client_id || client_id || null,
        phone_number: normalizedPhone,
        direction: 'outbound',
        message_text,
        status: 'sent',
        provider_message_id: twilioMessage.sid,
        sender_user_id: user.id,
      })
      .select('*')
      .single();

    if (msgError) throw msgError;

    return res.json(message);
  } catch (error: any) {
    console.error('SMS send error:', error);
    return res.status(500).json({ error: error?.message || 'Failed to send SMS.' });
  }
});

// POST /api/messages/inbound — Twilio webhook for incoming SMS
router.post('/messages/inbound', async (req, res) => {
  try {
    // Validate Twilio webhook signature — MANDATORY
    if (!twilioAuthToken) {
      console.error('Twilio auth token not configured — rejecting inbound webhook');
      return res.status(503).send('Twilio not configured');
    }

    const twilioSignature = req.headers['x-twilio-signature'] as string;
    if (!twilioSignature) {
      console.warn('Missing x-twilio-signature header');
      return res.status(403).send('Forbidden');
    }

    // Use env-based URL to prevent Host header spoofing
    const baseUrl = process.env.FRONTEND_URL || process.env.PUBLIC_BASE_URL || resolvePublicBaseUrl(req);
    const webhookUrl = `${baseUrl.replace(/\/$/, '')}/api/messages/inbound`;

    const isValid = Twilio.validateRequest(
      twilioAuthToken,
      twilioSignature,
      webhookUrl,
      req.body || {},
    );
    if (!isValid) {
      console.warn('Invalid Twilio webhook signature');
      return res.status(403).send('Forbidden');
    }

    const { From, Body, MessageSid } = req.body || {};
    if (!From || !Body) {
      return res.status(400).send('Missing From or Body');
    }

    const normalizedPhone = normalizeE164(From);
    const serviceClient = getServiceClient();

    // We need an org_id — find from existing conversation or default
    const { data: existingConvo } = await serviceClient
      .from('conversations')
      .select('id, org_id, client_id')
      .eq('phone_number', normalizedPhone)
      .limit(1)
      .maybeSingle();

    let conversation = existingConvo;
    let orgId = existingConvo?.org_id;

    // If no existing conversation, try to match by client phone
    if (!conversation) {
      const { data: client } = await serviceClient
        .from('clients')
        .select('id, first_name, last_name, phone')
        .or(`phone.eq.${normalizedPhone},phone.eq.${normalizedPhone.replace('+1', '')}`)
        .is('deleted_at', null)
        .limit(1)
        .maybeSingle();

      // Get the org from memberships or first org
      if (!orgId) {
        const { data: firstOrg } = await serviceClient
          .from('orgs')
          .select('id')
          .limit(1)
          .maybeSingle();
        orgId = firstOrg?.id || null;
      }

      const clientName = client
        ? `${client.first_name || ''} ${client.last_name || ''}`.trim()
        : null;

      const { data: created } = await serviceClient
        .from('conversations')
        .insert({
          org_id: orgId,
          client_id: client?.id || null,
          phone_number: normalizedPhone,
          client_name: clientName,
        })
        .select('*')
        .single();

      conversation = created;
    }

    if (!conversation) {
      console.error('Could not create conversation for inbound SMS from', normalizedPhone);
      return res.status(500).send('Could not process inbound message');
    }

    // Save inbound message
    await serviceClient
      .from('messages')
      .insert({
        conversation_id: conversation.id,
        org_id: orgId || conversation.org_id,
        client_id: conversation.client_id,
        phone_number: normalizedPhone,
        direction: 'inbound',
        message_text: Body,
        status: 'received',
        provider_message_id: MessageSid || null,
      });

    // Respond with empty TwiML (acknowledge receipt)
    res.set('Content-Type', 'text/xml');
    return res.send('<Response></Response>');
  } catch (error: any) {
    console.error('Inbound SMS error:', error);
    res.set('Content-Type', 'text/xml');
    return res.send('<Response></Response>');
  }
});

// POST /api/messages/status — Twilio status callback (delivery updates)
router.post('/messages/status', async (req, res) => {
  try {
    // Validate Twilio signature on status callbacks too
    if (twilioAuthToken) {
      const sig = req.headers['x-twilio-signature'] as string;
      if (sig) {
        const baseUrl = process.env.FRONTEND_URL || process.env.PUBLIC_BASE_URL || resolvePublicBaseUrl(req);
        const isValid = Twilio.validateRequest(twilioAuthToken, sig, `${baseUrl.replace(/\/$/, '')}/api/messages/status`, req.body || {});
        if (!isValid) return res.status(403).json({ error: 'Invalid signature' });
      }
    }

    const { MessageSid, MessageStatus } = req.body || {};
    if (!MessageSid || !MessageStatus) {
      return res.status(400).json({ error: 'Missing MessageSid or MessageStatus' });
    }

    const serviceClient = getServiceClient();

    // Map Twilio status to our status
    const statusMap: Record<string, string> = {
      queued: 'queued',
      sent: 'sent',
      delivered: 'delivered',
      undelivered: 'failed',
      failed: 'failed',
    };

    const mappedStatus = statusMap[MessageStatus] || MessageStatus;

    await serviceClient
      .from('messages')
      .update({ status: mappedStatus })
      .eq('provider_message_id', MessageSid);

    return res.json({ received: true });
  } catch (error: any) {
    console.error('Status callback error:', error);
    return res.status(500).json({ error: 'Failed to process status update' });
  }
});

export default router;
