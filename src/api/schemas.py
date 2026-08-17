"""
Pydantic response schemas for the CampScout API.

These are deliberately separate from the SQLAlchemy ORM models in
src/storage/models.py — routes never return raw ORM objects.

All schemas use model_config = ConfigDict(from_attributes=True) so they
can be constructed directly from ORM instances via .model_validate(orm_obj).
"""
from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, field_validator


class LocationSchema(BaseModel):
    lat: float
    lon: float


class CampgroundSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    rec_facility_id: str
    name: str
    state_code: str | None = None
    location: LocationSchema | None = None
    has_electricity: bool | None = None
    has_showers: bool | None = None
    has_toilets: bool | None = None
    has_drinking_water: bool | None = None
    pets_allowed: bool | None = None
    ada_accessible: bool | None = None
    wildlife_tags: list[str] | None = None
    terrain_tags: list[str] | None = None
    weather_stale: bool | None = None

    @field_validator("location", mode="before")
    @classmethod
    def parse_location(cls, v):
        """Convert a GeoAlchemy2 WKBElement to {lat, lon}."""
        if v is None:
            return None
        try:
            from geoalchemy2.shape import to_shape
            shape = to_shape(v)
            return {"lat": shape.y, "lon": shape.x}
        except Exception:
            return None


class CampgroundDetail(CampgroundSummary):
    description: str | None = None
    phone: str | None = None
    reservation_url: str | None = None
    stay_limit: str | None = None
    noaa_grid_id: str | None = None
    weather_fetched_at: datetime | None = None
    created_at: datetime | None = None
    updated_at: datetime | None = None


class CampgroundList(BaseModel):
    items: list[CampgroundSummary]
    total: int
    limit: int
    offset: int


class AvailabilityRow(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    date: date
    status: str


class WeatherRow(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    forecast_date: date
    is_daytime: bool
    temperature_f: int | None = None
    precip_pct: int | None = None
    wind_speed: str | None = None
    wind_direction: str | None = None
    short_forecast: str | None = None


class AlertRow(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    title: str
    description: str | None = None
    category: str | None = None
    published_at: datetime | None = None
