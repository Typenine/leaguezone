-- User-scoped player watchlists and research bookmarks; no league or provider coupling.
CREATE TABLE IF NOT EXISTS leaguezone_saved_research (
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  item_key varchar(850) NOT NULL,
  item_type varchar(12) NOT NULL CHECK (item_type IN ('player', 'view')),
  title varchar(150) NOT NULL,
  href varchar(800) NOT NULL,
  saved_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, item_key)
);
-- The primary key doubles as the index for reads and deletes by user.
