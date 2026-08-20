"""
NOAA ingestion — weather forecasts for given coordinates.

For each (lat, lon) pair:
  1. Calls the NOAA Points API to resolve coordinates to a forecast grid.
  2. Fetches the 7-day forecast for that grid.
  3. Writes the raw forecast payload to raw_noaa_forecasts.

In the full pipeline (Phase 4), coordinates come from the campgrounds table.
For standalone testing, pass coords on the CLI or use the built-in defaults.

Run standalone:
    python -m src.ingestion.noaa
    python -m src.ingestion.noaa --coords "34.77,-83.93" "35.46,-83.19"
"""
import argparse
import logging
import os
import time

import httpx
from dotenv import load_dotenv

from ..storage.database import SessionLocal
from ..storage.raw_models import RawNoaaForecast

load_dotenv()

log = logging.getLogger(__name__)

BASE_URL = "https://api.weather.gov"

# Default test coordinates for standalone runs.
# Vogel State Park (GA) and DuPont State Forest (NC).
DEFAULT_COORDS: list[tuple[str, str]] = [
    ("34.7693", "-83.9285"),
    ("35.1854", "-82.6246"),
]


def _get(client: httpx.Client, url: str) -> dict:
    """GET with backoff on transient NOAA failures (429, 500, 503)."""
    wait = 2
    for attempt in range(4):
        resp = client.get(url)
        if resp.status_code in (429, 500, 503):
            log.warning("NOAA returned %d (attempt %d), backing off %ds",
                        resp.status_code, attempt + 1, wait)
            time.sleep(wait)
            wait *= 2
            continue
        resp.raise_for_status()
        return resp.json()
    raise RuntimeError(f"NOAA still failing after retries: {url}")


def ingest_forecast(client: httpx.Client, db, lat: str, lon: str) -> str | None:
    """
    Bootstrap NOAA grid for a coordinate and store the forecast.

    Returns the grid_id (e.g. "FFC/64/133") on success, None on failure.
    Failure is non-fatal — caller should mark the campground weather_stale.
    """
    # Step 1: resolve lat/lon → forecast grid
    try:
        points = _get(client, f"{BASE_URL}/points/{lat},{lon}")
    except Exception as exc:
        log.warning("Points API failed lat=%s lon=%s: %s", lat, lon, exc)
        return None

    props = points["properties"]
    grid_id = f"{props['gridId']}/{props['gridX']}/{props['gridY']}"
    forecast_url = props["forecast"]

    # Step 2: fetch the 7-day forecast
    try:
        forecast = _get(client, forecast_url)
    except Exception as exc:
        log.warning("Forecast fetch failed grid=%s: %s", grid_id, exc)
        return None

    db.add(RawNoaaForecast(grid_id=grid_id, payload=forecast["properties"]))
    db.commit()
    log.info("Stored forecast grid=%s", grid_id)
    return grid_id


def run(coords: list[tuple[str, str]] = DEFAULT_COORDS) -> None:
    ua = os.getenv("NOAA_USER_AGENT", "campscout")

    with (
        httpx.Client(
            headers={"User-Agent": ua, "Accept": "application/geo+json"},
            timeout=15,
            follow_redirects=True,
        ) as client,
        SessionLocal() as db,
    ):
        for lat, lon in coords:
            try:
                grid_id = ingest_forecast(client, db, lat, lon)
                if grid_id is None:
                    log.warning("Skipped lat=%s lon=%s — NOAA unavailable (stale)", lat, lon)
            except Exception as exc:
                # One coordinate failing must not stop the rest.
                log.error("NOAA ingest failed lat=%s lon=%s: %s", lat, lon, exc)

            time.sleep(1)  # NOAA asks for considerate clients


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
    parser = argparse.ArgumentParser(description="Ingest NOAA forecasts for given coordinates.")
    parser.add_argument(
        "--coords",
        nargs="*",
        metavar="LAT,LON",
        help='Coordinates to fetch, e.g. "34.77,-83.93". Default: Vogel SP + DuPont SF.',
    )
    args = parser.parse_args()

    if args.coords:
        pairs = [tuple(c.split(",", 1)) for c in args.coords]
    else:
        pairs = DEFAULT_COORDS

    run(coords=pairs)
