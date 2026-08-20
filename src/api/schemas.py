"""
Pydantic response schemas for the CampScout API.

These are deliberately separate from the SQLAlchemy ORM models in
src/storage/models.py — routes never return raw ORM objects.

All schemas use model_config = ConfigDict(from_attributes=True) so they
can be constructed directly from ORM instances via .model_validate(orm_obj).
"""
import re
from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, field_validator, model_validator

from ..models.amenity_flags import flags_to_dict


def _strip_html(text: str) -> str:
    """Remove HTML tags from a string."""
    return re.sub(r"<[^>]+>", " ", text).strip()


class LocationSchema(BaseModel):
    lat: float
    lon: float


class RegionSchema(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    states: list[str]
    center_lat: float
    center_lon: float
    default_zoom: int
    bbox: dict  # {min_lon, min_lat, max_lon, max_lat}
    campground_count: int

    @model_validator(mode="before")
    @classmethod
    def build_bbox(cls, data):
        """Accept a raw dict (e.g. from DB row) and synthesise the bbox sub-dict."""
        if isinstance(data, dict):
            if "bbox" not in data:
                data = dict(data)
                data["bbox"] = {
                    "min_lon": data.get("bbox_min_lon"),
                    "min_lat": data.get("bbox_min_lat"),
                    "max_lon": data.get("bbox_max_lon"),
                    "max_lat": data.get("bbox_max_lat"),
                }
        return data


class CampgroundSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    rec_facility_id: str
    name: str
    state_code: str | None = None
    region_id: str | None = None
    location: LocationSchema | None = None
    amenity_flags: int = 0

    # Decoded amenity fields — populated by model_validator below
    has_electricity: bool = False
    has_showers: bool = False
    has_toilets: bool = False
    has_drinking_water: bool = False
    pets_allowed: bool = False
    ada_accessible: bool = False

    wildlife_tags: list[str] | None = None
    terrain_tags: list[str] | None = None
    activity_tags: list[str] | None = None
    weather_stale: bool | None = None
    photo_urls: list[str] | None = None

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

    @model_validator(mode="after")
    def expand_amenity_flags(self):
        """Decode amenity_flags integer into named boolean fields."""
        decoded = flags_to_dict(self.amenity_flags)
        self.has_toilets = decoded["has_toilets"]
        self.has_showers = decoded["has_showers"]
        self.has_drinking_water = decoded["has_drinking_water"]
        self.has_electricity = decoded["has_electricity"]
        self.pets_allowed = decoded["pets_allowed"]
        self.ada_accessible = decoded["ada_accessible"]
        return self


class CampgroundDetail(CampgroundSummary):
    description: str | None = None
    photo_urls: list[str] | None = None
    phone: str | None = None
    reservation_url: str | None = None
    stay_limit: str | None = None
    noaa_grid_id: str | None = None
    weather_fetched_at: datetime | None = None
    created_at: datetime | None = None
    updated_at: datetime | None = None

    @field_validator("description", mode="before")
    @classmethod
    def sanitize_description(cls, v):
        """Strip residual HTML from descriptions in case old rows weren't re-transformed."""
        if v is None:
            return None
        return _strip_html(str(v))


class CampgroundList(BaseModel):
    items: list[CampgroundSummary]
    total: int
    limit: int
    offset: int
    data_as_of: datetime | None = None


class AvailabilityRow(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    date: date
    status: str


class CampsiteWindow(BaseModel):
    """Availability summary for one campsite over the requested window."""
    rec_campsite_id: str
    name: str | None = None
    loop: str | None = None
    site_type: str | None = None
    reserve_type: str | None = None   # "site_specific", "first_come", "lottery", "pass"
    available_dates: list[date] = []
    total_dates: int = 0


class AvailabilityResponse(BaseModel):
    sites: list[CampsiteWindow]
    available_site_count: int
    fcfs_only: bool = False   # True when all campsites are first-come-first-serve
    no_data: bool = False     # True when campground has no campsite records (not ingested / walk-in only)
    syncing: bool = False     # True when campsites exist but availability hasn't been fetched yet
    start: date
    end: date


class CampsiteDetail(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    rec_campsite_id: str
    name: str | None = None
    loop: str | None = None
    site_type: str | None = None
    type_of_use: str | None = None
    reserve_type: str | None = None
    is_reservable: bool = False
    ada_accessible: bool = False
    has_electricity: bool = False
    has_water_hookup: bool = False
    has_sewer_hookup: bool = False
    pets_allowed: bool | None = None
    max_occupants: int | None = None
    max_vehicle_length_ft: int | None = None


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
