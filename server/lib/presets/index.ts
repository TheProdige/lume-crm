/* ═══════════════════════════════════════════════════════════════
   Automation Presets — Predefined automation rules.
   Each preset defines a trigger, conditions, actions, and delay.
   Orgs activate presets from the Automations UI.
   ═══════════════════════════════════════════════════════════════ */

export interface AutomationPreset {
  key: string;
  name_en: string;
  name_fr: string;
  description_en: string;
  description_fr: string;
  trigger_event: string;
  conditions: Record<string, any>;
  delay_seconds: number;
  actions: Array<{ type: string; config: Record<string, any> }>;
}

// ── 1. Google Review ────────────────────────────────────────

export const GOOGLE_REVIEW_PRESET: AutomationPreset = {
  key: 'google_review',
  name_en: 'Google Review Request',
  name_fr: 'Demande d\'avis Google',
  description_en: 'Send a satisfaction survey after job completion. Happy clients (4-5 stars) are invited to leave a Google review.',
  description_fr: 'Envoie un sondage de satisfaction après la fin d\'un travail. Les clients satisfaits (4-5 étoiles) sont invités à laisser un avis Google.',
  trigger_event: 'job.completed',
  conditions: {},
  delay_seconds: 2 * 60 * 60, // 2 hours
  actions: [
    {
      type: 'request_review',
      config: {},
    },
  ],
};

// ── 2. Estimate Follow-Up (3 days) ─────────────────────────

export const ESTIMATE_FOLLOWUP_PRESET: AutomationPreset = {
  key: 'estimate_followup',
  name_en: 'Estimate Follow-Up (3 days)',
  name_fr: 'Relance soumission (3 jours)',
  description_en: 'Send a follow-up email 3 days after an estimate is sent, if not yet accepted or rejected.',
  description_fr: 'Envoie un email de relance 3 jours après l\'envoi d\'une soumission, si pas encore acceptée ou refusée.',
  trigger_event: 'estimate.sent',
  conditions: {},
  delay_seconds: 3 * 24 * 60 * 60, // 3 days
  actions: [
    {
      type: 'send_email',
      config: {
        subject: '[company_name] - Following up on your estimate',
        body: `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:20px;">
          <h2>Hi [client_first_name],</h2>
          <p>We sent you an estimate a few days ago and wanted to follow up.</p>
          <p>If you have any questions or would like to discuss the details, please don't hesitate to reach out.</p>
          <p>We'd love to help you with your project!</p>
          <p>Best regards,<br/>[company_name]</p>
        </div>`,
      },
    },
    {
      type: 'send_sms',
      config: {
        body: 'Hi [client_first_name], just following up on the estimate we sent. Let us know if you have any questions! - [company_name]',
      },
    },
    {
      type: 'log_activity',
      config: {
        event_type: 'follow_up_sent',
        metadata: { type: 'estimate_followup', method: 'email+sms' },
      },
    },
  ],
};

// ── 3. Appointment Reminders ────────────────────────────────

export const APPOINTMENT_REMINDER_IMMEDIATE: AutomationPreset = {
  key: 'appointment_confirmation',
  name_en: 'Appointment Confirmation',
  name_fr: 'Confirmation de rendez-vous',
  description_en: 'Send a confirmation email/SMS immediately after an appointment is created.',
  description_fr: 'Envoie un email/SMS de confirmation immédiatement après la création d\'un rendez-vous.',
  trigger_event: 'appointment.created',
  conditions: {},
  delay_seconds: 0,
  actions: [
    {
      type: 'send_email',
      config: {
        subject: '[company_name] - Appointment Confirmed',
        body: `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:20px;">
          <h2>Hi [client_first_name],</h2>
          <p>Your appointment has been confirmed:</p>
          <ul>
            <li><strong>Date:</strong> [appointment_date]</li>
            <li><strong>Time:</strong> [appointment_time]</li>
            <li><strong>Location:</strong> [appointment_address]</li>
          </ul>
          <p>If you need to reschedule, please contact us.</p>
          <p>See you soon!<br/>[company_name]</p>
        </div>`,
      },
    },
    {
      type: 'send_sms',
      config: {
        body: 'Your appointment with [company_name] is confirmed for [appointment_date] at [appointment_time]. See you there!',
      },
    },
  ],
};

export const APPOINTMENT_REMINDER_7DAYS: AutomationPreset = {
  key: 'appointment_reminder_7d',
  name_en: 'Appointment Reminder (7 days before)',
  name_fr: 'Rappel de rendez-vous (7 jours avant)',
  description_en: 'Send a reminder 7 days before the appointment.',
  description_fr: 'Envoie un rappel 7 jours avant le rendez-vous.',
  trigger_event: 'appointment.created',
  conditions: {},
  delay_seconds: -7, // Special: negative = days before event
  actions: [
    {
      type: 'send_email',
      config: {
        subject: '[company_name] - Appointment Reminder (1 week)',
        body: `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:20px;">
          <h2>Hi [client_first_name],</h2>
          <p>This is a friendly reminder that your appointment is coming up in one week:</p>
          <ul>
            <li><strong>Date:</strong> [appointment_date]</li>
            <li><strong>Time:</strong> [appointment_time]</li>
            <li><strong>Location:</strong> [appointment_address]</li>
          </ul>
          <p>See you soon!<br/>[company_name]</p>
        </div>`,
      },
    },
    {
      type: 'send_sms',
      config: {
        body: 'Reminder: Your appointment with [company_name] is in 1 week — [appointment_date] at [appointment_time].',
      },
    },
  ],
};

export const APPOINTMENT_REMINDER_1DAY: AutomationPreset = {
  key: 'appointment_reminder_1d',
  name_en: 'Appointment Reminder (1 day before)',
  name_fr: 'Rappel de rendez-vous (1 jour avant)',
  description_en: 'Send a reminder 1 day before the appointment.',
  description_fr: 'Envoie un rappel 1 jour avant le rendez-vous.',
  trigger_event: 'appointment.created',
  conditions: {},
  delay_seconds: -1, // Special: negative = days before event
  actions: [
    {
      type: 'send_email',
      config: {
        subject: '[company_name] - Appointment Tomorrow!',
        body: `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:20px;">
          <h2>Hi [client_first_name],</h2>
          <p>Just a reminder that your appointment is <strong>tomorrow</strong>:</p>
          <ul>
            <li><strong>Date:</strong> [appointment_date]</li>
            <li><strong>Time:</strong> [appointment_time]</li>
            <li><strong>Location:</strong> [appointment_address]</li>
          </ul>
          <p>See you there!<br/>[company_name]</p>
        </div>`,
      },
    },
    {
      type: 'send_sms',
      config: {
        body: 'Reminder: Your appointment with [company_name] is tomorrow at [appointment_time]. See you there!',
      },
    },
  ],
};

// ── 4. Invoice Reminders ────────────────────────────────────

function invoiceReminderPreset(
  key: string,
  daysAfterDue: number,
  nameEn: string,
  nameFr: string,
  extraActions: Array<{ type: string; config: Record<string, any> }> = [],
): AutomationPreset {
  const isUrgent = daysAfterDue >= 15;
  return {
    key,
    name_en: nameEn,
    name_fr: nameFr,
    description_en: `Send a payment reminder ${daysAfterDue} day(s) after the invoice due date.`,
    description_fr: `Envoie un rappel de paiement ${daysAfterDue} jour(s) après la date d'échéance.`,
    trigger_event: 'invoice.overdue',
    conditions: { days_overdue: daysAfterDue },
    delay_seconds: 0, // The scheduler detects overdue invoices
    actions: [
      {
        type: 'send_email',
        config: {
          subject: isUrgent
            ? '[company_name] - Urgent: Invoice [invoice_number] Past Due'
            : '[company_name] - Payment Reminder: Invoice [invoice_number]',
          body: `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:20px;">
            <h2>Hi [client_first_name],</h2>
            <p>${isUrgent ? 'This is an urgent reminder that' : 'Just a friendly reminder that'} invoice <strong>[invoice_number]</strong> for <strong>[invoice_total]</strong> ${isUrgent ? 'is now significantly past due' : 'is past due'}.</p>
            <p>Please arrange payment at your earliest convenience.</p>
            <p>If you've already sent payment, please disregard this message.</p>
            <p>Thank you,<br/>[company_name]</p>
          </div>`,
        },
      },
      {
        type: 'send_sms',
        config: {
          body: `${isUrgent ? 'Urgent: ' : ''}Reminder: Invoice [invoice_number] ([invoice_total]) is past due. Please arrange payment. - [company_name]`,
        },
      },
      {
        type: 'log_activity',
        config: {
          event_type: 'invoice_reminded',
          metadata: { days_overdue: daysAfterDue },
        },
      },
      ...extraActions,
    ],
  };
}

export const INVOICE_REMINDER_1 = invoiceReminderPreset(
  'invoice_reminder_1d', 1,
  'Invoice Reminder (J+1)', 'Relance facture (J+1)',
);
export const INVOICE_REMINDER_3 = invoiceReminderPreset(
  'invoice_reminder_3d', 3,
  'Invoice Reminder (J+3)', 'Relance facture (J+3)',
);
export const INVOICE_REMINDER_5 = invoiceReminderPreset(
  'invoice_reminder_5d', 5,
  'Invoice Reminder (J+5)', 'Relance facture (J+5)',
);
export const INVOICE_REMINDER_15 = invoiceReminderPreset(
  'invoice_reminder_15d', 15,
  'Invoice Reminder (J+15)', 'Relance facture (J+15)',
);
export const INVOICE_REMINDER_30 = invoiceReminderPreset(
  'invoice_reminder_30d', 30,
  'Invoice Reminder (J+30)', 'Relance facture (J+30)',
  [
    {
      type: 'create_notification',
      config: {
        title: 'Invoice [invoice_number] — 30 days overdue',
        body: '[client_name] has an invoice overdue for 30 days ([invoice_total]). Please follow up.',
      },
    },
    {
      type: 'create_task',
      config: {
        title: 'Follow up: Invoice [invoice_number] — 30 days overdue',
        description: 'Client [client_name] has not paid invoice [invoice_number] ([invoice_total]) for 30 days.',
      },
    },
  ],
);

// ── All presets ─────────────────────────────────────────────

export const ALL_PRESETS: AutomationPreset[] = [
  GOOGLE_REVIEW_PRESET,
  ESTIMATE_FOLLOWUP_PRESET,
  APPOINTMENT_REMINDER_IMMEDIATE,
  APPOINTMENT_REMINDER_7DAYS,
  APPOINTMENT_REMINDER_1DAY,
  INVOICE_REMINDER_1,
  INVOICE_REMINDER_3,
  INVOICE_REMINDER_5,
  INVOICE_REMINDER_15,
  INVOICE_REMINDER_30,
];
