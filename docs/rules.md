# Development Rules — Lume CRM

## TypeScript
- Strict mode — no implicit `any` in new code
- Use existing `any` patterns only where already present in the file
- Define types in `src/types.ts` (shared) or inline if module-specific
- Zod schemas in `server/lib/validation.ts` — all server route inputs must be validated
- Zod: use `.nullable()` for fields that receive `null` from the client (not just `.optional()`)

## Naming
- Files: `PascalCase` for components/pages, `camelCase` for lib/hooks/utils
- API files: `*Api.ts` (e.g. `leadsApi.ts`, `jobsApi.ts`)
- Server routes: named after resource (e.g. `leads.ts`, `payments.ts`)
- DB columns: `snake_case` — map to camelCase at the API boundary if needed
- React components: PascalCase, one per file

## Folder Structure
```
src/pages/      # Full page components (one per route)
src/components/ # Reusable UI components
src/lib/        # Data access layer (*Api.ts) + utilities
src/hooks/      # Custom hooks (use*.ts)
src/contexts/   # React contexts
src/i18n/       # Translation keys only
server/routes/  # Express route handlers
server/lib/     # Server utilities (not routes)
```

## Components
- Pages own their state — no shared state between pages
- No prop drilling beyond 2 levels — use context or colocation
- Modals rendered inline in the page that owns them (not a global portal)
- Always use `t.*` for user-facing strings (i18n)
- Use `cn()` from `src/lib/utils` for conditional classNames

## Data Access
- Frontend data fetching: always through `src/lib/*Api.ts` — never `fetch()` directly in pages
- `src/lib/supabase.ts` (anon key): read queries + user-scoped mutations
- `getServiceClient()` (service_role): admin/destructive ops only — server-side only
- Destructive operations that may fail silently due to RLS must go through the Express server
- Always filter soft-deleted records: use `leads_active` / `clients_active` views or `.is('deleted_at', null)`

## Server Routes
- All routes validated with Zod before processing
- Auth check with `requireAuthedClient()` at the top of every handler
- Admin-only operations: check `isOrgAdminOrOwner()` before proceeding
- Error codes mapped to HTTP status: `42501` → 403, `P0002` → 404, `23514` → 409

## Database Safety
- NEVER hard delete rows — always set `deleted_at = now()`
- NEVER modify data outside the user's `org_id`
- Use RPCs for multi-step operations that must be atomic
- `SECURITY DEFINER` RPCs bypass RLS — use only when necessary and validate `org_id` inside

## What AI Must NEVER Do
- Rewrite an entire file when only a few lines need changing
- Modify files unrelated to the requested change
- Remove or rename exports that are used elsewhere without checking
- Add `--no-verify` to git commands
- Hard-delete data from the database
- Change the port configuration without updating `.env.local`
- Introduce new dependencies without confirming with the user
- Add generic error handling that swallows real errors silently

## Refactor Rules
- Only refactor code that is directly in scope of the task
- Do not clean up "while you're in there" — scope creep causes regressions
- If a fix requires restructuring, describe the plan first
