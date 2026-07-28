-- Allow ward_no 0 for "Other", in addition to 1–16.
ALTER TABLE members DROP CONSTRAINT IF EXISTS members_ward_no_check;
ALTER TABLE members ADD CONSTRAINT members_ward_no_check
  CHECK (ward_no IS NULL OR ward_no = 0 OR (ward_no >= 1 AND ward_no <= 16));
