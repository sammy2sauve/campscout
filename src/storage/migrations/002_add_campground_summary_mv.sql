-- Migration 002: Materialized view for fast bbox list queries + TTL-cache key
-- Run: psql $DATABASE_URL -f src/storage/migrations/002_add_campground_summary_mv.sql
-- CONCURRENTLY refresh requires a unique index — created below.

CREATE MATERIALIZED VIEW IF NOT EXISTS campground_summary_mv AS
SELECT
  id,
  rec_facility_id,
  name,
  state_code,
  ST_Y(location::geometry)  AS lat,
  ST_X(location::geometry)  AS lon,
  has_electricity,
  has_showers,
  has_toilets,
  has_drinking_water,
  pets_allowed,
  ada_accessible,
  wildlife_tags,
  terrain_tags,
  photo_urls,
  weather_stale,
  updated_at
FROM campgrounds
WHERE location IS NOT NULL;

-- Required for CONCURRENTLY refresh
CREATE UNIQUE INDEX IF NOT EXISTS uix_cg_summary_mv_id
  ON campground_summary_mv (id);

-- Spatial index for bbox queries
CREATE INDEX IF NOT EXISTS ix_cg_summary_mv_location
  ON campground_summary_mv
  USING GIST (ST_SetSRID(ST_MakePoint(lon, lat), 4326));

-- Refresh command (add to Prefect flow after each pipeline run):
-- REFRESH MATERIALIZED VIEW CONCURRENTLY campground_summary_mv;
