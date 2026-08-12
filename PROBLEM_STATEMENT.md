# Problem Statement — CampScout

## The problem

Recreation.gov shows campsite availability one campground at a time. It has
no way to answer the question people actually have: **"where can I camp this
weekend that's actually open, and won't be miserable weather-wise?"**

Answering that today means manually checking a dozen individual campground
pages on Recreation.gov, cross-referencing NPS/USFS alert pages for closures,
and separately checking a weather app — repeated for every campground you're
considering. There's no aggregated, queryable view across sources.

## Who this is for

Primarily: me, checking it before actual camping trips. Secondarily: anyone
who camps regularly in the region and is tired of tab-switching between
Recreation.gov, park alert pages, and a weather app.

## Why this is a real data engineering problem (not just an API wrapper)

Three independent government data sources, each with different shapes:

| Source | What it gives us | Update cadence | Pain point |
|---|---|---|---|
| Recreation.gov API | Campsite-level availability | Changes by the minute | Rate-limited, not built for bulk/regional queries, requires per-campground polling |
| NPS API | Campground metadata, alerts/closures | Irregular, freeform text | Alerts are unstructured prose — "Loop B closed due to bear activity" — not a clean status field |
| NOAA (weather + CO-OPS tides) | Forecasts, conditions | Hourly | Nearest-station matching is a geospatial join, not a lookup; stations go offline |

The core engineering work is **entity resolution and orchestration**: matching
each campsite to its nearest weather station, reconciling a closure alert
with the specific campsites it affects, handling partial/stale data when one
source lags or fails, and doing all of this on a repeating schedule without
hammering rate limits.

## MVP scope

- **Region:** Southeast US, campgrounds within ~4 hours' drive of Atlanta, GA
  (expandable later — the pipeline should not hardcode this boundary into the
  data model, just into the initial ingestion query).
- **Data included:** campsite availability, campground metadata + alerts,
  weather forecast, precipitation, temperature. Tide data deferred (only
  relevant for coastal sites — v2).
- **Out of scope for v1:** state park / private campground data (Recreation.gov
  covers federal land only), user accounts, notifications/alerts, mobile app.

## Deliverable

1. A scheduled pipeline that ingests all three sources, resolves them into a
   unified data model, and stores snapshots over time.
2. A FastAPI service exposing search/filter over the unified model (see below).
3. **A map-first React dashboard** — a full US map (zoom/pan), where:
   - Campsites render as clickable markers/clusters that resolve as you zoom in
   - Search by ZIP/city/state + radius (e.g. "within 50 miles of 30301")
   - Filters: amenities (electric hookup, potable water, showers, etc.),
     pet policy (dog-friendly y/n), availability window, weather
   - Each site has a detail view with a **wildlife report** and **features
     report** — short, structured summaries extracted from the campground's
     free-text description/alerts, not just a link back to Recreation.gov

   This is meant to be a genuinely more useful holistic view of a site than
   Recreation.gov's own page — one page that answers "what is this place
   actually like" instead of five tabs.

### New pipeline stage this implies: text extraction

Recreation.gov/NPS campground descriptions and alerts are free text
("Black bears are active in this area, store food properly," "Sites 12-18
are shaded, sites 1-11 are open field"). Amenities/pet policy are already
structured fields (RIDB), but wildlife and terrain/features info is not —
it has to be pulled out of prose. This becomes its own transformation stage:
extract structured tags (wildlife present, shade/exposure, noise level,
terrain type) from unstructured description/alert text per site, stored
alongside the structured fields. Worth deciding early whether this is
rule-based (keyword/regex extraction) or LLM-assisted summarization —
we'll cover that in the pipeline design.

## Success criteria

- I can answer "where can I camp this weekend" in one page load, not five
  browser tabs.
- The pipeline runs unattended on a schedule and survives one source being
  down or rate-limited without crashing the whole run.
- Historical availability snapshots are stored, so "how far in advance do I
  actually need to book X campground" becomes answerable later.
