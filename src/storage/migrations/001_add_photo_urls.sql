-- Migration 001: Add photo_urls JSONB column to campgrounds
-- Run: psql $DATABASE_URL -f src/storage/migrations/001_add_photo_urls.sql

ALTER TABLE campgrounds
  ADD COLUMN IF NOT EXISTS photo_urls JSONB;
