"""
Prefect flow wrapping the 8-step transform pipeline.

Each step in src/transform/run.py becomes a @task.
Steps must run in order — later steps depend on data committed by earlier ones.
Each task opens its own DB session; committed data is visible to the next task.

Run standalone:
    python -m src.flows.transform
"""
import logging

from dotenv import load_dotenv
from prefect import flow, task

from ..storage.database import SessionLocal
from ..transform.run import (
    ALL_STEPS,
    transform_alerts,
    transform_availability,
    transform_campgrounds,
    transform_campsites,
    transform_nps_link,
    transform_noaa_bootstrap,
    transform_tags,
    transform_weather,
)

load_dotenv()

log = logging.getLogger(__name__)


@task(name="transform-campgrounds", retries=2, retry_delay_seconds=30)
def step_campgrounds() -> None:
    """Populate campgrounds from raw_rec_facilities."""
    with SessionLocal() as db:
        transform_campgrounds(db)


@task(name="transform-nps-link", retries=2, retry_delay_seconds=30)
def step_nps_link() -> None:
    """Enrich campgrounds with NPS data where a match can be resolved."""
    with SessionLocal() as db:
        transform_nps_link(db)


@task(name="transform-noaa-bootstrap", retries=2, retry_delay_seconds=30)
def step_noaa_bootstrap() -> None:
    """Resolve NOAA grid IDs for campgrounds that don't have one yet."""
    with SessionLocal() as db:
        transform_noaa_bootstrap(db)


@task(name="transform-campsites", retries=2, retry_delay_seconds=30)
def step_campsites() -> None:
    """Populate campsites from raw_rec_campsites."""
    with SessionLocal() as db:
        transform_campsites(db)


@task(name="transform-availability", retries=2, retry_delay_seconds=30)
def step_availability() -> None:
    """Populate availability_snapshots from raw_rec_availability."""
    with SessionLocal() as db:
        transform_availability(db)


@task(name="transform-alerts", retries=2, retry_delay_seconds=30)
def step_alerts() -> None:
    """Populate campground_alerts from raw_nps_alerts."""
    with SessionLocal() as db:
        transform_alerts(db)


@task(name="transform-weather", retries=2, retry_delay_seconds=30)
def step_weather() -> None:
    """Populate weather_forecasts from raw_noaa_forecasts."""
    with SessionLocal() as db:
        transform_weather(db)


@task(name="transform-tags", retries=2, retry_delay_seconds=30)
def step_tags() -> None:
    """Extract wildlife and terrain tags from campground text fields."""
    with SessionLocal() as db:
        transform_tags(db)


_STEP_TASKS = {
    "campgrounds": step_campgrounds,
    "nps_link": step_nps_link,
    "noaa_bootstrap": step_noaa_bootstrap,
    "campsites": step_campsites,
    "availability": step_availability,
    "alerts": step_alerts,
    "weather": step_weather,
    "tags": step_tags,
}


@flow(name="transform")
def transform_flow(steps: list[str] = ALL_STEPS) -> None:
    """
    Run the transform pipeline.

    Steps execute in the order provided (default: all 8 in dependency order).
    Each step is a separate Prefect task so failures are individually tracked.
    """
    for step in steps:
        log.info("=== Step: %s ===", step)
        _STEP_TASKS[step]()
    log.info("Transform complete")


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
    transform_flow()
