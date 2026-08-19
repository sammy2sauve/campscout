"""
Top-level Prefect orchestrator for CampScout.

Two schedules:
  - metadata (weekly, Sunday 3 AM UTC): all 6 regions
  - availability (daily, 5 AM UTC): SE only

Ingest flows run first (rec-gov, nps, noaa). Each is submitted with
return_state=True so that a single source failing does not abort the run —
failures are logged and the transform always runs after all three finish.

Run / serve standalone:
    python -m src.flows.pipeline          # one-off run
    python -m src.flows.pipeline --serve  # register with Prefect server + schedule
"""
import argparse
import logging
import os

from dotenv import load_dotenv
from prefect import flow, get_run_logger, task

from .noaa import noaa_flow
from .nps import nps_flow
from .rec_gov import rec_gov_flow
from .transform import transform_flow

load_dotenv()

log = logging.getLogger(__name__)

ALL_REGIONS = ["southeast", "northeast", "great_lakes", "plains", "mountain", "pacific_west"]
DEFAULT_AVAILABILITY_REGIONS = ["southeast"]


@task(name="prune-past-availability")
def prune_past_availability() -> None:
    """Delete availability_snapshots rows with date < today."""
    import sqlalchemy
    from ..storage.database import SessionLocal
    with SessionLocal() as db:
        n = db.execute(
            sqlalchemy.text("DELETE FROM availability_snapshots WHERE date < CURRENT_DATE")
        ).rowcount
        db.commit()
    log.info("Pruned %d past availability rows", n)


@task(name="prune-past-weather")
def prune_past_weather() -> None:
    """Delete weather_forecasts rows with forecast_date < today."""
    import sqlalchemy
    from ..storage.database import SessionLocal
    with SessionLocal() as db:
        n = db.execute(
            sqlalchemy.text("DELETE FROM weather_forecasts WHERE forecast_date < CURRENT_DATE")
        ).rowcount
        db.commit()
    log.info("Pruned %d past weather rows", n)


@flow(name="campscout-daily")
def pipeline(
    regions: list[str] = DEFAULT_AVAILABILITY_REGIONS,
    availability_regions: list[str] = DEFAULT_AVAILABILITY_REGIONS,
) -> None:
    """
    Full CampScout pipeline:
      1. Ingest from Recreation.gov, NPS, and NOAA for the specified regions.
      2. Run the transform pipeline regardless of partial ingest failures.
      3. Prune past-date availability and weather rows.
      4. Refresh materialized view.

    Default schedule: SE metadata + SE availability (daily).
    For weekly national metadata sync, call with regions=ALL_REGIONS.
    """
    logger = get_run_logger()

    # --- Ingest phase ---
    # return_state=True means a failing subflow returns a Failed State instead
    # of raising, so we can log and continue.
    rec_state = rec_gov_flow(regions=regions, return_state=True)
    nps_state = nps_flow(regions=regions, return_state=True)
    noaa_state = noaa_flow(return_state=True)

    ingest_results = [
        ("rec-gov", rec_state),
        ("nps", nps_state),
        ("noaa", noaa_state),
    ]
    for name, state in ingest_results:
        if state.is_failed():
            logger.warning(
                "Ingest flow '%s' failed — transform will still run with whatever data is available",
                name,
            )
        else:
            logger.info("Ingest flow '%s' completed successfully", name)

    # --- Transform phase --- always runs, even if some ingest flows failed
    transform_flow()

    # --- Prune stale data ---
    prune_past_availability()
    prune_past_weather()

    # --- Refresh materialized view --- zero-downtime concurrent refresh
    try:
        import sqlalchemy
        from ..storage.database import SessionLocal
        with SessionLocal() as db:
            db.execute(sqlalchemy.text(
                "REFRESH MATERIALIZED VIEW CONCURRENTLY campground_summary_mv"
            ))
            db.commit()
        logger.info("Materialized view refreshed")
    except Exception as exc:
        logger.warning("MV refresh failed (non-fatal): %s", exc)

    logger.info("Pipeline complete")


@flow(name="campscout-national-metadata")
def national_metadata_pipeline() -> None:
    """
    Weekly national metadata sync — runs for all 6 regions.
    Availability is NOT synced here (daily SE-only pipeline does that).
    """
    logger = get_run_logger()

    rec_state = rec_gov_flow(regions=ALL_REGIONS, return_state=True)
    nps_state = nps_flow(regions=ALL_REGIONS, return_state=True)
    noaa_state = noaa_flow(return_state=True)

    for name, state in [("rec-gov", rec_state), ("nps", nps_state), ("noaa", noaa_state)]:
        if state.is_failed():
            logger.warning("National metadata ingest '%s' failed", name)
        else:
            logger.info("National metadata ingest '%s' completed", name)

    transform_flow()
    logger.info("National metadata pipeline complete")


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")

    parser = argparse.ArgumentParser(description="Run or serve the CampScout pipeline.")
    parser.add_argument(
        "--serve",
        action="store_true",
        help="Register with the Prefect server and run on schedule.",
    )
    parser.add_argument(
        "--national",
        action="store_true",
        help="Run the national metadata pipeline (all 6 regions) instead of the daily SE pipeline.",
    )
    args = parser.parse_args()

    if args.serve:
        # Register both schedules with Prefect server
        pipeline.serve(name="campscout-daily", cron="0 5 * * *", timezone="UTC")
    elif args.national:
        national_metadata_pipeline()
    else:
        pipeline()
