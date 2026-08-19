"""
Prefect flow wrapping NPS ingestion.

Each of the two ingest functions becomes a @task with retries.
The flow mirrors the run() logic in src/ingestion/nps.py —
it does not duplicate any business logic.

Run standalone:
    python -m src.flows.nps
"""
import logging
import os

import httpx
from dotenv import load_dotenv
from prefect import flow, task

from ..ingestion.nps import ingest_alerts, ingest_campgrounds
from ..ingestion.recreation_gov import DEFAULT_REGIONS, REGION_STATES
from ..storage.database import SessionLocal

load_dotenv()

log = logging.getLogger(__name__)


@task(name="nps-fetch-campgrounds", retries=2, retry_delay_seconds=30)
def fetch_campgrounds(states: list[str], limit: int | None) -> list[str]:
    """Fetch NPS campgrounds and return the deduplicated list of park codes."""
    api_key = os.environ["NPS_API_KEY"]
    with (
        httpx.Client(headers={"X-Api-Key": api_key}, timeout=30) as client,
        SessionLocal() as db,
    ):
        return ingest_campgrounds(client, db, states, limit)


@task(name="nps-fetch-alerts", retries=2, retry_delay_seconds=30)
def fetch_alerts(park_codes: list[str]) -> None:
    """Fetch alerts for the given park codes."""
    api_key = os.environ["NPS_API_KEY"]
    with (
        httpx.Client(headers={"X-Api-Key": api_key}, timeout=30) as client,
        SessionLocal() as db,
    ):
        ingest_alerts(client, db, park_codes)


@flow(name="nps-ingest")
def nps_flow(
    regions: list[str] = DEFAULT_REGIONS,
    states: list[str] | None = None,
    limit: int | None = None,
) -> None:
    """
    Ingest NPS campgrounds and alerts.

    Args:
        regions: region slugs to ingest (resolved to state lists)
        states: explicit state override (takes precedence over regions)
        limit: max campgrounds — useful for testing
    """
    if states is None:
        states = []
        for region in regions:
            states.extend(REGION_STATES.get(region, []))

    park_codes = fetch_campgrounds(states, limit)
    fetch_alerts(park_codes)


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
    nps_flow()
