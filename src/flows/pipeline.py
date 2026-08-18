"""
Top-level Prefect orchestrator for CampScout.

Daily schedule: 5 AM UTC.

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
from prefect import flow, get_run_logger

from .noaa import noaa_flow
from .nps import nps_flow
from .rec_gov import rec_gov_flow
from .transform import transform_flow

load_dotenv()

log = logging.getLogger(__name__)


@flow(name="campscout-daily")
def pipeline() -> None:
    """
    Full CampScout daily pipeline:
      1. Ingest from Recreation.gov, NPS, and NOAA in sequence.
      2. Run the 8-step transform regardless of partial ingest failures.

    Each ingest flow is called with return_state=True so its failure is
    captured as a Prefect State rather than a raised exception, allowing
    the pipeline to continue and always reach the transform step.
    """
    logger = get_run_logger()

    # --- Ingest phase ---
    # return_state=True means a failing subflow returns a Failed State instead
    # of raising, so we can log and continue.
    rec_state = rec_gov_flow(return_state=True)
    nps_state = nps_flow(return_state=True)
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


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")

    parser = argparse.ArgumentParser(description="Run or serve the CampScout daily pipeline.")
    parser.add_argument(
        "--serve",
        action="store_true",
        help="Register with the Prefect server and run on a 5 AM UTC daily schedule.",
    )
    args = parser.parse_args()

    if args.serve:
        # Blocks; the Prefect server manages scheduling from here.
        pipeline.serve(name="campscout-daily", cron="0 5 * * *", timezone="UTC")
    else:
        pipeline()
