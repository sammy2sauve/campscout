# Roadmap — CampScout

A phased build order. Each phase has a rough goal and concrete tasks.

---

## Phase 0 — Access & environment ✅
- [x] Recreation.gov RIDB API key
- [x] NPS API key
- [x] NOAA User-Agent header
- [x] Neon Postgres + PostGIS
- [x] `.env` configured

---

## Phase 1 — Data model design ✅
- [x] Raw/staging tables (one per source)
- [x] Unified campground + campsite model
- [x] Availability snapshot table (rolling 90-day window)
- [x] Geospatial join strategy (PostGIS ST_Distance)
- [x] `docs/data_model.md` written

---

## Phase 2 — Ingestion modules ✅
- [x] `src/ingestion/recreation_gov.py` — facilities + availability
- [x] `src/ingestion/nps.py` — campground metadata + alerts
- [x] `src/ingestion/noaa.py` — weather forecasts
- [x] Each module independently runnable/failable

---

## Phase 3 — Transform & entity resolution ✅
- [x] Geospatial join: campground → NOAA grid point
- [x] NPS ↔ Recreation.gov entity resolution
- [x] Wildlife/terrain/activity keyword extraction (`src/transform/keywords.json`)
- [x] HTML stripping on descriptions
- [x] Photo URLs extracted from MEDIA array
- [x] `amenity_flags` bit-packed integer (migration 005)
- [x] `reserve_type` mapped from CAMPSITE_RESERVE_TYPE (migration 007)

---

## Phase 4 — Orchestration ✅
- [x] Prefect flows/tasks wrapping ingestion + transform
- [x] Region-aware pipeline (`src/flows/pipeline.py`)
- [x] Retries/backoff for rate-limited sources
- [x] Single-source failure isolation

---

## Phase 5 — API layer ✅
- [x] FastAPI with full `/api` prefix (prod/dev parity)
- [x] `GET /api/regions` — 6 regions with campground counts
- [x] `GET /api/campgrounds` — filter by region, amenities, availability
- [x] `GET /api/campgrounds/{id}` — full detail
- [x] `GET /api/campgrounds/{id}/availability` — per-site windows + fcfs_only flag
- [x] `GET /api/campgrounds/{id}/weather` — 7-day forecast
- [x] `GET /api/campgrounds/{id}/alerts` — NPS alerts
- [x] TTL caching (cachetools), Cache-Control headers

---

## Phase 6 — React map dashboard ✅
- [x] React + react-leaflet, OSM tiles
- [x] Marker clustering, custom tent SVG icons
- [x] Filter panel: amenities, tags, date picker
- [x] Detail panel: photos, weather strip, availability pill, activities/landscape/wildlife
- [x] FCFS walk-in badge (no date picker for first-come sites)
- [x] MapLegend, FreshnessBadge
- [x] Region bbox mask (world-minus-bbox polygon) + state glow overlay — markers always in the clear
- [x] Top nav with region switcher dropdown
- [x] Full scrollable home page (hero, photo gallery, about, region cards)
- [x] Fall/earth theme (parchment palette)
- [x] Skeleton loading cards for region picker (shimmer animation)
- [x] Mobile layout: bottom-sheet FilterPanel + DetailPanel, filter FAB
- [x] "Availability syncing" badge when campsites exist but data not yet loaded
- [x] GET /api/campgrounds/{id}/campsites endpoint (per-site attributes)
- [x] README: Render free-tier cold-start note

---

## Phase 7 — Deploy 🚧

### Done
- [x] Render deploy config (`render.yaml`) — FastAPI backend
- [x] Vercel deploy config (`frontend/vercel.json`) — React frontend
- [x] GitHub Actions: weekly national metadata sync (Sunday 03:00 UTC)
- [x] GitHub Actions: daily SE availability sync (daily 05:00 UTC)
- [x] Pipeline runs in local Prefect mode (no Prefect Cloud, free tier)
- [x] keep-alive.yml: pings /api/regions every 14 min to prevent Render cold sleep
- [x] National ingestion run: 3,961 campgrounds across 6 regions pulled
- [x] Region bboxes corrected in DB (derived from actual campground extents + 1.5° padding)

### Remaining
- [ ] Push latest code to GitHub
- [ ] Verify: daily/weekly Actions trigger successfully on remote
- [ ] Run `--steps availability tags` after each new national ingest for full data coverage

---

## Phase 8 — Portfolio polish

- [ ] README with architecture diagram (sources → staging → transform → unified model → API → frontend)
- [ ] Short write-up: the problem, rate-limit handling, stale-weather degradation, rolling availability window design
- [ ] Screenshots/GIF of the map dashboard

---

## Architecture summary (Option C — Free Tier)

```
Recreation.gov + NPS  →  national metadata sync (all 6 regions, GitHub Actions weekly)
Recreation.gov        →  regional availability sync (SE only, GitHub Actions daily)
NOAA                  →  on-demand per campground (lazy, DB-cached 6h)

DB (Neon, free 0.5 GB — ~160 MB estimated):
  regions              (6 rows)
  campgrounds          (~4,000, amenity_flags, region_id)
  campsites            (~40,000)
  availability_snapshots (SE only, upsert, today → +90 days, ~162K rows)
  weather_forecasts    (upsert, no accumulation)

API (Render free tier):  https://campscout-api.onrender.com
Frontend (Vercel free):  https://campscout-delta.vercel.app
Pipeline (GitHub Actions, 2,000 free min/month):
  - pipeline-metadata.yml  (Sunday 03:00 UTC)
  - pipeline-availability.yml (daily 05:00 UTC)
```
