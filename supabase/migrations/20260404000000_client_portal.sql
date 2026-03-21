-- ═══════════════════════════════════════════════════════════════
-- Client Portal: portal_token on clients table
-- ═══════════════════════════════════════════════════════════════

-- Add portal_token to clients (unique, auto-generated)
ALTER TABLE clients ADD COLUMN IF NOT EXISTS portal_token text UNIQUE;

-- Generate tokens for existing clients
UPDATE clients SET portal_token = gen_random_uuid()::text WHERE portal_token IS NULL;

-- Auto-generate for new clients
ALTER TABLE clients ALTER COLUMN portal_token SET DEFAULT gen_random_uuid()::text;

CREATE INDEX IF NOT EXISTS idx_clients_portal_token ON clients(portal_token) WHERE portal_token IS NOT NULL;
