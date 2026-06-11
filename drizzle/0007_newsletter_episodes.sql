-- Newsletter episodes per league (episodic archive)
CREATE TYPE newsletter_source_type AS ENUM ('editor', 'docx', 'html', 'pdf');
CREATE TYPE newsletter_status AS ENUM ('draft', 'published');

CREATE TABLE IF NOT EXISTS newsletter_episodes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id uuid NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
  season integer NOT NULL,
  week integer,
  episode_number integer NOT NULL DEFAULT 1,
  slug varchar(128) NOT NULL,
  title varchar(512) NOT NULL,
  summary text,
  content_html text,
  source_type newsletter_source_type NOT NULL DEFAULT 'editor',
  source_file_key text,
  cover_image_key text,
  status newsletter_status NOT NULL DEFAULT 'draft',
  published_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT newsletter_episodes_league_slug_unique UNIQUE (league_id, slug)
);

CREATE INDEX IF NOT EXISTS newsletter_episodes_league_status_published_idx
  ON newsletter_episodes (league_id, status, published_at DESC NULLS LAST);

CREATE INDEX IF NOT EXISTS newsletter_episodes_league_season_idx
  ON newsletter_episodes (league_id, season, week, episode_number);
