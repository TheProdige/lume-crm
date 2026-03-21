-- Add recurring invoice columns to invoices table
ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS is_recurring boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS recurrence_interval text,
  ADD COLUMN IF NOT EXISTS next_recurrence_date date,
  ADD COLUMN IF NOT EXISTS parent_invoice_id uuid;

-- Add constraint on recurrence_interval values
ALTER TABLE invoices
  ADD CONSTRAINT chk_recurrence_interval
  CHECK (recurrence_interval IS NULL OR recurrence_interval IN ('weekly', 'biweekly', 'monthly', 'quarterly', 'yearly'));

-- Add foreign key for parent_invoice_id
ALTER TABLE invoices
  ADD CONSTRAINT fk_parent_invoice
  FOREIGN KEY (parent_invoice_id) REFERENCES invoices(id)
  ON DELETE SET NULL;

-- Index for scheduler query: find recurring invoices due for cloning
CREATE INDEX IF NOT EXISTS idx_invoices_recurring_due
  ON invoices (next_recurrence_date)
  WHERE is_recurring = true AND deleted_at IS NULL;

COMMENT ON COLUMN invoices.is_recurring IS 'Whether this invoice auto-generates clones on a schedule';
COMMENT ON COLUMN invoices.recurrence_interval IS 'How often to clone: weekly, biweekly, monthly, quarterly, yearly';
COMMENT ON COLUMN invoices.next_recurrence_date IS 'The next date a clone should be created';
COMMENT ON COLUMN invoices.parent_invoice_id IS 'Points to the recurring invoice this was cloned from';
