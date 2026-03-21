/* ═══════════════════════════════════════════════════════════════
   Migration — Clean up technical data from job notes

   Removes auto-injected lines (UUIDs, lead refs, email/phone/company)
   that were added by mapLeadToJobDraft into job notes.
   Keeps only real user-written notes (Deal notes / Lead notes content).
   ═══════════════════════════════════════════════════════════════ */

-- Remove lines that start with technical prefixes
UPDATE public.jobs
SET notes = trim(both E'\n' from
  regexp_replace(
    regexp_replace(
      regexp_replace(
        regexp_replace(
          regexp_replace(
            regexp_replace(
              regexp_replace(notes,
                E'From Lead #[^\n]*\n?', '', 'g'),
              E'Lead: [^\n]*\n?', '', 'g'),
            E'Email: [^\n]*\n?', '', 'g'),
          E'Phone: [^\n]*\n?', '', 'g'),
        E'Company: [^\n]*\n?', '', 'g'),
      E'Pipeline deal: [^\n]*\n?', '', 'g'),
    E'From Pipeline\n?', '', 'g')
)
WHERE notes IS NOT NULL
  AND (
    notes LIKE '%From Lead #%'
    OR notes LIKE '%Pipeline deal:%'
    OR notes LIKE '%From Pipeline%'
  );

-- Strip "Deal notes: " and "Lead notes: " prefixes (keep the content)
UPDATE public.jobs
SET notes = trim(both E'\n' from
  regexp_replace(
    regexp_replace(notes,
      E'Deal notes: ', '', 'g'),
    E'Lead notes: ', '', 'g')
)
WHERE notes IS NOT NULL
  AND (notes LIKE '%Deal notes: %' OR notes LIKE '%Lead notes: %');

-- Set empty notes to NULL
UPDATE public.jobs
SET notes = NULL
WHERE notes IS NOT NULL
  AND trim(notes) = '';
