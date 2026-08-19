"""
NPS ingestion — campground metadata and alerts.

Writes raw API responses to raw_nps_campgrounds and raw_nps_alerts
staging tables.

Run standalone:
    python -m src.ingestion.nps
    python -m src.ingestion.nps --regions southeast --limit 5
    python -m src.ingestion.nps --states GA NC --limit 5
"""
import argparse
import logging
import os
import time

import httpx
from dotenv import load_dotenv

from ..storage.database import SessionLocal
from ..storage.raw_models import RawNpsAlerts, RawNpsCampground
from .recreation_gov import REGION_STATES, DEFAULT_REGIONS

load_dotenv()

log = logging.getLogger(__name__)

BASE_URL = "https://developer.nps.gov/api/v1"
PAGE_SIZE = 50


def _get(client: httpx.Client, url: str, **kwargs) -> dict:
    """GET with exponential backoff on 429."""
    wait = 2
    for attempt in range(5):
        resp = client.get(url, **kwargs)
        if resp.status_code == 429:
            log.warning("Rate limited (attempt %d), backing off %ds", attempt + 1, wait)
            time.sleep(wait)
            wait *= 2
            continue
        resp.raise_for_status()
        return resp.json()
    raise RuntimeError(f"Still rate-limited after 5 attempts: {url}")


def ingest_campgrounds(client: httpx.Client, db, states: list[str], limit: int | None) -> list[str]:
    """
    Fetch NPS campgrounds for the given states.
    Writes each campground to raw_nps_campgrounds.
    Returns deduplicated list of park codes seen (used to fetch alerts).
    """
    park_codes: set[str] = set()
    count = 0

    for state in states:
        log.info("Fetching NPS campgrounds state=%s", state)
        start = 0

        while True:
            data = _get(
                client,
                f"{BASE_URL}/campgrounds",
                params={"stateCode": state, "limit": PAGE_SIZE, "start": start},
            )
            records = data.get("data", [])
            if not records:
                break

            for rec in records:
                db.add(RawNpsCampground(nps_id=rec["id"], payload=rec))
                park_codes.add(rec["parkCode"])
                count += 1
                if limit and count >= limit:
                    db.commit()
                    log.info("Reached limit=%d, stopping campground fetch", limit)
                    return list(park_codes)

            db.commit()

            total = int(data.get("total", 0))
            start += PAGE_SIZE
            if start >= total:
                break
            time.sleep(0.5)

    log.info("Ingested %d NPS campgrounds across %d parks", count, len(park_codes))
    return list(park_codes)


def ingest_alerts(client: httpx.Client, db, park_codes: list[str]) -> None:
    """
    Fetch alerts for each park code.
    Writes one row to raw_nps_alerts per park (payload = list of alert objects).

    NPS alerts are freeform prose — the transform layer parses them,
    not this function.
    """
    for code in park_codes:
        log.info("Fetching alerts parkCode=%s", code)
        try:
            data = _get(
                client,
                f"{BASE_URL}/alerts",
                params={"parkCode": code, "limit": 100, "start": 0},
            )
            alerts = data.get("data", [])
            db.add(RawNpsAlerts(park_code=code, payload=alerts))
            db.commit()
            log.info("Stored %d alerts parkCode=%s", len(alerts), code)
        except Exception as exc:
            # A single park failing should not stop the rest.
            log.error("Alert fetch failed parkCode=%s: %s", code, exc)

        time.sleep(0.3)


def run(
    regions: list[str] = DEFAULT_REGIONS,
    states: list[str] | None = None,
    limit: int | None = None,
) -> None:
    """
    Run NPS ingestion for the specified regions (or explicit states).

    Args:
        regions: list of region slugs
        states: explicit state list — overrides regions if provided
        limit: max campgrounds to ingest (for testing)
    """
    api_key = os.environ["NPS_API_KEY"]

    if states is None:
        states = []
        for region in regions:
            states.extend(REGION_STATES.get(region, []))

    with (
        httpx.Client(headers={"X-Api-Key": api_key}, timeout=30) as client,
        SessionLocal() as db,
    ):
        park_codes = ingest_campgrounds(client, db, states, limit)
        ingest_alerts(client, db, park_codes)


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
    parser = argparse.ArgumentParser(description="Ingest NPS campgrounds and alerts.")
    parser.add_argument("--regions", nargs="+", default=DEFAULT_REGIONS, metavar="REGION",
                        help=f"Region slugs to ingest (default: {DEFAULT_REGIONS}). "
                             f"Choices: {list(REGION_STATES.keys())}")
    parser.add_argument("--states", nargs="+", default=None, metavar="STATE",
                        help="Explicit state codes — overrides --regions")
    parser.add_argument("--limit", type=int, default=None,
                        help="Max campgrounds to fetch — useful for testing")
    args = parser.parse_args()
    run(regions=args.regions, states=args.states, limit=args.limit)
