-- Migration 006: convert availability_snapshots from append-only to upsert model
-- After this, the table holds exactly one row per (campsite_id, date): today → +90 days.

-- Drop the 3-column unique constraint that included fetched_at
ALTER TABLE availability_snapshots
  DROP CONSTRAINT IF EXISTS uq_availability_campsite_date_fetch;

-- Also drop by the alternative name used in older migrations just in case
ALTER TABLE availability_snapshots
  DROP CONSTRAINT IF EXISTS availability_snapshots_campsite_id_date_fetched_at_key;

-- Keep only the latest fetched_at per (campsite_id, date)
DELETE FROM availability_snapshots a
USING availability_snapshots b
WHERE a.campsite_id = b.campsite_id
  AND a.date = b.date
  AND a.fetched_at < b.fetched_at;

-- New 2-column unique constraint (upsert target going forward)
ALTER TABLE availability_snapshots
  ADD CONSTRAINT availability_snapshots_campsite_id_date_key UNIQUE (campsite_id, date);

-- Prune stale data
DELETE FROM availability_snapshots WHERE date < CURRENT_DATE;
DELETE FROM weather_forecasts WHERE forecast_date < CURRENT_DATE;
