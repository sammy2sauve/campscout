-- Migration 007: add reserve_type to campsites
-- Values sourced from Recreation.gov CAMPSITE_RESERVE_TYPE field:
--   'site_specific'       — fully reservable through Recreation.gov
--   'first_come'          — walk-in / no reservation
--   'lottery'             — lottery system
--   'pass'                — requires a specific pass
--   NULL                  — unknown / not provided by API

ALTER TABLE campsites ADD COLUMN IF NOT EXISTS reserve_type TEXT;
