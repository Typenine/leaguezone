-- User account system: email_verified, commissioner, password reset tokens

-- Add email_verified to users (false by default — existing rows are legacy)
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified boolean NOT NULL DEFAULT false;

-- Track which user created/owns each league
ALTER TABLE leagues ADD COLUMN IF NOT EXISTS commissioner_user_id uuid REFERENCES users(id);

-- Password reset tokens (one-time, expire in 1 hour)
CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token varchar(128) NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  created_at timestamptz DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS prt_token_idx ON password_reset_tokens(token);
CREATE INDEX IF NOT EXISTS prt_user_idx ON password_reset_tokens(user_id);

-- Email verification tokens
CREATE TABLE IF NOT EXISTS email_verification_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token varchar(128) NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  created_at timestamptz DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS evt_token_idx ON email_verification_tokens(token);
CREATE INDEX IF NOT EXISTS evt_user_idx ON email_verification_tokens(user_id);
