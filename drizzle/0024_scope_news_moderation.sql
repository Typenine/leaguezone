ALTER TABLE "news_moderation" ADD COLUMN IF NOT EXISTS "league_id" uuid;

UPDATE "news_moderation" nm
SET "league_id" = (SELECT id FROM "leagues" WHERE setup_completed = true ORDER BY created_at ASC LIMIT 1)
WHERE nm."league_id" IS NULL;

ALTER TABLE "news_moderation" ALTER COLUMN "league_id" SET NOT NULL;
DO $$ BEGIN
  ALTER TABLE "news_moderation" ADD CONSTRAINT "news_moderation_league_id_leagues_id_fk" FOREIGN KEY ("league_id") REFERENCES "public"."leagues"("id") ON DELETE cascade;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
CREATE INDEX IF NOT EXISTS "news_moderation_league_idx" ON "news_moderation" USING btree ("league_id");
