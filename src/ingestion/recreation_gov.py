"""
Recreation.gov ingestion — facilities (campgrounds) and campsites for SE US.

Writes raw API responses to raw_rec_facilities, raw_rec_campsites, and
raw_rec_availability staging tables.

Run standalone:
    python -m src.ingestion.recreation_gov
    python -m src.ingestion.recreation_gov --states GA NC --limit 5
"""
import argparse
import logging
import os
import time
from datetime import date

import httpx
from dotenv import load_dotenv

from ..storage.database import SessionLocal
from ..storage.raw_models import RawRecAvailability, RawRecCampsite, RawRecFacility

load_dotenv()

log = logging.getLogger(__name__)

RIDB_URL = "https://ridb.recreation.gov/api/v1"
AVAIL_URL = "https://www.recreation.gov/api/camps/availability/campground"

# SE US states within ~4hr of Atlanta. Intentionally not hardcoded into the
# data model — just the initial ingestion boundary. See PROBLEM_STATEMENT.md.
TARGET_STATES = ["GA", "NC", "SC", "TN", "AL"]

PAGE_SIZE = 50
MONTHS_AHEAD = 3  # how many months of availability to fetch per run


def _month_start(year: int, month: int) -> date:
    """Return date(year, month, 1) with month overflow handling."""
    year += (month - 1) // 12
    month = (month - 1) % 12 + 1
    return date(year, month, 1)


def _get(client: httpx.Client, url: str, **kwargs) -> dict:
    """GET with exponential backoff on 429 rate-limit responses."""
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


def ingest_facilities(client: httpx.Client, db, states: list[str], limit: int | None) -> list[str]:
    """
    Fetch all campground facilities for the given states.
    Writes each facility to raw_rec_facilities.
    Returns list of facility IDs ingested.
    """
    facility_ids: list[str] = []

    for state in states:
        log.info("Fetching facilities state=%s", state)
        offset = 0

        while True:
            data = _get(
                client,
                f"{RIDB_URL}/facilities",
                params={
                    "state": state,
                    "activity": "9",  # CAMPING activity ID in RIDB
                    "limit": PAGE_SIZE,
                    "offset": offset,
                    "full": "true",
                },
            )
            records = data.get("RECDATA", [])
            if not records:
                break

            for rec in records:
                db.add(RawRecFacility(facility_id=rec["FacilityID"], payload=rec))
                facility_ids.append(rec["FacilityID"])
                if limit and len(facility_ids) >= limit:
                    db.commit()
                    log.info("Reached limit=%d, stopping facility fetch", limit)
                    return facility_ids

            db.commit()

            total = int(data.get("METADATA", {}).get("RESULTS", {}).get("TOTAL_COUNT", 0))
            offset += PAGE_SIZE
            if offset >= total:
                break

            time.sleep(0.5)  # polite paging delay

    return facility_ids


def ingest_campsites(client: httpx.Client, db, facility_id: str) -> None:
    """
    Fetch all campsites for a facility.
    Writes one row to raw_rec_campsites with the full list as payload.
    """
    log.info("Fetching campsites facility=%s", facility_id)
    offset = 0
    all_sites: list[dict] = []

    while True:
        data = _get(
            client,
            f"{RIDB_URL}/facilities/{facility_id}/campsites",
            params={"limit": PAGE_SIZE, "offset": offset},
        )
        records = data.get("RECDATA", [])
        if not records:
            break
        all_sites.extend(records)

        total = int(data.get("METADATA", {}).get("RESULTS", {}).get("TOTAL_COUNT", 0))
        offset += PAGE_SIZE
        if offset >= total:
            break
        time.sleep(0.3)

    if all_sites:
        db.add(RawRecCampsite(facility_id=facility_id, payload=all_sites))
        db.commit()
        log.info("Stored %d campsites facility=%s", len(all_sites), facility_id)
    else:
        log.info("No campsites found facility=%s", facility_id)


def ingest_availability(client: httpx.Client, db, facility_id: str, months_ahead: int = MONTHS_AHEAD) -> None:
    """
    Fetch availability for the next N months.
    Writes one row to raw_rec_availability per month.

    Uses the unofficial recreation.gov availability endpoint (not RIDB).
    """
    today = date.today()
    base = _month_start(today.year, today.month)

    for i in range(months_ahead):
        month = _month_start(base.year, base.month + i)
        start_str = f"{month.strftime('%Y-%m-01')}T00:00:00.000Z"
        log.info("Fetching availability facility=%s month=%s", facility_id, month)

        try:
            data = _get(
                client,
                f"{AVAIL_URL}/{facility_id}/month",
                params={"start_date": start_str},
            )
            db.add(RawRecAvailability(
                facility_id=facility_id,
                month=month,
                payload=data,
            ))
            db.commit()
        except httpx.HTTPStatusError as exc:
            # 404 = facility has no availability (day-use only, etc.) — skip quietly
            if exc.response.status_code == 404:
                log.info("No availability for facility=%s (404)", facility_id)
                return
            log.warning("Availability fetch failed facility=%s month=%s: %s", facility_id, month, exc)

        time.sleep(0.5)


def run(states: list[str] = TARGET_STATES, limit: int | None = None) -> None:
    api_key = os.environ["RECREATION_GOV_API_KEY"]

    with (
        httpx.Client(headers={"apikey": api_key}, timeout=30) as client,
        SessionLocal() as db,
    ):
        facility_ids = ingest_facilities(client, db, states, limit)
        log.info("Ingested %d facilities", len(facility_ids))

        for fid in facility_ids:
            try:
                ingest_campsites(client, db, fid)
            except Exception as exc:
                log.error("Campsite ingest failed facility=%s: %s", fid, exc)

            try:
                ingest_availability(client, db, fid)
            except Exception as exc:
                log.error("Availability ingest failed facility=%s: %s", fid, exc)


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
    parser = argparse.ArgumentParser(description="Ingest Recreation.gov facilities for SE US.")
    parser.add_argument("--states", nargs="+", default=TARGET_STATES, metavar="STATE",
                        help="State codes to ingest (default: GA NC SC TN AL)")
    parser.add_argument("--limit", type=int, default=None,
                        help="Max facilities to fetch — useful for testing")
    args = parser.parse_args()
    run(states=args.states, limit=args.limit)
