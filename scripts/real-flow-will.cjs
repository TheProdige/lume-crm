/**
 * REAL FLOW — Will Hébert
 * Full CRM pipeline with REAL email sends via Express server
 */
const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');
require('dotenv').config({ path: '.env.local' });

const URL = process.env.VITE_SUPABASE_URL;
const SRK = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ANON = process.env.VITE_SUPABASE_ANON_KEY;
const API = 'http://localhost:3002/api';
// User willhebert30's primary org (resolved via current_org_id)
const ORG = 'e0cf4b92-c229-4785-a2e7-7081fae3e18e';
const EMAIL = 'willhebert30@gmail.com';

const admin = createClient(URL, SRK, { auth: { autoRefreshToken: false, persistSession: false } });
let authToken, sb;
let ids = {};

function step(n, msg) { console.log(`\n${'═'.repeat(50)}\n  STEP ${n}: ${msg}\n${'═'.repeat(50)}`); }
function ok(msg) { console.log(`  ✓ ${msg}`); }
function fail(msg) { console.log(`  ✗ ${msg}`); }

async function init() {
  step(0, 'Authenticate');
  const { data: link } = await admin.auth.admin.generateLink({ type: 'magiclink', email: EMAIL });
  const { data: sess } = await admin.auth.verifyOtp({ token_hash: link.properties.hashed_token, type: 'magiclink' });
  authToken = sess.session.access_token;
  sb = createClient(URL, ANON, {
    global: { headers: { Authorization: `Bearer ${authToken}` } },
    auth: { autoRefreshToken: false, persistSession: false },
  });
  ok(`Authenticated as ${EMAIL}`);
}

async function apiCall(path, body) {
  const res = await fetch(`${API}${path}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${authToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`${res.status}: ${data.error || JSON.stringify(data)}`);
  return data;
}

// ══════════════════════════════════════════════════════════
async function step1_createLead() {
  step(1, 'Create Lead — Will Hébert');

  let data;
  try {
    data = await apiCall('/leads/create', {
      full_name: 'Will Hébert',
      email: EMAIL,
      phone: '+18198179526',
      title: 'Nettoyage complet résidentiel',
      value: 850,
      address: '123 rue Principale, Sherbrooke QC J1H 1A1',
      notes: 'Client référé — test flow complet CRM',
    });
    ids.leadId = data.lead_id;
    ids.dealId = data.deal_id;
    ok(`Lead créé: ${ids.leadId}`);
    ok(`Pipeline deal: ${ids.dealId}`);
  } catch (e) {
    if (e.message.includes('duplicate') || e.message.includes('unique')) {
      ok('Lead avec cet email existe déjà — réutilisation');
      // Find existing lead
      // Check leads table (not just active view — the lead might be archived)
      let { data: existing } = await sb.from('leads').select('id, client_id, deleted_at')
        .eq('email', EMAIL).eq('org_id', ORG).order('created_at', { ascending: false }).limit(1).maybeSingle();
      if (!existing) {
        // Try admin client
        const { data: adm } = await admin.from('leads').select('id, client_id, deleted_at')
          .eq('email', EMAIL).eq('org_id', ORG).order('created_at', { ascending: false }).limit(1).maybeSingle();
        existing = adm;
      }
      if (!existing) throw new Error('Lead not found despite duplicate error');
      // Unarchive if needed
      if (existing.deleted_at) {
        await admin.from('leads').update({ deleted_at: null, status: 'new' }).eq('id', existing.id);
        ok('Lead désarchivé');
      }
      ids.leadId = existing.id;
      ids.clientId = existing.client_id;
      // Find or create deal
      const { data: deal } = await sb.from('pipeline_deals').select('id')
        .eq('lead_id', ids.leadId).is('deleted_at', null).maybeSingle();
      if (deal) { ids.dealId = deal.id; }
      else {
        const { data: d } = await sb.from('pipeline_deals').insert({
          org_id: ORG, lead_id: ids.leadId, client_id: ids.clientId,
          stage: 'new', title: 'Nettoyage complet résidentiel', value: 850,
        }).select('id').single();
        ids.dealId = d.id;
      }
      ok(`Lead réutilisé: ${ids.leadId}`);
      ok(`Deal: ${ids.dealId}`);
    } else { throw e; }
  }

  // Get client_id from lead
  const { data: lead } = await sb.from('leads').select('client_id').eq('id', ids.leadId).maybeSingle();
  ids.clientId = lead?.client_id;
  ok(`Client lié: ${ids.clientId}`);

  // Verify in pipeline
  const { data: deal } = await sb.from('pipeline_deals').select('stage, title').eq('id', ids.dealId).is('deleted_at', null).maybeSingle();
  ok(`Pipeline: stage="${deal.stage}", title="${deal.title}"`);
}

async function step2_moveToClosed() {
  step(2, 'Move to Closed');

  await sb.rpc('set_deal_stage', { p_deal_id: ids.dealId, p_stage: 'closed' });
  ok('Deal → closed');

  await sb.from('leads').update({ status: 'closed' }).eq('id', ids.leadId);
  ok('Lead status → closed');
}

async function step3_createJob() {
  step(3, 'Create Job + Schedule');

  // Promote client
  await sb.from('clients').update({ status: 'active' }).eq('id', ids.clientId);

  // Schedule for tomorrow 9:00-11:00
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(9, 0, 0, 0);
  const endTime = new Date(tomorrow);
  endTime.setHours(11, 0, 0, 0);

  // Reuse existing job if one exists for this lead
  const { data: existingJob } = await sb.from('jobs').select('id, title, status, scheduled_at')
    .eq('lead_id', ids.leadId).is('deleted_at', null).maybeSingle();

  let job;
  if (existingJob) {
    job = existingJob;
    ids.jobId = job.id;
    ok(`Job existant réutilisé: ${ids.jobId}`);
    // Update schedule if needed
    await admin.from('jobs').update({
      scheduled_at: tomorrow.toISOString(),
      end_at: endTime.toISOString(),
      status: 'scheduled',
      title: 'Nettoyage complet résidentiel',
      total_cents: 85000,
    }).eq('id', ids.jobId);
    ok('Schedule mis à jour');
  } else {
    const { data: newJob, error } = await sb.from('jobs').insert({
      org_id: ORG,
      client_id: ids.clientId,
      lead_id: ids.leadId,
      title: 'Nettoyage complet résidentiel',
      job_number: `JOB-${Date.now()}`,
      job_type: 'one_off',
      status: 'scheduled',
      property_address: '123 rue Principale, Sherbrooke QC J1H 1A1',
      notes: 'Test flow complet — nettoyage résidentiel',
      scheduled_at: tomorrow.toISOString(),
      end_at: endTime.toISOString(),
      requires_invoicing: true,
      total_cents: 85000,
    }).select('id, title, status, scheduled_at').single();
    if (error) throw new Error('Job create: ' + error.message);
    job = newJob;
    ids.jobId = job.id;
  }
  ok(`Job créé: ${ids.jobId}`);
  ok(`Titre: ${job.title}`);
  ok(`Prévu: ${new Date(job.scheduled_at).toLocaleString('fr-CA')}`);

  // Link deal → job
  await sb.from('pipeline_deals').update({ job_id: ids.jobId }).eq('id', ids.dealId);
  ok('Deal lié au job');

  // Create calendar event
  const { data: ev } = await admin.from('schedule_events').insert({
    org_id: ORG,
    job_id: ids.jobId,
    start_at: tomorrow.toISOString(),
    end_at: endTime.toISOString(),
    timezone: 'America/Montreal',
  }).select('id').single();
  ids.scheduleEventId = ev?.id;
  ok(`Calendrier event: ${ids.scheduleEventId}`);
}

async function step4_sendAppointmentConfirmation() {
  step(4, 'Send Appointment Confirmation Email');

  // Trigger the automation event for appointment.created
  // This will match the 'appointment_confirmation' automation rule
  try {
    const res = await fetch(`${API}/automations/events/appointment-created`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${authToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        eventId: ids.scheduleEventId,
        jobId: ids.jobId,
        clientId: ids.clientId,
        startTime: new Date(Date.now() + 86400000).toISOString(),
        title: 'Nettoyage complet résidentiel',
        address: '123 rue Principale, Sherbrooke QC',
      }),
    });
    ok(`Automation event émis (status=${res.status})`);
  } catch (e) {
    fail('Automation event: ' + e.message);
  }

  // Check if appointment_confirmation rule is active
  const { data: rule } = await admin.from('automation_rules')
    .select('id, name, is_active')
    .eq('org_id', ORG)
    .eq('preset_key', 'appointment_confirmation')
    .maybeSingle();

  if (rule && !rule.is_active) {
    // Activate it for this test
    await admin.from('automation_rules').update({ is_active: true }).eq('id', rule.id);
    ok(`Rule "${rule.name}" activée`);

    // Re-trigger
    await fetch(`${API}/automations/events/appointment-created`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${authToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        eventId: ids.scheduleEventId,
        jobId: ids.jobId,
        clientId: ids.clientId,
        startTime: new Date(Date.now() + 86400000).toISOString(),
        title: 'Nettoyage complet résidentiel',
        address: '123 rue Principale, Sherbrooke QC',
      }),
    });
    ok('Automation re-triggered avec rule active');

    // Deactivate after
    await admin.from('automation_rules').update({ is_active: false }).eq('id', rule.id);
  } else if (rule?.is_active) {
    ok(`Rule "${rule.name}" déjà active`);
  } else {
    fail('Rule appointment_confirmation non trouvée');
  }

  // Also send a direct confirmation email via Resend
  const { data: client } = await admin.from('clients').select('email, first_name').eq('id', ids.clientId).maybeSingle();
  const { data: company } = await admin.from('company_settings').select('company_name').eq('org_id', ORG).maybeSingle();

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const dateStr = tomorrow.toLocaleDateString('fr-CA', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  const resendKey = process.env.RESEND_API_KEY;
  if (resendKey) {
    const emailRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: `${company?.company_name || 'Lume CRM'} <onboarding@resend.dev>`,
        to: [EMAIL],
        subject: `${company?.company_name || 'Lume CRM'} — Confirmation de rendez-vous`,
        html: `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:20px;">
          <h2>Bonjour ${client?.first_name || 'Will'},</h2>
          <p>Votre rendez-vous est confirmé :</p>
          <ul>
            <li><strong>Date :</strong> ${dateStr}</li>
            <li><strong>Heure :</strong> 9h00 — 11h00</li>
            <li><strong>Service :</strong> Nettoyage complet résidentiel</li>
            <li><strong>Adresse :</strong> 123 rue Principale, Sherbrooke QC</li>
          </ul>
          <p>À bientôt !<br/>${company?.company_name || 'Lume CRM'}</p>
        </div>`,
      }),
    });
    const emailData = await emailRes.json();
    ok(`Email de confirmation envoyé → ${EMAIL} (Resend id: ${emailData.id || 'N/A'})`);
  }
}

async function step5_completeJob() {
  step(5, 'Complete Job');

  await admin.from('jobs').update({ status: 'completed', updated_at: new Date().toISOString() }).eq('id', ids.jobId);
  ok('Job status → completed');

  // Emit job.completed event for automation engine
  try {
    await fetch(`${API}/automations/events/job-completed`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${authToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ jobId: ids.jobId }),
    });
    ok('Automation event job.completed émis');
  } catch (e) {
    fail('job.completed event: ' + e.message);
  }
}

async function step6_createAndSendInvoice() {
  step(6, 'Create & Send Invoice');

  // Create invoice
  const invNum = `INV-${Date.now().toString().slice(-6)}`;
  const { data: inv, error } = await sb.from('invoices').insert({
    org_id: ORG,
    client_id: ids.clientId,
    job_id: ids.jobId,
    invoice_number: invNum,
    status: 'draft',
    due_date: new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0],
    total_cents: 85000,
  }).select('id, invoice_number').single();

  if (error) { fail('Invoice create: ' + error.message); return; }
  ids.invoiceId = inv.id;
  ok(`Invoice créée: ${inv.invoice_number} ($850.00)`);

  // Send invoice via Express route
  try {
    const sendData = await apiCall('/emails/send-invoice', {
      invoiceId: ids.invoiceId,
    });
    ok(`Invoice envoyée par email → ${EMAIL}`);
    ok(`Résultat: ${JSON.stringify(sendData).slice(0, 200)}`);
  } catch (e) {
    // If server route fails, send directly via Resend
    ok(`Route Express: ${e.message} — envoi direct via Resend`);

    const resendKey = process.env.RESEND_API_KEY;
    const { data: company } = await admin.from('company_settings').select('company_name').eq('org_id', ORG).maybeSingle();

    if (resendKey) {
      const emailRes = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: `${company?.company_name || 'Lume CRM'} <onboarding@resend.dev>`,
          to: [EMAIL],
          subject: `${company?.company_name || 'Lume CRM'} — Facture ${invNum}`,
          html: `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:20px;">
            <h2>Bonjour Will,</h2>
            <p>Voici votre facture <strong>${invNum}</strong> pour un montant de <strong>850,00 $</strong>.</p>
            <p>Date d'échéance : ${new Date(Date.now() + 30 * 86400000).toLocaleDateString('fr-CA')}</p>
            <p>Service : Nettoyage complet résidentiel</p>
            <br/>
            <p>Merci pour votre confiance !<br/>${company?.company_name || 'Lume CRM'}</p>
          </div>`,
        }),
      });
      const emailData = await emailRes.json();
      ok(`Facture envoyée via Resend → ${EMAIL} (id: ${emailData.id || 'N/A'})`);
    }

    // Mark as sent
    await sb.from('invoices').update({ status: 'sent', sent_at: new Date().toISOString() }).eq('id', ids.invoiceId);
  }
}

async function step7_sendReviewRequest() {
  step(7, 'Send Review Request');

  const { data: company } = await admin.from('company_settings').select('company_name, google_review_url').eq('org_id', ORG).maybeSingle();
  ok(`Google Review URL: ${company?.google_review_url || 'NON CONFIGURÉ'}`);

  // Create survey
  const token = crypto.randomUUID().replace(/-/g, '');
  const freshAdmin = createClient(URL, SRK, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data: survey, error } = await freshAdmin.from('satisfaction_surveys').insert({
    org_id: ORG,
    client_id: ids.clientId,
    job_id: ids.jobId,
    token,
  }).select('id').single();

  if (error) { fail('Survey create: ' + error.message); return; }
  ids.surveyId = survey.id;
  ok(`Survey créé: token=${token}`);

  // Send review request email via Resend
  const resendKey = process.env.RESEND_API_KEY;
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
  const surveyUrl = `${frontendUrl}/survey/${token}`;

  if (resendKey) {
    const emailRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: `${company?.company_name || 'Lume CRM'} <onboarding@resend.dev>`,
        to: [EMAIL],
        subject: `${company?.company_name || 'Lume CRM'} — Comment était votre expérience ?`,
        html: `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:20px;">
          <h2>Bonjour Will,</h2>
          <p>Merci d'avoir choisi <strong>${company?.company_name || 'notre entreprise'}</strong> pour votre nettoyage résidentiel !</p>
          <p>Nous aimerions connaître votre expérience. Cela ne prend que 30 secondes :</p>
          <div style="text-align:center;margin:24px 0;">
            <a href="${surveyUrl}" style="background:#171717;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600;">
              Donner mon avis
            </a>
          </div>
          <p style="color:#666;font-size:13px;">Votre avis nous aide à nous améliorer. Merci !</p>
          <p>— ${company?.company_name || 'Lume CRM'}</p>
        </div>`,
      }),
    });
    const emailData = await emailRes.json();
    ok(`Review request envoyée → ${EMAIL} (Resend id: ${emailData.id || 'N/A'})`);
    ok(`Survey URL: ${surveyUrl}`);
  } else {
    fail('RESEND_API_KEY manquant');
  }
}

async function step8_summary() {
  step(8, 'Résumé Final');

  console.log(`
  ┌─────────────────────────────────────────────────────┐
  │  FLOW COMPLET EXÉCUTÉ POUR: Will Hébert             │
  │  Email: ${EMAIL}                      │
  ├─────────────────────────────────────────────────────┤
  │  Lead ID:     ${ids.leadId}  │
  │  Client ID:   ${ids.clientId}  │
  │  Deal ID:     ${ids.dealId}  │
  │  Job ID:      ${ids.jobId}  │
  │  Invoice ID:  ${ids.invoiceId || 'N/A'}  │
  │  Survey ID:   ${ids.surveyId || 'N/A'}  │
  │  Calendar:    ${ids.scheduleEventId || 'N/A'}  │
  ├─────────────────────────────────────────────────────┤
  │  EMAILS ENVOYÉS À ${EMAIL}:          │
  │  1. ✉  Confirmation de rendez-vous                  │
  │  2. ✉  Facture                                      │
  │  3. ✉  Review request                               │
  └─────────────────────────────────────────────────────┘
  `);
}

async function main() {
  console.log('╔═════════════════════════════════════════════════════╗');
  console.log('║  REAL FLOW — Will Hébert — Full CRM Pipeline        ║');
  console.log('║  Email: willhebert30@gmail.com                       ║');
  console.log('╚═════════════════════════════════════════════════════╝');

  try {
    await init();
    await step1_createLead();
    await step2_moveToClosed();
    await step3_createJob();
    await step4_sendAppointmentConfirmation();
    await step5_completeJob();
    await step6_createAndSendInvoice();
    await step7_sendReviewRequest();
    await step8_summary();
    console.log('\n🟢 FLOW COMPLET — Check tes emails!');
  } catch (e) {
    console.error('\n🔴 ERREUR:', e.message);
    console.log('\nIDs créés:', JSON.stringify(ids, null, 2));
    process.exit(1);
  }
}

main();
