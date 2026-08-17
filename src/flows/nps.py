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

from ..ingestion.nps import (
    TARGET_STATES,
    ingest_alerts,
    ingest_campgrounds,
)
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
def nps_flow(states: list[str] = TARGET_STATES, limit: int | None = None) -> None:
    """
    Ingest NPS campgrounds and alerts for SE US.

    Mirrors the run() logic from src/ingestion/nps.py.
    Per-park alert failures are already handled inside ingest_alerts.
    """
    park_codes = fetch_campgrounds(states, limit)
    fetch_alerts(park_codes)


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
    nps_flow()
