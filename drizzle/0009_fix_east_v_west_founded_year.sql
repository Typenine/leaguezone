-- Correct the East v. West founded year using its authoritative inaugural season.
-- The guards intentionally target only the known production league record.

UPDATE leagues
SET founded_year = 2023,
    updated_at = NOW()
WHERE id = 'bff24a47-d6e5-425b-91c8-f0b973e80607'::uuid
  AND slug = 'east-v-west'
  AND sleeper_league_id = '1312872384503484416'
  AND founded_year = 2017;
