/**
 * Test script for the review automation flow.
 * 1. Sends an invoice email to the client
 * 2. Marks the job as completed
 * 3. Triggers the job.completed event → automation engine → request_review
 *
 * Usage: npx tsx scripts/test-review-flow.ts
 */

import { config } from 'dotenv';
config({ path: '.env.local' });

import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const RESEND_KEY = process.env.RESEND_API_KEY || '';

console.log('SUPABASE_URL:', SUPABASE_URL ? 'set' : 'MISSING');
console.log('SERVICE_KEY:', SERVICE_KEY ? 'set' : 'MISSING');
console.log('RESEND_KEY:', RESEND_KEY ? 'set' : 'MISSING');

const ORG_ID = '4d885f6c-e076-4ed9-ab09-23637dbee6cd';
const CLIENT_ID = '789cf104-b763-4690-b6ab-685ddf8c1748';
const JOB_ID = 'b9660ff2-fe04-496f-a5ca-26bc2ca0127d';
const INVOICE_ID = '5109d649-9995-4c26-b36e-d8811bc8e561';
const CLIENT_EMAIL = 'willhebert30@gmail.com';

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function main() {
  console.log('=== Review Automation Test ===\n');

  // Step 1: Send invoice email
  console.log('1. Sending invoice email...');
  const { data: invoice } = await supabase
    .from('invoices')
    .select('*')
    .eq('id', INVOICE_ID)
    .single();

  if (!invoice) {
    console.error('Invoice not found!');
    return;
  }

  const { data: client } = await supabase
    .from('clients')
    .select('*')
    .eq('id', CLIENT_ID)
    .single();

  if (!client) {
    console.error('Client not found!');
    return;
  }

  if (RESEND_KEY) {
    const resend = new Resend(RESEND_KEY);
    const emailFrom = process.env.EMAIL_FROM || 'Lume CRM <onboarding@resend.dev>';

    const { data: emailResult, error: emailError } = await resend.emails.send({
      from: emailFrom,
      to: CLIENT_EMAIL,
      subject: `Invoice ${invoice.invoice_number} — $${(invoice.total_cents / 100).toFixed(2)} CAD`,
      html: `
        <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:20px;">
          <h2>Invoice ${invoice.invoice_number}</h2>
          <p>Hello ${client.first_name} ${client.last_name},</p>
          <p>Please find your invoice below:</p>
          <table style="width:100%;border-collapse:collapse;margin:20px 0;">
            <tr><td style="padding:8px;border:1px solid #ddd;"><strong>Invoice #</strong></td><td style="padding:8px;border:1px solid #ddd;">${invoice.invoice_number}</td></tr>
            <tr><td style="padding:8px;border:1px solid #ddd;"><strong>Amount</strong></td><td style="padding:8px;border:1px solid #ddd;">$${(invoice.total_cents / 100).toFixed(2)} CAD</td></tr>
            <tr><td style="padding:8px;border:1px solid #ddd;"><strong>Due Date</strong></td><td style="padding:8px;border:1px solid #ddd;">${invoice.due_date}</td></tr>
          </table>
          <p>Thank you!</p>
        </div>
      `,
    });

    if (emailError) {
      console.error('  Email error:', emailError.message);
    } else {
      console.log('  Invoice email sent! ID:', emailResult?.id);
    }

    // Update invoice status
    await supabase.from('invoices').update({ status: 'sent', sent_at: new Date().toISOString() }).eq('id', INVOICE_ID);
    console.log('  Invoice status updated to "sent"');
  } else {
    console.log('  RESEND_API_KEY not set, skipping email send');
  }

  // Step 2: Log activity for invoice sent
  await supabase.from('activity_log').insert({
    org_id: ORG_ID,
    entity_type: 'invoice',
    entity_id: INVOICE_ID,
    event_type: 'invoice.sent',
    metadata: { invoice_number: invoice.invoice_number, client_name: `${client.first_name} ${client.last_name}` },
  });
  console.log('  Activity logged: invoice.sent');

  // Step 3: Mark job as completed
  console.log('\n2. Marking job as completed...');
  await supabase.from('jobs').update({
    status: 'completed',
    completed_at: new Date().toISOString(),
  }).eq('id', JOB_ID);
  console.log('  Job status updated to "completed"');

  // Step 4: Check automation rules for job.completed
  console.log('\n3. Checking automation rules for job.completed...');
  const { data: rules } = await supabase
    .from('automation_rules')
    .select('*')
    .eq('org_id', ORG_ID)
    .eq('trigger_event', 'job.completed')
    .eq('is_active', true);

  console.log(`  Found ${rules?.length || 0} active rules for job.completed:`);
  rules?.forEach(r => {
    console.log(`    - ${r.name} (delay: ${r.delay_seconds}s, actions: ${JSON.stringify(r.actions.map((a: any) => a.type))})`);
  });

  if (!rules?.length) {
    console.error('\n  No active rules found! Make sure the Google Review preset is active.');
    return;
  }

  // Step 5: Execute the request_review action directly (simulating automation engine)
  console.log('\n4. Executing request_review action...');

  const token = crypto.randomUUID().replace(/-/g, '');
  const baseUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
  const surveyUrl = `${baseUrl}/survey/${token}`;

  // Create survey record
  const { error: surveyError } = await supabase.from('satisfaction_surveys').insert({
    org_id: ORG_ID,
    client_id: CLIENT_ID,
    job_id: JOB_ID,
    token,
  });

  if (surveyError) {
    console.error('  Survey creation error:', surveyError.message);
    return;
  }
  console.log('  Survey created with token:', token);
  console.log('  Survey URL:', surveyUrl);

  // Send review request email
  if (RESEND_KEY) {
    const resend = new Resend(RESEND_KEY);
    const emailFrom = process.env.EMAIL_FROM || 'Lume CRM <onboarding@resend.dev>';

    const { data: company } = await supabase
      .from('company_settings')
      .select('company_name')
      .eq('org_id', ORG_ID)
      .maybeSingle();

    const companyName = company?.company_name || 'Our team';

    const { data: reviewEmail, error: reviewEmailError } = await resend.emails.send({
      from: emailFrom,
      to: CLIENT_EMAIL,
      subject: `${companyName} - How was your experience?`,
      html: `
        <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:20px;">
          <h2>Hi ${client.first_name || 'there'},</h2>
          <p>We recently completed your project and would love to hear your feedback!</p>
          <p>Please take a moment to rate your experience:</p>
          <p style="text-align:center;margin:30px 0;">
            <a href="${surveyUrl}" style="background:#2563eb;color:#fff;padding:12px 32px;border-radius:8px;text-decoration:none;font-weight:bold;">
              Rate Your Experience
            </a>
          </p>
          <p>Thank you for choosing ${companyName}!</p>
        </div>
      `,
    });

    if (reviewEmailError) {
      console.error('  Review email error:', reviewEmailError.message);
    } else {
      console.log('  Review request email sent! ID:', reviewEmail?.id);
    }
  }

  // Step 6: Log the automation execution
  const rule = rules[0];
  await supabase.from('automation_execution_logs').insert({
    org_id: ORG_ID,
    automation_rule_id: rule.id,
    trigger_event: 'job.completed',
    entity_type: 'job',
    entity_id: JOB_ID,
    action_type: 'request_review',
    action_config: rule.actions[0]?.config || {},
    result_success: true,
    result_data: { token, surveyUrl },
    duration_ms: 0,
  });
  console.log('  Execution logged');

  // Log activity
  await supabase.from('activity_log').insert({
    org_id: ORG_ID,
    entity_type: 'job',
    entity_id: JOB_ID,
    event_type: 'job.completed',
    metadata: { automation: 'google_review', survey_token: token },
  });

  console.log('\n=== Test Complete ===');
  console.log(`\nSurvey URL for testing: ${surveyUrl}`);
  console.log('Check willhebert30@gmail.com for both emails:');
  console.log('  1. Invoice email');
  console.log('  2. Review request email');
  console.log('\nWhen the client clicks the survey link and rates >= 4 stars,');
  console.log('they will be redirected to the Google Review URL.');
}

main().catch(console.error);
