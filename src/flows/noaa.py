"""
Prefect flow wrapping NOAA forecast ingestion.

In the full pipeline, coordinates are read from the campgrounds table
(populated by the transform layer on prior runs) rather than hardcoded.
This means on the very first run the table is empty and NOAA skips gracefully;
the transform's noaa_bootstrap step handles initial grid resolution.

Run standalone:
    python -m src.flows.noaa
"""
import logging
import os

import httpx
from dotenv import load_dotenv
from prefect import flow, task
from sqlalchemy import text

from ..ingestion.noaa import ingest_forecast
from ..storage.database import SessionLocal

load_dotenv()

log = logging.getLogger(__name__)


@task(name="noaa-load-coords", retries=2, retry_delay_seconds=30)
def load_coords_from_db() -> list[tuple[str, str]]:
    """
    Query the campgrounds table for all rows that have a PostGIS location
    and return (lat, lon) string pairs suitable for the NOAA Points API.

    Returns an empty list when no campgrounds are present (e.g. first run
    before the transform has populated the unified model).
    """
    with SessionLocal() as db:
        rows = db.execute(
            text(
                "SELECT ST_Y(location::geometry), ST_X(location::geometry) "
                "FROM campgrounds WHERE location IS NOT NULL"
            )
        ).fetchall()

    coords = [(str(row[0]), str(row[1])) for row in rows]
    log.info("Loaded %d campground coordinates from DB", len(coords))
    return coords


@task(name="noaa-fetch-forecast", retries=2, retry_delay_seconds=30)
def fetch_forecast(lat: str, lon: str) -> None:
    """Fetch and store the NOAA 7-day forecast for a single coordinate pair."""
    ua = os.getenv("NOAA_USER_AGENT", "campscout")
    with (
        httpx.Client(
            headers={"User-Agent": ua, "Accept": "application/geo+json"},
            timeout=15,
        ) as client,
        SessionLocal() as db,
    ):
        grid_id = ingest_forecast(client, db, lat, lon)
        if grid_id is None:
            log.warning("Skipped lat=%s lon=%s — NOAA unavailable (stale)", lat, lon)


@flow(name="noaa-ingest")
def noaa_flow() -> None:
    """
    Refresh NOAA forecasts for all campgrounds with a known location.

    Coordinates come from the campgrounds table (not hardcoded).
    Per-coordinate failures are non-fatal — ingest_forecast already
    handles them gracefully and returns None on failure.
    """
    coords = load_coords_from_db()
    if not coords:
        log.warning("No campground coordinates found in DB — NOAA ingest skipped")
        return

    for lat, lon in coords:
        try:
            fetch_forecast(lat, lon)
        except Exception as exc:
            # A single coordinate failing must not stop the rest.
            log.error("NOAA ingest failed lat=%s lon=%s: %s", lat, lon, exc)


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
    noaa_flow()
