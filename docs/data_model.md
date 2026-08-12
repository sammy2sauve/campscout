# CampScout — Data Model

Schema reference for all tables. Exit criteria: you could write `CREATE TABLE`
statements directly from this doc without ambiguity.

---

## Overview

Three source APIs feed two layers:

```
Recreation.gov ──┐
NPS             ──┼──► raw/staging tables ──► unified model tables
NOAA            ──┘
```

Raw tables store API responses close to as-received so reprocessing after a
bug fix doesn't require re-hitting rate-limited APIs. Unified tables are what
the FastAPI layer reads.

---

## Raw / Staging Tables

### `raw_rec_facilities`

One row per Recreation.gov facility fetch. The full JSON blob from
`GET /api/v1/facilities/{id}?full=true` is stored in `payload`.

| Column        | Type          | Notes                              |
|---------------|---------------|------------------------------------|
| id            | SERIAL PK     |                                    |
| facility_id   | TEXT NOT NULL | Recreation.gov `FacilityID`        |
| fetched_at    | TIMESTAMPTZ   | DEFAULT now()                      |
| payload       | JSONB         | Full API response object           |

Index: `facility_id, fetched_at DESC` (latest fetch per facility).

---

### `raw_rec_campsites`

One row per facility's campsites response.

| Column        | Type          | Notes                              |
|---------------|---------------|------------------------------------|
| id            | SERIAL PK     |                                    |
| facility_id   | TEXT NOT NULL | Parent facility                    |
| fetched_at    | TIMESTAMPTZ   | DEFAULT now()                      |
| payload       | JSONB         | Full RECDATA array from response   |

---

### `raw_rec_availability`

One row per (facility, month) availability fetch. Recreation.gov availability
is **not in the RIDB API** — it comes from the internal endpoint at
`https://www.recreation.gov/api/camps/availability/campground/{id}/month?start_date={YYYY-MM-01}T00:00:00.000Z`.
The response is a map of `campsite_id → {availabilities: {date: status}}`.

| Column        | Type          | Notes                              |
|---------------|---------------|------------------------------------|
| id            | SERIAL PK     |                                    |
| facility_id   | TEXT NOT NULL |                                    |
| month         | DATE NOT NULL | First day of the month queried     |
| fetched_at    | TIMESTAMPTZ   | DEFAULT now()                      |
| payload       | JSONB         | Full response                      |

Unique constraint: `(facility_id, month, fetched_at)`.

---

### `raw_nps_campgrounds`

One row per NPS campground fetch.

| Column        | Type          | Notes                              |
|---------------|---------------|------------------------------------|
| id            | SERIAL PK     |                                    |
| nps_id        | TEXT NOT NULL | NPS `id` UUID                      |
| fetched_at    | TIMESTAMPTZ   | DEFAULT now()                      |
| payload       | JSONB         | Full campground object             |

---

### `raw_nps_alerts`

One row per (park_code, fetch) — stores the full `data` array for that park.

| Column        | Type          | Notes                              |
|---------------|---------------|------------------------------------|
| id            | SERIAL PK     |                                    |
| park_code     | TEXT NOT NULL | NPS `parkCode` (e.g. `"cuis"`)    |
| fetched_at    | TIMESTAMPTZ   | DEFAULT now()                      |
| payload       | JSONB         | Full alerts data array             |

---

### `raw_noaa_forecasts`

One row per grid point forecast fetch.

| Column        | Type          | Notes                                    |
|---------------|---------------|------------------------------------------|
| id            | SERIAL PK     |                                          |
| grid_id       | TEXT NOT NULL | `"{office}/{x}/{y}"` e.g. `"FFC/64/133"` |
| fetched_at    | TIMESTAMPTZ   | DEFAULT now()                            |
| payload       | JSONB         | Full properties object from forecast URL |

---

## Unified Model Tables

### `campgrounds`

The resolved, joined campground entity — one row per Recreation.gov facility
that is a campground. This is the primary entity the API and frontend read.

| Column                  | Type                  | Notes                                                    |
|-------------------------|-----------------------|----------------------------------------------------------|
| id                      | SERIAL PK             |                                                          |
| rec_facility_id         | TEXT NOT NULL UNIQUE  | Recreation.gov `FacilityID`                              |
| nps_id                  | TEXT                  | Nullable — resolved via `reservationUrl` parse or name match |
| name                    | TEXT NOT NULL         |                                                          |
| description             | TEXT                  | From Recreation.gov `FacilityDescription` (HTML)        |
| location                | GEOMETRY(Point, 4326) | `(FacilityLongitude, FacilityLatitude)`                 |
| state_code              | TEXT                  | e.g. `"GA"`                                             |
| phone                   | TEXT                  |                                                          |
| reservation_url         | TEXT                  |                                                          |
| stay_limit              | TEXT                  | Freeform string from Recreation.gov                     |
| — Amenities (resolved from ATTRIBUTES[] key-value pairs) —                         |
| has_toilets             | BOOLEAN               |                                                          |
| has_showers             | BOOLEAN               |                                                          |
| has_drinking_water      | BOOLEAN               |                                                          |
| has_electricity         | BOOLEAN               |                                                          |
| pets_allowed            | BOOLEAN               |                                                          |
| ada_accessible          | BOOLEAN               |                                                          |
| — Weather (populated once via NOAA Points API, refreshed on schedule) —            |
| noaa_grid_id            | TEXT                  | `"FFC/64/133"` — null until first weather fetch        |
| noaa_forecast_url       | TEXT                  | Stored from Points response, used for forecast fetches  |
| weather_fetched_at      | TIMESTAMPTZ           | Null if never fetched                                   |
| weather_stale           | BOOLEAN               | DEFAULT FALSE — set TRUE when fetch fails               |
| — Extracted tags (from transform layer) —                                          |
| wildlife_tags           | TEXT[]                | e.g. `{"bear","deer","wild turkey"}`                   |
| terrain_tags            | TEXT[]                | e.g. `{"waterfall","lake","mountain"}`                  |
| — Metadata —                                                                       |
| created_at              | TIMESTAMPTZ           | DEFAULT now()                                           |
| updated_at              | TIMESTAMPTZ           | DEFAULT now()                                           |

Indexes:
- `USING GIST (location)` — for PostGIS radius queries
- `state_code`
- `pets_allowed`, `ada_accessible`, `has_electricity` — for filter queries

---

### `campsites`

Individual sites within a campground. Sourced from Recreation.gov
`/facilities/{id}/campsites`. Note: amenities here come from the `ATTRIBUTES`
key-value array, not structured fields — the transform layer normalizes them.

| Column                 | Type                 | Notes                                              |
|------------------------|----------------------|----------------------------------------------------|
| id                     | SERIAL PK            |                                                    |
| rec_campsite_id        | TEXT NOT NULL UNIQUE | Recreation.gov `CampsiteID`                       |
| campground_id          | INT NOT NULL         | FK → `campgrounds.id`                             |
| name                   | TEXT                 | `CampsiteName`                                    |
| loop                   | TEXT                 | `Loop` field (e.g. `"A"`)                        |
| site_type              | TEXT                 | `CampsiteType` e.g. `"STANDARD ELECTRIC"`        |
| type_of_use            | TEXT                 | `"Overnight"` or `"Day"` — filter out Day-only   |
| max_occupants          | INT                  | From ATTRIBUTES `Max Num of People`              |
| max_vehicle_length_ft  | INT                  | From PERMITTEDEQUIPMENT MaxLength                |
| is_reservable          | BOOLEAN              | `CampsiteReservable`                              |
| ada_accessible         | BOOLEAN              | `CampsiteAccessible`                              |
| has_electricity        | BOOLEAN              | From ATTRIBUTES `ELECTRIC HOOKUPS`               |
| has_water_hookup       | BOOLEAN              | From ATTRIBUTES `Water Hookup`                   |
| has_sewer_hookup       | BOOLEAN              | From ATTRIBUTES                                   |
| pets_allowed           | BOOLEAN              | From ATTRIBUTES `Pets Allowed`                   |
| created_at             | TIMESTAMPTZ          | DEFAULT now()                                     |

Index: `campground_id`.

---

### `availability_snapshots`

Time-series availability — one row per (campsite, date, fetch). This is the
table that answers "how far ahead do I need to book campground X" and powers
the availability filter in the dashboard.

| Column       | Type          | Notes                                                         |
|--------------|---------------|---------------------------------------------------------------|
| id           | SERIAL PK     |                                                               |
| campsite_id  | INT NOT NULL  | FK → `campsites.id`                                          |
| date         | DATE NOT NULL |                                                               |
| status       | TEXT NOT NULL | `"Available"`, `"Reserved"`, `"Not Available"`, `"NYR"`, etc |
| fetched_at   | TIMESTAMPTZ   | DEFAULT now()                                                 |

Unique constraint: `(campsite_id, date, fetched_at)`.

Indexes:
- `(campsite_id, date)` — for "is site X available on date Y"
- `(date, status)` — for "all available sites on date Y"

Note: keep old snapshots — they're the dataset that lets you analyze booking
lead times. Don't upsert, append.

---

### `campground_alerts`

NPS alerts linked to campgrounds. Alert text is freeform prose — the transform
layer parses it to extract category and affected scope. v1 granularity is
whole-campground; sub-loop parsing is a stretch goal.

| Column                    | Type          | Notes                                              |
|---------------------------|---------------|----------------------------------------------------|
| id                        | SERIAL PK     |                                                    |
| campground_id             | INT NOT NULL  | FK → `campgrounds.id`                             |
| nps_alert_id              | TEXT NOT NULL | NPS `id` UUID                                     |
| title                     | TEXT NOT NULL |                                                    |
| description               | TEXT          | Freeform prose                                    |
| category                  | TEXT          | `"Danger"`, `"Caution"`, `"Information"`, `"Park Closure"` |
| affects_whole_campground  | BOOLEAN       | DEFAULT TRUE (v1 — sub-loop granularity deferred) |
| published_at              | TIMESTAMPTZ   | From `lastIndexedDate`                            |
| fetched_at                | TIMESTAMPTZ   | DEFAULT now()                                     |

Index: `campground_id`.

---

### `weather_forecasts`

Denormalized NOAA forecast periods per campground. One row per period (roughly
12 periods = 6 days of day/night pairs).

| Column              | Type          | Notes                                  |
|---------------------|---------------|----------------------------------------|
| id                  | SERIAL PK     |                                        |
| campground_id       | INT NOT NULL  | FK → `campgrounds.id`                 |
| forecast_date       | DATE NOT NULL |                                        |
| is_daytime          | BOOLEAN       | NOAA `isDaytime`                      |
| temperature_f       | INT           | NOAA `temperature` (unit always F)    |
| precip_pct          | INT           | `probabilityOfPrecipitation.value`    |
| wind_speed          | TEXT          | e.g. `"5 mph"` (keep as string)      |
| wind_direction      | TEXT          | e.g. `"NW"`                          |
| short_forecast      | TEXT          | e.g. `"Mostly Sunny"`               |
| detailed_forecast   | TEXT          | Full sentence description             |
| fetched_at          | TIMESTAMPTZ   | DEFAULT now()                         |

Unique constraint: `(campground_id, forecast_date, is_daytime)` — on conflict
replace (weather data is replaced, not appended, unlike availability).

Index: `(campground_id, forecast_date)`.

---

## Geospatial Join Strategy

### Campground → NOAA weather

NOAA's Points API (`GET /points/{lat},{lon}`) takes a coordinate and returns
the forecast office, grid X/Y, and forecast URL for that point. This is a
one-time bootstrap per campground:

1. On first ingest, call Points API with campground lat/lon
2. Store `noaa_grid_id` (e.g. `"FFC/64/133"`) and `noaa_forecast_url` on
   the campground row
3. Subsequent weather refreshes just `GET noaa_forecast_url` — no more
   coordinate lookups needed
4. If the Points call fails, set `weather_stale = TRUE` and continue — don't
   fail the whole run

No `ST_Distance` needed for weather. The grid is implicit in the stored URL.

### Radius search (frontend → API)

```sql
SELECT * FROM campgrounds
WHERE ST_DWithin(
    location::geography,
    ST_Point(:lon, :lat)::geography,
    :radius_meters
)
```

The `GIST` index on `campgrounds.location` makes this fast.

### NPS alert → campground resolution

NPS alerts include a `parkCode` (e.g. `"cuis"`). The linkage strategy:

1. Primary: parse the Recreation.gov facility ID from `nps_campground.reservationUrl`
   (e.g. `https://www.recreation.gov/camping/campgrounds/253730` → `253730`)
   and match against `campgrounds.rec_facility_id`
2. Fallback: match on `parkCode` — if a park has exactly one campground in our
   dataset, the alert applies to it
3. If neither resolves, store the alert with `campground_id = NULL` and log —
   don't discard it

---

## Degraded-state handling

| Scenario                        | Behavior                                                    |
|---------------------------------|-------------------------------------------------------------|
| NOAA station/grid unreachable   | Set `weather_stale = TRUE`, keep last forecast rows        |
| NPS API down                    | Keep existing alerts, don't purge; log stale age           |
| Recreation.gov rate limit       | Backoff + retry; raw row written only on success           |
| NPS alert can't be resolved     | Store with `campground_id = NULL`, log for manual review   |
| Campground has no NPS match     | `nps_id = NULL` — NPS fields show "unavailable" in API    |
