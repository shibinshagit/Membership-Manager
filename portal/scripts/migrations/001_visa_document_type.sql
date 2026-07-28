-- Run once on your Neon/PostgreSQL database.
-- Adds 'visa' as an allowed document type for EID/passport/visa uploads.

ALTER TABLE documents DROP CONSTRAINT IF EXISTS documents_document_type_check;

ALTER TABLE documents ADD CONSTRAINT documents_document_type_check
  CHECK (document_type IN ('emirates_id', 'passport', 'visa', 'photo', 'other'));

-- Optional: backfill membership_start_date for any legacy rows that have NULL
-- (only needed if you have old members created before the registration fix)
UPDATE members
SET membership_start_date = COALESCE(joined_date, created_at::date, CURRENT_DATE)
WHERE membership_start_date IS NULL;
