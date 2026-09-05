-- Enforce email verification for accounts created after this migration.
-- Existing accounts are intentionally grandfathered so current testers are not locked out.
-- The default is true so accounts created by the old application during a rolling deploy
-- are still required to verify once the new application code becomes active.

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS email_verification_required boolean;

UPDATE users
SET email_verification_required = false
WHERE email_verification_required IS NULL;

ALTER TABLE users
  ALTER COLUMN email_verification_required SET DEFAULT true;

ALTER TABLE users
  ALTER COLUMN email_verification_required SET NOT NULL;
