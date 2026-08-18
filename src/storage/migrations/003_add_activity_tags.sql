-- Migration 003: add activity_tags column and backfill from terrain_tags
--
-- Activities (fishing, hiking, swimming, etc.) were previously mixed
-- into terrain_tags. This migration separates them into their own column
-- and removes them from terrain_tags.

ALTER TABLE campgrounds ADD COLUMN IF NOT EXISTS activity_tags TEXT[];

-- Backfill: move activity keywords out of terrain_tags and into activity_tags
UPDATE campgrounds SET
  activity_tags = (
    SELECT COALESCE(array_agg(tag ORDER BY tag), ARRAY[]::TEXT[])
    FROM unnest(terrain_tags) AS tag
    WHERE tag = ANY(ARRAY[
      'fishing', 'hiking', 'trail', 'walk-in', 'swimming',
      'boat ramp', 'boating', 'primitive'
    ])
  ),
  terrain_tags = (
    SELECT COALESCE(array_agg(tag ORDER BY tag), ARRAY[]::TEXT[])
    FROM unnest(terrain_tags) AS tag
    WHERE tag != ALL(ARRAY[
      'fishing', 'hiking', 'trail', 'walk-in', 'swimming',
      'boat ramp', 'boating', 'primitive'
    ])
  )
WHERE terrain_tags IS NOT NULL;

-- Normalize empty arrays to NULL for consistency
UPDATE campgrounds SET activity_tags = NULL WHERE activity_tags = '{}';
UPDATE campgrounds SET terrain_tags  = NULL WHERE terrain_tags  = '{}';
