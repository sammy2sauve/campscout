# CLAUDE.md

Guidance for Claude Code when working in this repository. Read
`PROBLEM_STATEMENT.md` first — it defines *why* this exists and what's in/out
of scope. This file is about *how* to build it.

## Project summary

CampScout ingests campsite availability (Recreation.gov), campground
metadata/alerts (NPS), and weather (NOAA) for federal campgrounds in the
Southeast US, resolves them into one data model, extracts structured
wildlife/terrain tags from free-text descriptions, and serves it all through
a map-first search dashboard.

## Stack decisions (and why)

| Layer | Choice | Why |
|---|---|---|
| Orchestration | Prefect | Real scheduling, retries, and dependency graphs across 3 independent, differently-paced sources — not a cron script |
| Database | PostgreSQL + PostGIS | Nearest-station geospatial joins are core to this problem, not an afterthought |
| Backend | FastAPI | Matches existing skillset, async-friendly for polling multiple slow government APIs |
| Frontend | React + react-leaflet | Map-first dashboard; Leaflet + OSM tiles avoid a Mapbox API key/billing dependency |
| Text extraction | Rule-based (regex/keyword tagging) for v1 | Deterministic, no external API dependency for a scheduled pipeline; LLM-assisted extraction is a documented stretch goal, not a v1 dependency |

Do not swap these without discussing first — they were chosen deliberately,
not defaults.

## Repo structure

```
campscout/
├── src/
│   ├── ingestion/     # One module per source: recreation_gov.py, nps.py, noaa.py
│   ├── transform/     # Entity resolution, text extraction, unified model mapping
│   ├── storage/        # DB models, migrations, PostGIS helpers
│   ├── api/            # FastAPI app, routes, schemas
│   └── models/         # Shared pydantic models / domain types
├── tests/
├── docs/               # Data model notes, API gotchas discovered along the way
├── PROBLEM_STATEMENT.md
└── CLAUDE.md
```

## Data source gotchas (update this section as you learn more)

- **Recreation.gov API**: not built for bulk/regional queries — expect to
  iterate per-facility. Rate limits are real; back off aggressively rather
  than retry-hammering.
- **NPS API**: alerts are freeform text, not structured status codes — the
  transform layer must parse these, not assume a clean enum.
- **NOAA**: stations go offline; the pipeline must degrade gracefully (mark
  weather as stale/unavailable) rather than fail the whole run when one
  station doesn't respond.

## UI conventions

- **Always use the TypeUI MCP** before making any frontend UI/UX decisions.
  - Call `typeui_get_section_prompt` or `typeui_setup_workflow` before generating or editing UI components.
  - Read the installed fundamentals guardrail files in `.claude/skills/typeui-fundamentals/` before applying design changes.
  - TypeUI principles override personal defaults for spacing, hierarchy, typography, and component patterns.
- Terrain/landscape section is labelled **"Landscape"** (not "Terrain" or "Terrain & Features") everywhere in the UI.

## Working conventions

- Each ingestion module should be independently runnable and independently
  failable — one source failing must not block the others (this is the whole
  point of using Prefect instead of a linear script).
- Store raw API responses before transforming (a raw/staging layer), so
  reprocessing after a bug fix doesn't require re-hitting rate-limited APIs.
- New keyword/tag additions to the wildlife/terrain extraction go in
  `src/transform/` with the keyword list itself kept in a separate,
  easily-editable data file — not hardcoded inline.
- Prefer small, composable Prefect tasks over large monolithic ones.

## Environment

Copy `.env.example` to `.env` and fill in:
- `RECREATION_GOV_API_KEY`
- `NPS_API_KEY`
- `DATABASE_URL` (Postgres w/ PostGIS extension enabled)

## Current status

Project scaffolding only — no pipeline code yet. See `PROBLEM_STATEMENT.md`
for MVP scope before starting on ingestion modules.
