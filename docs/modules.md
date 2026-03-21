# Modules — Lume CRM

## Dashboard
- **Page**: `src/pages/Dashboard.tsx`
- **API**: `src/lib/dashboardApi.ts`
- **Purpose**: KPI overview — revenue, job counts, lead funnel, recent activity
- **Data**: Aggregates from jobs, invoices, payments, leads
- **Interactions**: Links to Jobs, Invoices, Leads, Pipeline

## Leads
- **Page**: `src/pages/Leads.tsx`
- **API**: `src/lib/leadsApi.ts`
- **Server**: `server/routes/leads.ts`
- **Purpose**: Track potential customers before conversion
- **Key ops**: Create, update, soft-delete, convert to client, CSV export, status management
- **Statuses**: `new → contacted → estimate_sent → follow_up → won/closed/lost`
- **Interactions**: Pipeline (creates deals), Jobs (via convert), Clients (on conversion)
- **Note**: Deletions require admin/owner role. Use `/api/leads/soft-delete` (server RPC).

## Pipeline
- **Page**: `src/pages/Pipeline.tsx`
- **API**: `src/lib/pipelineApi.ts`
- **Purpose**: Kanban sales pipeline for managing deal progression
- **Stages**: `New → Contacted → Estimate Sent → Follow-Up → Won → Closed → Lost`
- **Key ops**: Drag-and-drop stage changes, deal CRUD, deal deletion, schedule events from deals
- **Interactions**: Leads (1 deal per lead), Jobs (deal can create/link a job), Schedule
- **Delete path**: `POST /api/deals/soft-delete` (service_role, bypasses RLS)

## Clients
- **Page**: `src/pages/Clients.tsx`, `src/pages/ClientDetails.tsx`
- **API**: `src/lib/clientsApi.ts`
- **Purpose**: Manage converted customers
- **Key ops**: View/edit client, view linked jobs + invoices, contact management
- **Interactions**: Jobs, Invoices, Payments, Notes

## Jobs
- **Page**: `src/pages/Jobs.tsx`, `src/pages/JobDetails.tsx`
- **API**: `src/lib/jobsApi.ts`
- **Purpose**: Core service job management
- **Key ops**: Create/edit job, assign team, schedule, attach invoices, file uploads, geocoding
- **Statuses**: `Unscheduled | Scheduled | Late | Requires Invoicing | Action Required | Completed`
- **Interactions**: Clients, Teams, Schedule, Invoices, Pipeline, Map

## Schedule / Calendar
- **Page**: `src/pages/Schedule.tsx`
- **API**: `src/lib/scheduleApi.ts`
- **Purpose**: Visual calendar for job scheduling
- **Key ops**: View/create schedule events, drag-to-reschedule
- **Context**: `src/contexts/CalendarController.tsx`
- **Interactions**: Jobs, Teams, Availability

## Invoices
- **Page**: `src/pages/Invoices.tsx`, `src/pages/InvoiceDetails.tsx`
- **API**: `src/lib/invoicesApi.ts`
- **Server**: `server/routes/leads.ts` (`/invoices/from-job`)
- **Purpose**: Create and manage invoices, send to clients
- **Statuses**: `draft | sent | paid | overdue | void`
- **Key ops**: Create from job, send email, record payment, PDF generation
- **Interactions**: Jobs, Clients, Payments, Email Templates

## Payments
- **Page**: `src/pages/Payments.tsx`, `src/pages/PaymentSettings.tsx`
- **API**: `src/lib/paymentsApi.ts`
- **Server**: `server/routes/payments.ts`
- **Purpose**: Record and track payments (Stripe, PayPal, manual)
- **Interactions**: Invoices, Clients

## Automations / Workflows
- **Page**: `src/pages/Automations.tsx`, `src/pages/Workflows.tsx`
- **API**: `src/lib/workflowApi.ts`
- **Server**: `server/lib/automationEngine.ts`, `server/lib/scheduler.ts`
- **Purpose**: Trigger-based automation (send SMS, email, Slack on events)
- **Interactions**: All modules — automations can trigger on any entity event

## Teams
- **Page**: `src/pages/ManageTeam.tsx`, `src/pages/TeamMemberDetails.tsx`
- **API**: `src/lib/teamsApi.ts`
- **Purpose**: Manage field teams, assign to jobs, track timesheets
- **Interactions**: Jobs, Schedule, Timesheets

## Notes / NoteBoards
- **Pages**: `src/pages/Notes.tsx`, `src/pages/NoteBoards.tsx`, `src/pages/NoteCanvas.tsx`
- **API**: `src/lib/notesApi.ts`, `src/lib/noteBoardsApi.ts`
- **Purpose**: Free-form notes attached to entities + visual canvas boards
- **Interactions**: Leads, Jobs, Clients

## Messages
- **Page**: `src/pages/Messages.tsx`
- **API**: `src/lib/messagingApi.ts`
- **Server**: `server/routes/messages.ts` (Twilio)
- **Purpose**: SMS messaging with leads/clients

## AI Assistant
- **Page**: `src/pages/AIHelper.tsx`
- **API**: `src/lib/aiApi.ts`, `src/lib/ai/`
- **Purpose**: Claude-powered assistant with CRM tool access
- **Tools**: leads, jobs, invoices, clients, schedule, dashboard, billing
- **Orchestrator**: `src/lib/ai/orchestrator.ts`

## Insights
- **Page**: `src/pages/Insights.tsx`
- **API**: `src/lib/insightsApi.ts`
- **Purpose**: Analytics — revenue trends, lead sources, team performance

## Settings
- **Pages**: `src/pages/Settings.tsx`, `src/pages/CompanySettings.tsx`
- **Purpose**: Org config, branding, payment gateways, email templates, review settings
- **Key tables**: `company_settings`, `email_templates`

## App Marketplace / Integrations
- **Page**: `src/pages/AppMarketplace.tsx`
- **Server**: `server/routes/integrations.ts`
- **Providers**: Stripe, QuickBooks, Slack, Twilio, generic OAuth

## Dispatch Map
- **Page**: `src/pages/DispatchMap.tsx`
- **API**: `src/lib/mapApi.ts`, `src/lib/geocodeApi.ts`
- **Purpose**: Visual map of all job locations with status overlays
