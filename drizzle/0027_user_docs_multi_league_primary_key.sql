ALTER TABLE user_docs ADD COLUMN IF NOT EXISTS id uuid;
UPDATE user_docs SET id = gen_random_uuid() WHERE id IS NULL;
ALTER TABLE user_docs ALTER COLUMN id SET NOT NULL;
ALTER TABLE user_docs ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE user_docs DROP CONSTRAINT IF EXISTS user_docs_pkey;
ALTER TABLE user_docs ADD CONSTRAINT user_docs_pkey PRIMARY KEY (id);
CREATE UNIQUE INDEX IF NOT EXISTS user_docs_user_legacy_unique
  ON user_docs (user_id) WHERE league_id IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS user_docs_user_league_unique
  ON user_docs (user_id, league_id) WHERE league_id IS NOT NULL;
