"""
SQLAlchemy ORM models for unified model tables.

These are populated by the transform layer from the raw/staging tables.
The FastAPI layer reads from these.
"""
from datetime import datetime, timezone

from geoalchemy2 import Geometry
from sqlalchemy import (
    ARRAY,
    Boolean,
    Column,
    Date,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
)

from .database import Base


def _now() -> datetime:
    return datetime.now(timezone.utc)


class Campground(Base):
    __tablename__ = "campgrounds"

    id = Column(Integer, primary_key=True)
    rec_facility_id = Column(String, nullable=False, unique=True)
    nps_id = Column(String)  # null if no NPS record was matched

    name = Column(String, nullable=False)
    description = Column(Text)
    location = Column(Geometry("POINT", srid=4326))
    state_code = Column(String(2))
    phone = Column(String)
    reservation_url = Column(String)
    stay_limit = Column(String)

    # Amenities — from NPS structured fields where matched, else null
    has_toilets = Column(Boolean)
    has_showers = Column(Boolean)
    has_drinking_water = Column(Boolean)
    has_electricity = Column(Boolean)  # true if any campsite has electricity
    pets_allowed = Column(Boolean)
    ada_accessible = Column(Boolean)

    # NOAA weather link — bootstrapped once per campground via Points API
    noaa_grid_id = Column(String)       # "FFC/64/133"; null until first fetch
    noaa_forecast_url = Column(String)
    weather_fetched_at = Column(DateTime(timezone=True))
    weather_stale = Column(Boolean, default=False)

    # Extracted tags from description + alert text
    wildlife_tags = Column(ARRAY(String))
    terrain_tags = Column(ARRAY(String))

    created_at = Column(DateTime(timezone=True), default=_now)
    updated_at = Column(DateTime(timezone=True), default=_now, onupdate=_now)

    __table_args__ = (
        Index("ix_campgrounds_location", "location", postgresql_using="gist"),
        Index("ix_campgrounds_state", "state_code"),
    )


class Campsite(Base):
    __tablename__ = "campsites"

    id = Column(Integer, primary_key=True)
    rec_campsite_id = Column(String, nullable=False, unique=True)
    campground_id = Column(Integer, ForeignKey("campgrounds.id"), nullable=False)

    name = Column(String)
    loop = Column(String)
    site_type = Column(String)        # e.g. "STANDARD ELECTRIC"
    type_of_use = Column(String)      # "Overnight" or "Day" — Day-only sites filtered out
    max_occupants = Column(Integer)
    max_vehicle_length_ft = Column(Integer)
    is_reservable = Column(Boolean)
    ada_accessible = Column(Boolean)
    has_electricity = Column(Boolean)
    has_water_hookup = Column(Boolean)
    has_sewer_hookup = Column(Boolean)
    pets_allowed = Column(Boolean)

    created_at = Column(DateTime(timezone=True), default=_now)

    __table_args__ = (Index("ix_campsites_campground_id", "campground_id"),)


class AvailabilitySnapshot(Base):
    """
    Time-series availability — append-only.
    Retaining history enables lead-time analysis later.
    """

    __tablename__ = "availability_snapshots"

    id = Column(Integer, primary_key=True)
    campsite_id = Column(Integer, ForeignKey("campsites.id"), nullable=False)
    date = Column(Date, nullable=False)
    status = Column(String, nullable=False)  # "Available", "Reserved", "Not Reservable", etc.
    fetched_at = Column(DateTime(timezone=True), nullable=False)

    __table_args__ = (
        UniqueConstraint("campsite_id", "date", "fetched_at",
                         name="uq_availability_campsite_date_fetch"),
        Index("ix_availability_campsite_date", "campsite_id", "date"),
        Index("ix_availability_date_status", "date", "status"),
    )


class CampgroundAlert(Base):
    __tablename__ = "campground_alerts"

    id = Column(Integer, primary_key=True)
    campground_id = Column(Integer, ForeignKey("campgrounds.id"), nullable=False)
    nps_alert_id = Column(String, nullable=False)
    title = Column(String, nullable=False)
    description = Column(Text)
    category = Column(String)  # "Danger", "Caution", "Information", "Park Closure"
    affects_whole_campground = Column(Boolean, default=True)
    published_at = Column(DateTime(timezone=True))
    fetched_at = Column(DateTime(timezone=True), nullable=False, default=_now)

    __table_args__ = (
        UniqueConstraint("campground_id", "nps_alert_id", name="uq_alert_campground_nps"),
        Index("ix_alerts_campground_id", "campground_id"),
    )


class WeatherForecast(Base):
    __tablename__ = "weather_forecasts"

    id = Column(Integer, primary_key=True)
    campground_id = Column(Integer, ForeignKey("campgrounds.id"), nullable=False)
    forecast_date = Column(Date, nullable=False)
    is_daytime = Column(Boolean, nullable=False)
    temperature_f = Column(Integer)
    precip_pct = Column(Integer)
    wind_speed = Column(String)
    wind_direction = Column(String)
    short_forecast = Column(String)
    detailed_forecast = Column(Text)
    fetched_at = Column(DateTime(timezone=True), nullable=False, default=_now)

    __table_args__ = (
        # Replace-on-conflict: weather is current state, not history
        UniqueConstraint("campground_id", "forecast_date", "is_daytime",
                         name="uq_weather_campground_date_tod"),
        Index("ix_weather_campground_date", "campground_id", "forecast_date"),
    )
