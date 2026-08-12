# Roadmap — CampScout

A phased build order. Each phase has a rough goal and concrete tasks. Do them
roughly in order — later phases depend on decisions made in earlier ones
(especially the data model in Phase 1).

---

## Phase 0 — Access & environment (do this first, ~1 evening)

Nothing else can start until you have API access and somewhere to store data.

- [ ] Request a **Recreation.gov RIDB API key** — https://ridb.recreation.gov/profile (near-instant approval)
- [ ] Request an **NPS API key** — https://www.nps.gov/subjects/developer/get-started (near-instant)
- [ ] NOAA APIs (api.weather.gov, NDBC) don't require a key, just a descriptive User-Agent header — decide on one now (e.g. `campscout (your-email)`)
- [ ] Stand up Postgres with PostGIS enabled — either Neon (supports the `postgis` extension) or local Docker (`postgres:16` + `CREATE EXTENSION postgis;`)
- [ ] Fill in `.env` from `.env.example`
- [ ] `pip install -r requirements.txt` in a virtualenv
- [ ] Sanity check: hit each API manually (curl or a notebook cell) with your key and confirm you get real data back before writing any pipeline code

**Exit criteria:** you can query all three APIs manually and connect to Postgres from Python.

---

## Phase 1 — Data model design (~1-2 evenings)

This is the most important phase to get right — it's the contract every
other piece of code depends on. Don't skip to code before this is sketched.

- [ ] Define the **raw/staging tables** — one per source, storing the API response close to as-received (so reprocessing doesn't require re-hitting rate-limited APIs)
- [ ] Define the **unified `campsite` model** — the resolved, joined entity: location, amenities, pet policy, nearest weather station, current alerts, extracted wildlife/terrain tags
- [ ] Define the **availability snapshot** table — time-series shaped, since availability is what changes constantly (this is what lets you later answer "how far ahead do I need to book X")
- [ ] Decide the **geospatial join strategy**: nearest weather station to each campsite (PostGIS `ST_Distance` / k-nearest), and how "closures" (freeform NPS alert text) map onto specific campsites vs. a whole campground
- [ ] Write this all up in `docs/data_model.md` — table diagrams or just a clear schema listing is enough, this is a working reference, not a deliverable

**Exit criteria:** you (or I) could write CREATE TABLE statements directly from this doc without ambiguity.

---

## Phase 2 — Ingestion modules (~3-5 evenings, one source at a time)

Build and test each source independently — this is also where Prefect's
per-source failure isolation actually pays off.

- [ ] `src/ingestion/recreation_gov.py` — facility search for your region, availability polling per facility, respecting rate limits with backoff
- [ ] `src/ingestion/nps.py` — campground metadata + alerts for the same facilities
- [ ] `src/ingestion/noaa.py` — forecast pull per resolved weather station
- [ ] Each module: write raw responses to the staging tables from Phase 1, log clearly what it fetched, and fail *only itself* on error (not the whole run)
- [ ] Write a quick manual test/script for each: run it standalone, confirm rows land in staging tables

**Exit criteria:** you can run each ingestion module independently and see real rows in the raw/staging tables.

---

## Phase 3 — Transform & entity resolution (~3-4 evenings)

Where the "hard" data engineering work lives.

- [ ] Geospatial join: campsite → nearest weather station
- [ ] Alert-to-campsite resolution: parse which specific sites/loops an NPS alert affects (start simple — whole-campground granularity is a fine v1, don't over-engineer parsing sub-loop text on day one)
- [ ] Wildlife/terrain **keyword extraction** from description/alert text — build the keyword list as an editable data file, not inline code (per `CLAUDE.md`)
- [ ] Write the transform output into the unified `campsite` model tables from Phase 1
- [ ] Handle the degraded cases explicitly: stale/missing weather, missing NPS data — decide what the unified model shows in each case (null? "unknown"? last-known value with a staleness flag?)

**Exit criteria:** the unified `campsite` table is populated and correct for a handful of campgrounds you can manually verify against the real Recreation.gov site.

---

## Phase 4 — Orchestration (~1-2 evenings)

- [ ] Wrap ingestion + transform into Prefect flows/tasks
- [ ] Set a schedule (availability polls more frequently than weather/alerts — don't run everything on one cadence)
- [ ] Add retries/backoff at the task level for rate-limited sources
- [ ] Confirm one source failing doesn't take down the whole flow (deliberately break one API key temporarily and watch it degrade gracefully)

**Exit criteria:** the whole pipeline runs unattended on a schedule and survives a simulated single-source failure.

---

## Phase 5 — API layer (~2-3 evenings)

- [ ] FastAPI endpoints: search by radius (ZIP/city/state → geocode → PostGIS radius query), filter by amenities/pet policy/availability window
- [ ] Endpoint for a single campsite's full detail (including wildlife/features report)
- [ ] Basic response schemas (pydantic) matching what the frontend map will need

**Exit criteria:** you can hit the API with curl/Postman and get back exactly the data the map view will need.

---

## Phase 6 — Frontend: map dashboard (~4-6 evenings)

- [ ] React + react-leaflet base map, US-wide view, marker clustering as you zoom out
- [ ] Search bar: ZIP/city/state + radius
- [ ] Filter panel: amenities, dog-friendly, availability window
- [ ] Site detail panel/modal: photos (if available), amenities, wildlife report, features report, current alerts, weather
- [ ] Wire it to the FastAPI backend

**Exit criteria:** you can open the dashboard, search a region, filter it, and click into a site's detail view — the tool is actually usable end to end.

---

## Phase 7 — Deploy (~1-2 evenings)

- [ ] Backend + Prefect: Render (matches your last project's deploy pattern)
- [ ] Frontend: Vercel
- [ ] DB: Neon (Postgres + PostGIS)
- [ ] Confirm the scheduled pipeline actually runs in production, not just locally

**Exit criteria:** a public (or at least demoable) URL you can actually use before your next camping trip.

---

## Phase 8 — Portfolio polish (~1-2 evenings)

- [ ] README with architecture diagram (sources → staging → transform → unified model → API → frontend)
- [ ] Short write-up: the problem, the messy-data challenges you actually hit (rate limits, alert text parsing, stale weather stations), and how the pipeline handles them — this is the part that reads well to an interviewer
- [ ] A few screenshots/GIF of the map dashboard in action

---

## Rough total: ~6-8 weeks at evenings/weekends pace, faster if you go heads-down.

## Immediate next action

Phase 0, right now: go request the Recreation.gov and NPS API keys (they're
usually instant) and get Postgres/PostGIS running. That's the actual
unblocking step before anything else on this list.
