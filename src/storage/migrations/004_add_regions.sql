-- Migration 004: add regions table and region_id FK on campgrounds
CREATE TABLE regions (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  states TEXT[] NOT NULL,
  bbox_min_lon FLOAT NOT NULL,
  bbox_min_lat FLOAT NOT NULL,
  bbox_max_lon FLOAT NOT NULL,
  bbox_max_lat FLOAT NOT NULL,
  center_lat FLOAT NOT NULL,
  center_lon FLOAT NOT NULL,
  default_zoom INTEGER NOT NULL DEFAULT 6
);

INSERT INTO regions VALUES
  ('southeast','Southeast',ARRAY['FL','GA','AL','MS','TN','NC','SC','VA','WV','KY','AR'],-94.0,24.5,-75.4,39.5,33.5,-84.5,6),
  ('northeast','Northeast',ARRAY['ME','NH','VT','MA','RI','CT','NY','NJ','PA','MD','DE'],-80.5,38.9,-66.9,47.5,43.0,-72.5,6),
  ('great_lakes','Great Lakes',ARRAY['OH','IN','IL','MI','WI','MN','IA','MO'],-97.2,36.0,-80.5,49.4,45.5,-87.0,5),
  ('plains','Plains',ARRAY['ND','SD','NE','KS','OK','TX'],-106.6,25.8,-96.5,49.0,38.5,-100.0,5),
  ('mountain','Mountain / Rockies',ARRAY['MT','ID','WY','CO','NM','UT','AZ','NV'],-120.0,31.3,-102.0,49.0,41.0,-111.5,5),
  ('pacific_west','Pacific West',ARRAY['CA','OR','WA'],-124.6,32.5,-114.1,49.0,42.0,-120.5,6);

ALTER TABLE campgrounds ADD COLUMN region_id TEXT REFERENCES regions(id);

UPDATE campgrounds SET region_id = 'southeast'   WHERE state_code = ANY(ARRAY['FL','GA','AL','MS','TN','NC','SC','VA','WV','KY','AR']);
UPDATE campgrounds SET region_id = 'northeast'   WHERE state_code = ANY(ARRAY['ME','NH','VT','MA','RI','CT','NY','NJ','PA','MD','DE']);
UPDATE campgrounds SET region_id = 'great_lakes' WHERE state_code = ANY(ARRAY['OH','IN','IL','MI','WI','MN','IA','MO']);
UPDATE campgrounds SET region_id = 'plains'      WHERE state_code = ANY(ARRAY['ND','SD','NE','KS','OK','TX']);
UPDATE campgrounds SET region_id = 'mountain'    WHERE state_code = ANY(ARRAY['MT','ID','WY','CO','NM','UT','AZ','NV']);
UPDATE campgrounds SET region_id = 'pacific_west' WHERE state_code = ANY(ARRAY['CA','OR','WA']);

CREATE INDEX idx_campgrounds_region_id ON campgrounds(region_id);
