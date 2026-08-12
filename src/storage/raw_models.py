"""
SQLAlchemy ORM models for raw/staging tables.

Each table stores API responses close to as-received so reprocessing
after a bug fix doesn't require re-hitting rate-limited APIs.
"""
from datetime import datetime, timezone

from sqlalchemy import Column, Date, DateTime, Index, Integer, String
from sqlalchemy.dialects.postgresql import JSONB

from .database import Base


def _now() -> datetime:
    return datetime.now(timezone.utc)


class RawRecFacility(Base):
    """One row per Recreation.gov facility fetch (full=true response)."""

    __tablename__ = "raw_rec_facilities"

    id = Column(Integer, primary_key=True)
    facility_id = Column(String, nullable=False)
    fetched_at = Column(DateTime(timezone=True), nullable=False, default=_now)
    payload = Column(JSONB, nullable=False)

    __table_args__ = (Index("ix_raw_rec_facilities_fid", "facility_id"),)


class RawRecCampsite(Base):
    """One row per facility's complete campsites payload."""

    __tablename__ = "raw_rec_campsites"

    id = Column(Integer, primary_key=True)
    facility_id = Column(String, nullable=False)
    fetched_at = Column(DateTime(timezone=True), nullable=False, default=_now)
    payload = Column(JSONB, nullable=False)  # list of campsite objects

    __table_args__ = (Index("ix_raw_rec_campsites_fid", "facility_id"),)


class RawRecAvailability(Base):
    """One row per (facility, month) availability fetch.

    Note: sourced from the unofficial recreation.gov availability endpoint,
    not the RIDB API — see docs/data_model.md.
    """

    __tablename__ = "raw_rec_availability"

    id = Column(Integer, primary_key=True)
    facility_id = Column(String, nullable=False)
    month = Column(Date, nullable=False)  # first day of the month queried
    fetched_at = Column(DateTime(timezone=True), nullable=False, default=_now)
    payload = Column(JSONB, nullable=False)

    __table_args__ = (
        Index("ix_raw_rec_availability_fid_month", "facility_id", "month"),
    )


class RawNpsCampground(Base):
    """One row per NPS campground fetch."""

    __tablename__ = "raw_nps_campgrounds"

    id = Column(Integer, primary_key=True)
    nps_id = Column(String, nullable=False)
    fetched_at = Column(DateTime(timezone=True), nullable=False, default=_now)
    payload = Column(JSONB, nullable=False)

    __table_args__ = (Index("ix_raw_nps_campgrounds_nps_id", "nps_id"),)


class RawNpsAlerts(Base):
    """One row per (park_code, fetch) — stores the full alerts array."""

    __tablename__ = "raw_nps_alerts"

    id = Column(Integer, primary_key=True)
    park_code = Column(String, nullable=False)
    fetched_at = Column(DateTime(timezone=True), nullable=False, default=_now)
    payload = Column(JSONB, nullable=False)  # list of alert objects

    __table_args__ = (Index("ix_raw_nps_alerts_park_code", "park_code"),)


class RawNoaaForecast(Base):
    """One row per grid point forecast fetch."""

    __tablename__ = "raw_noaa_forecasts"

    id = Column(Integer, primary_key=True)
    grid_id = Column(String, nullable=False)  # "FFC/64/133"
    fetched_at = Column(DateTime(timezone=True), nullable=False, default=_now)
    payload = Column(JSONB, nullable=False)  # forecast properties object

    __table_args__ = (Index("ix_raw_noaa_forecasts_grid_id", "grid_id"),)
