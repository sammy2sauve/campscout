"""
Phase 3 transform — reads raw staging tables, populates unified model.

Steps run in order:
  1. campgrounds      — from raw_rec_facilities
  2. nps_link         — enrich campgrounds with NPS data
  3. noaa_bootstrap   — resolve NOAA grid IDs for new campgrounds
  4. campsites        — from raw_rec_campsites
  5. availability     — from raw_rec_availability (upsert, not append)
  6. alerts           — from raw_nps_alerts
  7. weather          — from raw_noaa_forecasts
  8. tags             — extract wildlife/terrain tags
  8.5. prune_stale    — delete past-date availability + weather rows

Run standalone:
    python -m src.transform.run
    python -m src.transform.run --steps campgrounds campsites   # subset
"""
import argparse
import logging
import os
import time
from datetime import date, datetime, timezone

import httpx
from dotenv import load_dotenv
from sqlalchemy import text
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.orm import Session

from ..models.amenity_flags import AmenityFlag, dict_to_flags
from ..storage.database import SessionLocal
from ..storage.models import (
    AvailabilitySnapshot,
    Campground,
    CampgroundAlert,
    Campsite,
    WeatherForecast,
)
from ..storage.raw_models import (
    RawNpsAlerts,
    RawNpsCampground,
    RawNoaaForecast,
    RawRecAvailability,
    RawRecCampsite,
    RawRecFacility,
)
from .entity_resolution import (
    max_vehicle_length,
    normalize_attributes,
    parse_nps_amenities,
    resolve_rec_id_from_nps,
)
from .tag_extractor import extract_tags, strip_html

load_dotenv()
log = logging.getLogger(__name__)

NOAA_BASE = "https://api.weather.gov"

# Region → state mapping (mirrors ingestion/recreation_gov.py)
_REGION_BY_STATE: dict[str, str] = {}
_REGION_STATES = {
    "southeast":   ["FL", "GA", "AL", "MS", "TN", "NC", "SC", "VA", "WV", "KY", "AR"],
    "northeast":   ["ME", "NH", "VT", "MA", "RI", "CT", "NY", "NJ", "PA", "MD", "DE"],
    "great_lakes": ["OH", "IN", "IL", "MI", "WI", "MN", "IA", "MO"],
    "plains":      ["ND", "SD", "NE", "KS", "OK", "TX"],
    "mountain":    ["MT", "ID", "WY", "CO", "NM", "UT", "AZ", "NV"],
    "pacific_west": ["CA", "OR", "WA"],
}
for _rid, _states in _REGION_STATES.items():
    for _s in _states:
        _REGION_BY_STATE[_s] = _rid


# ---------------------------------------------------------------------------
# Step 1: campgrounds
# ---------------------------------------------------------------------------

def transform_campgrounds(db: Session) -> None:
    """Populate campgrounds from raw_rec_facilities."""
    rows = db.query(RawRecFacility).all()
    log.info("Processing %d raw facilities", len(rows))

    for row in rows:
        f = row.payload
        fid = f["FacilityID"]

        cg = db.query(Campground).filter_by(rec_facility_id=fid).one_or_none()
        if cg is None:
            cg = Campground(rec_facility_id=fid)
            db.add(cg)

        cg.name = f.get("FacilityName", "")
        cg.description = strip_html(f.get("FacilityDescription") or "")
        cg.phone = f.get("FacilityPhone")

        # Extract primary photo URLs from MEDIA array (already fetched via full=true)
        media = f.get("MEDIA", [])
        photos = [m["URL"] for m in media if m.get("EntityMediaType") == "Image" and m.get("URL")]
        cg.photo_urls = photos[:5] if photos else None
        cg.reservation_url = f.get("FacilityReservationURL")
        cg.stay_limit = f.get("StayLimit") or None

        lat = f.get("FacilityLatitude")
        lon = f.get("FacilityLongitude")
        if lat and lon:
            from geoalchemy2.elements import WKTElement
            cg.location = WKTElement(f"POINT({lon} {lat})", srid=4326)

        # State from address
        addrs = f.get("FACILITYADDRESS", [])
        if addrs:
            cg.state_code = addrs[0].get("AddressStateCode")

        # ADA flag goes into amenity_flags
        if f.get("FacilityAdaAccess", ""):
            cg.amenity_flags = cg.amenity_flags | int(AmenityFlag.ADA_ACCESSIBLE)

        # Assign region from state code
        if cg.state_code:
            cg.region_id = _REGION_BY_STATE.get(cg.state_code.upper())

    db.commit()
    log.info("Campgrounds table: %d rows", db.query(Campground).count())


# ---------------------------------------------------------------------------
# Step 2: NPS link
# ---------------------------------------------------------------------------

def transform_nps_link(db: Session) -> None:
    """Enrich campgrounds with NPS data where we can resolve a match."""
    rows = db.query(RawNpsCampground).all()
    linked = 0

    for row in rows:
        nps = row.payload
        rec_id = resolve_rec_id_from_nps(nps)
        if rec_id is None:
            log.debug("Could not resolve NPS campground '%s' to a rec.gov facility", nps.get("name"))
            continue

        cg = db.query(Campground).filter_by(rec_facility_id=rec_id).one_or_none()
        if cg is None:
            log.debug("NPS linked to rec_id=%s but campground not in DB yet", rec_id)
            continue

        cg.nps_id = nps["id"]
        amenities = parse_nps_amenities(nps)
        cg.amenity_flags = dict_to_flags({
            **amenities,
            "has_electricity": bool(cg.amenity_flags & int(AmenityFlag.ELECTRICITY)),
            "pets_allowed":    bool(cg.amenity_flags & int(AmenityFlag.PETS_ALLOWED)),
            "ada_accessible":  bool(cg.amenity_flags & int(AmenityFlag.ADA_ACCESSIBLE)),
        })
        linked += 1

    db.commit()
    log.info("Linked %d NPS campgrounds to facilities", linked)


# ---------------------------------------------------------------------------
# Step 3: NOAA bootstrap
# ---------------------------------------------------------------------------

def _noaa_get(client: httpx.Client, url: str) -> dict:
    wait = 2
    for attempt in range(4):
        resp = client.get(url)
        if resp.status_code in (429, 500, 503):
            log.warning("NOAA %d on attempt %d, backing off %ds", resp.status_code, attempt + 1, wait)
            time.sleep(wait)
            wait *= 2
            continue
        resp.raise_for_status()
        return resp.json()
    raise RuntimeError(f"NOAA still failing: {url}")


def transform_noaa_bootstrap(db: Session) -> None:
    """
    For every campground without a noaa_grid_id, call the NOAA Points API
    to resolve its coordinates to a forecast grid, then store the forecast.
    """
    unbooted = (
        db.query(Campground)
        .filter(Campground.noaa_grid_id.is_(None), Campground.location.isnot(None))
        .all()
    )
    log.info("Bootstrapping NOAA for %d campgrounds", len(unbooted))

    ua = os.getenv("NOAA_USER_AGENT", "campscout")
    with httpx.Client(
        headers={"User-Agent": ua, "Accept": "application/geo+json"},
        timeout=15,
    ) as client:
        for cg in unbooted:
            # Extract lat/lon from PostGIS geometry
            row = db.execute(
                text("SELECT ST_Y(location::geometry), ST_X(location::geometry) FROM campgrounds WHERE id = :id"),
                {"id": cg.id},
            ).fetchone()
            if row is None:
                continue
            lat, lon = row

            try:
                points = _noaa_get(client, f"{NOAA_BASE}/points/{lat:.4f},{lon:.4f}")
            except Exception as exc:
                log.warning("NOAA Points failed campground=%s: %s — marking stale", cg.name, exc)
                cg.weather_stale = True
                db.commit()
                time.sleep(1)
                continue

            props = points["properties"]
            cg.noaa_grid_id = f"{props['gridId']}/{props['gridX']}/{props['gridY']}"
            cg.noaa_forecast_url = props["forecast"]
            cg.weather_stale = False

            # Fetch and store the forecast in the raw table
            try:
                forecast = _noaa_get(client, props["forecast"])
                from ..storage.raw_models import RawNoaaForecast
                db.add(RawNoaaForecast(
                    grid_id=cg.noaa_grid_id,
                    payload=forecast["properties"],
                ))
                cg.weather_fetched_at = datetime.now(timezone.utc)
            except Exception as exc:
                log.warning("Forecast fetch failed grid=%s: %s — marking stale", cg.noaa_grid_id, exc)
                cg.weather_stale = True

            db.commit()
            log.info("Bootstrapped NOAA for campground=%s grid=%s", cg.name, cg.noaa_grid_id)
            time.sleep(1)


# ---------------------------------------------------------------------------
# Step 4: campsites
# ---------------------------------------------------------------------------

def transform_campsites(db: Session) -> None:
    """Populate campsites from raw_rec_campsites."""
    rows = db.query(RawRecCampsite).all()
    log.info("Processing %d raw campsite payloads", len(rows))

    for row in rows:
        cg = db.query(Campground).filter_by(rec_facility_id=row.facility_id).one_or_none()
        if cg is None:
            log.warning("No campground for facility_id=%s — skipping campsites", row.facility_id)
            continue

        for site in row.payload:
            site_id = site["CampsiteID"]
            cs = db.query(Campsite).filter_by(rec_campsite_id=site_id).one_or_none()
            if cs is None:
                cs = Campsite(rec_campsite_id=site_id, campground_id=cg.id)
                db.add(cs)

            cs.name = site.get("CampsiteName")
            cs.loop = site.get("Loop")
            cs.site_type = site.get("CampsiteType")
            cs.type_of_use = site.get("TypeOfUse")
            cs.is_reservable = site.get("CampsiteReservable", False)
            cs.ada_accessible = site.get("CampsiteAccessible", False)
            cs.max_vehicle_length_ft = max_vehicle_length(site.get("PERMITTEDEQUIPMENT", []))

            attrs = normalize_attributes(site.get("ATTRIBUTES", []))
            cs.has_electricity = attrs["has_electricity"] or "electric" in (cs.site_type or "").lower()
            cs.has_water_hookup = attrs["has_water_hookup"]
            cs.has_sewer_hookup = attrs["has_sewer_hookup"]
            cs.pets_allowed = attrs["pets_allowed"]
            cs.max_occupants = attrs["max_occupants"]

        db.commit()

    # Roll up electricity to campground amenity_flags
    for cg in db.query(Campground).all():
        has_any = (
            db.query(Campsite)
            .filter_by(campground_id=cg.id, has_electricity=True)
            .first()
        )
        if has_any:
            cg.amenity_flags = cg.amenity_flags | int(AmenityFlag.ELECTRICITY)
        else:
            cg.amenity_flags = cg.amenity_flags & ~int(AmenityFlag.ELECTRICITY)

    db.commit()
    log.info("Campsites table: %d rows", db.query(Campsite).count())


# ---------------------------------------------------------------------------
# Step 5: availability (upsert model)
# ---------------------------------------------------------------------------

def transform_availability(db: Session) -> None:
    """
    Populate availability_snapshots from raw_rec_availability.
    Uses upsert (ON CONFLICT DO UPDATE) — not append.
    Bulk-inserts in chunks to avoid per-row round-trips.
    """
    raw_rows = db.query(RawRecAvailability).all()
    log.info("Processing %d raw availability rows", len(raw_rows))

    # Build a lookup of rec_campsite_id → internal campsite.id
    site_id_map: dict[str, int] = {
        cs.rec_campsite_id: cs.id
        for cs in db.query(Campsite.rec_campsite_id, Campsite.id).all()
    }

    # Build a lookup of facility_id → campground ORM object (for timestamp update)
    facility_cg_map: dict[str, Campground] = {
        cg.rec_facility_id: cg
        for cg in db.query(Campground).all()
    }

    upserted = 0
    CHUNK = 1000

    for raw in raw_rows:
        batch: list[dict] = []
        campsites_data = raw.payload.get("campsites", {})

        for rec_site_id, site_data in campsites_data.items():
            if site_data.get("type_of_use") == "Day":
                continue
            internal_id = site_id_map.get(rec_site_id)
            if internal_id is None:
                continue

            for dt_str, status in site_data.get("availabilities", {}).items():
                try:
                    snap_date = date.fromisoformat(dt_str[:10])
                except ValueError:
                    continue
                batch.append({
                    "campsite_id": internal_id,
                    "date": snap_date,
                    "status": status,
                    "fetched_at": raw.fetched_at,
                })

                if len(batch) >= CHUNK:
                    db.execute(
                        pg_insert(AvailabilitySnapshot)
                        .on_conflict_do_update(
                            index_elements=["campsite_id", "date"],
                            set_={"status": pg_insert(AvailabilitySnapshot).excluded.status,
                                  "fetched_at": pg_insert(AvailabilitySnapshot).excluded.fetched_at},
                        ),
                        batch,
                    )
                    db.commit()
                    upserted += len(batch)
                    log.info("  ...%d snapshots upserted", upserted)
                    batch = []

        if batch:
            db.execute(
                pg_insert(AvailabilitySnapshot)
                .on_conflict_do_update(
                    index_elements=["campsite_id", "date"],
                    set_={"status": pg_insert(AvailabilitySnapshot).excluded.status,
                          "fetched_at": pg_insert(AvailabilitySnapshot).excluded.fetched_at},
                ),
                batch,
            )
            db.commit()
            upserted += len(batch)

        # Update availability_fetched_at on the parent campground
        cg = facility_cg_map.get(raw.facility_id)
        if cg is not None:
            cg.availability_fetched_at = datetime.now(timezone.utc)

    db.commit()
    log.info("Availability snapshots: %d upserted", upserted)


# ---------------------------------------------------------------------------
# Step 6: alerts
# ---------------------------------------------------------------------------

def transform_alerts(db: Session) -> None:
    """Populate campground_alerts from raw_nps_alerts."""
    raw_rows = db.query(RawNpsAlerts).all()
    log.info("Processing %d raw alert payloads", len(raw_rows))
    inserted = 0

    for raw in raw_rows:
        for alert in raw.payload:
            # Find which campground this alert belongs to via park_code → nps_id
            cg = db.query(Campground).filter_by(nps_id=None).first()  # start with full query
            cg = (
                db.query(Campground)
                .filter(Campground.nps_id.isnot(None))
                .join(
                    RawNpsCampground,
                    RawNpsCampground.payload["parkCode"].astext == alert.get("parkCode", ""),
                )
                .first()
            )
            # Simpler fallback: find campground whose nps_id maps to this park_code
            # (nps_id is the campground UUID, not the park code — need to look up via raw table)
            nps_rows = (
                db.query(RawNpsCampground)
                .filter(
                    RawNpsCampground.payload["parkCode"].astext == alert.get("parkCode", "")
                )
                .all()
            )
            for nps_row in nps_rows:
                cg = db.query(Campground).filter_by(nps_id=nps_row.nps_id).one_or_none()
                if cg is None:
                    continue

                published = None
                li = alert.get("lastIndexedDate", "")
                if li:
                    try:
                        published = datetime.fromisoformat(li.split(".")[0])
                    except ValueError:
                        pass

                stmt = (
                    pg_insert(CampgroundAlert)
                    .values(
                        campground_id=cg.id,
                        nps_alert_id=alert["id"],
                        title=alert.get("title", ""),
                        description=alert.get("description"),
                        category=alert.get("category"),
                        affects_whole_campground=True,
                        published_at=published,
                        fetched_at=raw.fetched_at,
                    )
                    .on_conflict_do_nothing()
                )
                db.execute(stmt)
                inserted += 1

    db.commit()
    log.info("Campground alerts: %d inserted", inserted)


# ---------------------------------------------------------------------------
# Step 7: weather
# ---------------------------------------------------------------------------

def transform_weather(db: Session) -> None:
    """Populate weather_forecasts from raw_noaa_forecasts."""
    raw_rows = db.query(RawNoaaForecast).all()
    log.info("Processing %d raw forecast payloads", len(raw_rows))
    inserted = 0

    for raw in raw_rows:
        # Find campground(s) that use this grid
        campgrounds = db.query(Campground).filter_by(noaa_grid_id=raw.grid_id).all()
        if not campgrounds:
            log.debug("No campground uses grid=%s — skipping", raw.grid_id)
            continue

        periods = raw.payload.get("periods", [])
        for period in periods:
            try:
                forecast_date = date.fromisoformat(period["startTime"][:10])
            except (KeyError, ValueError):
                continue

            precip = period.get("probabilityOfPrecipitation", {}) or {}
            precip_val = precip.get("value")

            for cg in campgrounds:
                stmt = (
                    pg_insert(WeatherForecast)
                    .values(
                        campground_id=cg.id,
                        forecast_date=forecast_date,
                        is_daytime=period.get("isDaytime", True),
                        temperature_f=period.get("temperature"),
                        precip_pct=int(precip_val) if precip_val is not None else None,
                        wind_speed=period.get("windSpeed"),
                        wind_direction=period.get("windDirection"),
                        short_forecast=period.get("shortForecast"),
                        detailed_forecast=period.get("detailedForecast"),
                        fetched_at=raw.fetched_at,
                    )
                    .on_conflict_do_update(
                        constraint="uq_weather_campground_date_tod",
                        set_={
                            "temperature_f": period.get("temperature"),
                            "precip_pct": int(precip_val) if precip_val is not None else None,
                            "wind_speed": period.get("windSpeed"),
                            "wind_direction": period.get("windDirection"),
                            "short_forecast": period.get("shortForecast"),
                            "detailed_forecast": period.get("detailedForecast"),
                            "fetched_at": raw.fetched_at,
                        },
                    )
                )
                db.execute(stmt)
                inserted += 1

    db.commit()
    log.info("Weather forecasts: %d upserted", inserted)


# ---------------------------------------------------------------------------
# Step 8: tag extraction
# ---------------------------------------------------------------------------

def transform_tags(db: Session) -> None:
    """Extract wildlife and terrain tags from campground text fields."""
    campgrounds = db.query(Campground).all()
    log.info("Extracting tags for %d campgrounds", len(campgrounds))

    for cg in campgrounds:
        # Gather text: facility description + any NPS fields we have via raw table
        text_parts = [cg.description or ""]

        if cg.nps_id:
            nps_row = db.query(RawNpsCampground).filter_by(nps_id=cg.nps_id).one_or_none()
            if nps_row:
                nps = nps_row.payload
                text_parts += [
                    nps.get("description", ""),
                    nps.get("weatherOverview", ""),
                    nps.get("regulationsOverview", ""),
                ]

        # Also include alert text
        alerts = db.query(CampgroundAlert).filter_by(campground_id=cg.id).all()
        for alert in alerts:
            text_parts.append(alert.description or "")

        combined = " ".join(text_parts)
        wildlife, landscape, activities = extract_tags(combined)
        cg.wildlife_tags = wildlife or None
        cg.terrain_tags = landscape or None
        cg.activity_tags = activities or None

    db.commit()
    log.info("Tags extracted")


# ---------------------------------------------------------------------------
# Step 8.5: prune stale data
# ---------------------------------------------------------------------------

def prune_stale_data(db: Session) -> None:
    """
    Delete past-date availability and weather rows.
    Keeps the rolling 90-day window clean — no unbounded growth.
    """
    avail_deleted = db.execute(
        text("DELETE FROM availability_snapshots WHERE date < CURRENT_DATE")
    ).rowcount
    weather_deleted = db.execute(
        text("DELETE FROM weather_forecasts WHERE forecast_date < CURRENT_DATE")
    ).rowcount
    db.commit()
    log.info("Pruned %d past availability rows, %d past weather rows", avail_deleted, weather_deleted)


# ---------------------------------------------------------------------------
# Orchestrator
# ---------------------------------------------------------------------------

ALL_STEPS = ["campgrounds", "nps_link", "noaa_bootstrap", "campsites",
             "availability", "alerts", "weather", "tags", "prune_stale"]

_STEP_FNS = {
    "campgrounds":   transform_campgrounds,
    "nps_link":      transform_nps_link,
    "noaa_bootstrap": transform_noaa_bootstrap,
    "campsites":     transform_campsites,
    "availability":  transform_availability,
    "alerts":        transform_alerts,
    "weather":       transform_weather,
    "tags":          transform_tags,
    "prune_stale":   prune_stale_data,
}


def run(steps: list[str] = ALL_STEPS) -> None:
    with SessionLocal() as db:
        for step in steps:
            log.info("=== Step: %s ===", step)
            _STEP_FNS[step](db)
    log.info("Transform complete")


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
    parser = argparse.ArgumentParser(description="Run the CampScout transform pipeline.")
    parser.add_argument("--steps", nargs="+", choices=ALL_STEPS, default=ALL_STEPS,
                        metavar="STEP", help=f"Steps to run (default: all). Choices: {ALL_STEPS}")
    args = parser.parse_args()
    run(steps=args.steps)
