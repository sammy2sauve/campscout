# CampScout

A full-stack data engineering project that ingests campsite availability, campground metadata, and weather forecasts from three federal government APIs, resolves them into a unified data model, and serves them through a map-first search dashboard.

**Live demo:** [campscout-delta.vercel.app](https://campscout-delta.vercel.app)

---

## What it does

Search and filter 4,000+ federal campgrounds across the US. Filter by amenities, wildlife, landscape type, and activities. Check real-time availability and 7-day weather for any campground — all sourced live from government APIs and refreshed automatically on a schedule.

---

## Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                         Data Sources                             │
│   Recreation.gov (availability) · NPS (metadata/alerts)         │
│   NOAA api.weather.gov (forecasts)                               │
└──────────┬───────────────────────────┬───────────────────────────┘
           │                           │
           ▼                           ▼
┌──────────────────────────────────────────────────────────────────┐
│                       Ingestion Layer                            │
│   src/ingestion/recreation_gov.py  per-facility polling,         │
│                                    rate-limit backoff            │
│   src/ingestion/nps.py             metadata + freeform alerts    │
│   src/ingestion/noaa.py            Points API → grid → forecast  │
│                                                                  │
│   Raw responses written to staging tables before transform.      │
│   Re-processing never requires re-hitting rate-limited APIs.     │
│   One source failing does not block the others.                  │
└──────────────────────────┬───────────────────────────────────────┘
                           │
                           ▼
┌──────────────────────────────────────────────────────────────────┐
│                       Transform Layer                            │
│   src/transform/run.py                                           │
│                                                                  │
│   · Entity resolution: NPS ↔ Recreation.gov facility match       │
│   · PostGIS ST_Distance: campground → nearest NOAA grid point    │
│   · Keyword extraction: wildlife / landscape / activity tags     │
│     from freeform description + alert text                       │
│     (src/transform/keywords.json — rule-based, no LLM dep)      │
│   · Amenity bit-packing: 6 booleans → 1 INTEGER                  │
│   · Upsert availability: ON CONFLICT DO UPDATE, past dates       │
│     pruned after each run (rolling 90-day window, never bloats)  │
└──────────────────────────┬───────────────────────────────────────┘
                           │
                           ▼
┌──────────────────────────────────────────────────────────────────┐
│              Storage — PostgreSQL + PostGIS (Neon)               │
│                                                                  │
│   regions                6 rows (SE · NE · Great Lakes ·         │
│                           Plains · Mountain · Pacific West)      │
│   campgrounds            ~4,000  (amenity_flags, region_id FK,   │
│                           NOAA grid cache)                       │
│   campsites              ~40,000 (reserve_type, amenities)       │
│   availability_snapshots rolling 90-day upsert window            │
│                          today → today+90, ~162K rows for SE     │
│   weather_forecasts      upsert per (campground, date, tod)      │
│   campground_alerts      NPS freeform alerts                     │
└──────────────────────────┬───────────────────────────────────────┘
                           │
                           ▼
┌──────────────────────────────────────────────────────────────────┐
│                   API Layer — FastAPI (Render)                   │
│                                                                  │
│   GET /api/regions                   6 regions + counts          │
│   GET /api/campgrounds               filter by region, amenity,  │
│                                      tags, bbox                  │
│   GET /api/campgrounds/{id}          full detail                 │
│   GET /api/campgrounds/{id}/availability  per-site windows,      │
│                                           fcfs_only flag         │
│   GET /api/campgrounds/{id}/weather  7-day NOAA forecast         │
│   GET /api/campgrounds/{id}/alerts   NPS alerts                  │
│                                                                  │
│   TTL caching (cachetools) · Cache-Control headers               │
│   Pydantic response schemas kept separate from ORM models        │
└──────────────────────────┬───────────────────────────────────────┘
                           │
                           ▼
┌──────────────────────────────────────────────────────────────────┐
│                  Frontend — React + Vite (Vercel)                │
│                                                                  │
│   react-leaflet map · marker clustering · OSM tiles              │
│   Region picker → US state GeoJSON overlay (amber glow border)   │
│   Filter panel: amenities, wildlife, landscape, activities       │
│   Detail panel: photo gallery, weather strip, availability,      │
│                 FCFS walk-in badge, SVG tag emblems              │
│   Home page: hero, photo gallery, about, region cards            │
└──────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────┐
│              Orchestration — GitHub Actions (free tier)          │
│                                                                  │
│   Weekly  Sun 03:00 UTC  national metadata sync, all 6 regions   │
│   Daily   05:00 UTC      SE availability sync, rolling 90 days   │
│   Prefect flows run in local mode inside GH Actions runners      │
└──────────────────────────────────────────────────────────────────┘
```

---

## Tech stack

| Layer | Choice | Why |
|---|---|---|
| Orchestration | Prefect 2 | Per-source retries, failure isolation, dependency graphs across 3 differently-paced sources |
| Database | PostgreSQL + PostGIS | Geospatial joins (nearest NOAA station) are core to the problem, not an afterthought |
| Backend | FastAPI + SQLAlchemy + GeoAlchemy2 | Async-friendly for polling multiple slow government APIs |
| Frontend | React + react-leaflet | Map-first dashboard; OSM tiles avoid any Mapbox billing dependency |
| Scheduling | GitHub Actions | 2,000 free min/month — enough for weekly metadata + daily availability |
| Tag extraction | Rule-based regex/keyword | Deterministic, no LLM API dependency in a scheduled batch pipeline |

---

## Data engineering highlights

**Three independently-failing sources.** Recreation.gov, NPS, and NOAA each have different rate limits, response formats, and failure modes. Each ingestion module writes raw API responses to staging tables before transforming them — so reprocessing after a bug fix never requires re-hitting a rate-limited API. One source going down does not block the others.

**Rolling availability window.** Availability snapshots use an upsert model (`ON CONFLICT (campsite_id, date) DO UPDATE`) rather than append-only inserts. Past dates are pruned after each run. The table stays at exactly `num_campsites × 90` rows — it never grows regardless of how long the pipeline has been running.

**Amenity bit-packing.** Six boolean amenity fields are stored as a single `INTEGER` using bit flags (`TOILETS=1, SHOWERS=2, DRINKING_WATER=4, ELECTRICITY=8, PETS=16, ADA=32`). Filter queries use bitwise AND: `amenity_flags & 8 != 0` instead of six separate indexed boolean columns.

**Graceful weather degradation.** NOAA grid endpoints go offline regularly. The pipeline marks affected campgrounds `weather_stale=true` and continues rather than failing the run. The frontend shows a staleness warning instead of a broken state.

**Freeform alert parsing.** NPS alert text is unstructured prose, not enums. The transform layer extracts wildlife, landscape, and activity tags using a keyword list in `src/transform/keywords.json` — an editable data file, not inline code — so adding new tag categories requires no code changes.

**First Come First Serve detection.** Recreation.gov's `CAMPSITE_RESERVE_TYPE` field is normalized to a `reserve_type` column (`site_specific`, `first_come`, `lottery`, `pass`). When all campsites at a campground are `first_come`, the availability endpoint returns `fcfs_only: true` and the frontend swaps the date picker for a walk-in badge rather than showing misleading "no availability" messaging.

---

## Running locally

### Prerequisites
- Python 3.11+
- Node 18+
- PostgreSQL with PostGIS, or a [Neon](https://neon.tech) free account

### Backend

```bash
cp .env.example .env
# fill in: RECREATION_GOV_API_KEY, NPS_API_KEY, DATABASE_URL, NOAA_USER_AGENT

pip install -r requirements.txt

# apply migrations in order
psql $DATABASE_URL -f src/storage/migrations/001_add_photo_urls.sql
psql $DATABASE_URL -f src/storage/migrations/002_add_campground_summary_mv.sql
psql $DATABASE_URL -f src/storage/migrations/003_add_activity_tags.sql
psql $DATABASE_URL -f src/storage/migrations/004_add_regions.sql
psql $DATABASE_URL -f src/storage/migrations/005_amenity_flags.sql
psql $DATABASE_URL -f src/storage/migrations/006_availability_dedup.sql
psql $DATABASE_URL -f src/storage/migrations/007_add_reserve_type.sql

# run the pipeline (Southeast region)
python -m src.flows.pipeline

# start the API
python -m uvicorn src.api.main:app --reload
```

### Frontend

```bash
cd frontend
npm install
npm run dev    # Vite proxies /api → localhost:8000
```

Open [http://localhost:5173](http://localhost:5173).

---

## Project structure

```
campscout/
├── src/
│   ├── ingestion/          # recreation_gov.py · nps.py · noaa.py
│   ├── transform/
│   │   ├── run.py          # entity resolution, tag extraction, upserts
│   │   └── keywords.json   # wildlife / landscape / activity keyword lists
│   ├── storage/
│   │   ├── models.py       # SQLAlchemy ORM models
│   │   └── migrations/     # 001–007 SQL migration files
│   ├── api/
│   │   ├── main.py         # FastAPI app + router registration
│   │   ├── routes/         # campgrounds, availability, weather, alerts, regions
│   │   └── schemas.py      # Pydantic response schemas
│   ├── models/
│   │   └── amenity_flags.py  # bit-flag helpers
│   └── flows/
│       └── pipeline.py     # Prefect flow + task definitions
├── frontend/
│   └── src/
│       ├── api/client.js   # all fetch calls, VITE_API_BASE_URL aware
│       ├── components/     # MapView · DetailPanel · FilterPanel · HomePage · …
│       ├── hooks/          # useCampgrounds · useAvailability · useWeather · …
│       └── emblems/        # SVG icon sets for wildlife, landscape, activity tags
├── .github/workflows/      # pipeline-metadata.yml · pipeline-availability.yml
├── render.yaml             # Render deploy config (FastAPI backend)
├── frontend/vercel.json    # Vercel SPA rewrite rule
├── DEPLOY.md               # Step-by-step deployment guide
└── Roadmap.md              # Build phases and current status
```

---

## Environment variables

| Variable | Where | Description |
|---|---|---|
| `DATABASE_URL` | Backend + GH Actions | PostgreSQL connection string (PostGIS required) |
| `RECREATION_GOV_API_KEY` | Backend + GH Actions | [ridb.recreation.gov](https://ridb.recreation.gov/profile) |
| `NPS_API_KEY` | Backend + GH Actions | [nps.gov/subjects/developer](https://www.nps.gov/subjects/developer/get-started.htm) |
| `NOAA_USER_AGENT` | Backend + GH Actions | e.g. `campscout (your@email.com)` — no key needed |
| `VITE_API_BASE_URL` | Vercel only | Render API URL, e.g. `https://campscout-api.onrender.com` |
