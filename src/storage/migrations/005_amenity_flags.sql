-- Migration 005: compact amenity booleans → amenity_flags INTEGER (bit-packed)
-- Bit layout (see src/models/amenity_flags.py):
--   TOILETS=1, SHOWERS=2, DRINKING_WATER=4, ELECTRICITY=8, PETS=16, ADA=32
ALTER TABLE campgrounds ADD COLUMN amenity_flags INTEGER NOT NULL DEFAULT 0;
ALTER TABLE campgrounds ADD COLUMN availability_fetched_at TIMESTAMPTZ;

UPDATE campgrounds SET amenity_flags =
  (CASE WHEN has_toilets        THEN 1  ELSE 0 END) |
  (CASE WHEN has_showers        THEN 2  ELSE 0 END) |
  (CASE WHEN has_drinking_water THEN 4  ELSE 0 END) |
  (CASE WHEN has_electricity    THEN 8  ELSE 0 END) |
  (CASE WHEN pets_allowed       THEN 16 ELSE 0 END) |
  (CASE WHEN ada_accessible     THEN 32 ELSE 0 END);

-- Drop old boolean columns (amenity_flags is now canonical)
ALTER TABLE campgrounds
  DROP COLUMN has_toilets,
  DROP COLUMN has_showers,
  DROP COLUMN has_drinking_water,
  DROP COLUMN has_electricity,
  DROP COLUMN pets_allowed,
  DROP COLUMN ada_accessible;
