-- Add nominee and ward number fields; ward_no must be 1-16 when set.
ALTER TABLE members ADD COLUMN IF NOT EXISTS nominee VARCHAR(255);
ALTER TABLE members ADD COLUMN IF NOT EXISTS ward_no INTEGER;

ALTER TABLE members DROP CONSTRAINT IF EXISTS members_ward_no_check;
ALTER TABLE members ADD CONSTRAINT members_ward_no_check
  CHECK (ward_no IS NULL OR (ward_no >= 1 AND ward_no <= 16));
