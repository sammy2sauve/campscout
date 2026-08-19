"""
Campground list and detail endpoints.

GET /campgrounds       — filtered list with pagination
GET /campgrounds/{id}  — single campground detail
"""
import logging
from datetime import datetime, timezone
from typing import Annotated

from cachetools import TTLCache
from fastapi import APIRouter, Depends, HTTPException, Query, Response
from sqlalchemy import cast, func
from sqlalchemy.dialects.postgresql import ARRAY as PgARRAY
from sqlalchemy.orm import Session
from sqlalchemy.types import String

from ...models.amenity_flags import AmenityFlag
from ...storage.models import Campground
from ..deps import get_db
from ..schemas import CampgroundDetail, CampgroundList, CampgroundSummary

log = logging.getLogger(__name__)

router = APIRouter()

# In-process TTL caches — no Redis needed for v1 single-instance deployment
_list_cache: TTLCache = TTLCache(maxsize=512, ttl=300)   # 5 min
_detail_cache: TTLCache = TTLCache(maxsize=256, ttl=60)  # 60 s


@router.get("", response_model=CampgroundList)
def list_campgrounds(
    response: Response,
    db: Annotated[Session, Depends(get_db)],
    bbox: Annotated[str | None, Query(description="min_lon,min_lat,max_lon,max_lat")] = None,
    state: Annotated[str | None, Query(max_length=2)] = None,
    region: str | None = None,
    has_electricity: bool | None = None,
    has_showers: bool | None = None,
    has_toilets: bool | None = None,
    has_drinking_water: bool | None = None,
    pets_allowed: bool | None = None,
    wildlife_tags: Annotated[str | None, Query(description="Comma-separated tags; campground must contain ALL")] = None,
    terrain_tags: Annotated[str | None, Query(description="Comma-separated tags; campground must contain ALL")] = None,
    activity_tags: Annotated[str | None, Query(description="Comma-separated activity tags; campground must contain ALL")] = None,
    limit: Annotated[int, Query(ge=1, le=200)] = 50,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> CampgroundList:
    cache_key = (bbox, state, region, has_electricity, has_showers, has_toilets,
                 has_drinking_water, pets_allowed, wildlife_tags, terrain_tags,
                 activity_tags, limit, offset)

    cached = _list_cache.get(cache_key)
    if cached is not None:
        response.headers["Cache-Control"] = "public, max-age=300, stale-while-revalidate=60"
        response.headers["X-Cache"] = "HIT"
        return cached

    query = db.query(Campground)

    # Bounding box — matches Leaflet's map.getBounds() format
    if bbox:
        try:
            min_lon, min_lat, max_lon, max_lat = (float(p) for p in bbox.split(","))
        except ValueError:
            raise HTTPException(status_code=400, detail="bbox must be 'min_lon,min_lat,max_lon,max_lat'")
        query = query.filter(
            Campground.location.isnot(None),
            func.ST_Within(
                Campground.location,
                func.ST_MakeEnvelope(min_lon, min_lat, max_lon, max_lat, 4326),
            ),
        )

    if state:
        query = query.filter(Campground.state_code == state.upper())

    if region:
        query = query.filter(Campground.region_id == region)

    # Bitwise amenity filters — each flag tested with bitwise AND
    amenity_bit_filters = {
        AmenityFlag.ELECTRICITY:    has_electricity,
        AmenityFlag.SHOWERS:        has_showers,
        AmenityFlag.TOILETS:        has_toilets,
        AmenityFlag.DRINKING_WATER: has_drinking_water,
        AmenityFlag.PETS_ALLOWED:   pets_allowed,
    }
    for flag, val in amenity_bit_filters.items():
        if val is True:
            query = query.filter(
                Campground.amenity_flags.op("&")(int(flag)) != 0
            )
        elif val is False:
            query = query.filter(
                Campground.amenity_flags.op("&")(int(flag)) == 0
            )

    if wildlife_tags:
        tags = [t.strip() for t in wildlife_tags.split(",") if t.strip()]
        if tags:
            query = query.filter(
                Campground.wildlife_tags.op("@>")(cast(tags, PgARRAY(String)))
            )

    if terrain_tags:
        tags = [t.strip() for t in terrain_tags.split(",") if t.strip()]
        if tags:
            query = query.filter(
                Campground.terrain_tags.op("@>")(cast(tags, PgARRAY(String)))
            )

    if activity_tags:
        tags = [t.strip() for t in activity_tags.split(",") if t.strip()]
        if tags:
            query = query.filter(
                Campground.activity_tags.op("@>")(cast(tags, PgARRAY(String)))
            )

    total = query.count()
    items = query.offset(offset).limit(limit).all()

    # data_as_of: max updated_at in result set, falls back to now if no rows
    data_as_of: datetime | None = None
    if items:
        max_updated = max((cg.updated_at for cg in items if cg.updated_at), default=None)
        data_as_of = max_updated

    result = CampgroundList(
        items=[CampgroundSummary.model_validate(cg) for cg in items],
        total=total,
        limit=limit,
        offset=offset,
        data_as_of=data_as_of,
    )

    _list_cache[cache_key] = result
    response.headers["Cache-Control"] = "public, max-age=300, stale-while-revalidate=60"
    response.headers["X-Cache"] = "MISS"
    return result


@router.get("/{campground_id}", response_model=CampgroundDetail)
def get_campground(
    campground_id: int,
    response: Response,
    db: Annotated[Session, Depends(get_db)],
) -> CampgroundDetail:
    cached = _detail_cache.get(campground_id)
    if cached is not None:
        response.headers["Cache-Control"] = "public, max-age=60, stale-while-revalidate=30"
        return cached

    cg = db.query(Campground).filter(Campground.id == campground_id).first()
    if cg is None:
        raise HTTPException(status_code=404, detail="Campground not found")

    result = CampgroundDetail.model_validate(cg)
    _detail_cache[campground_id] = result
    response.headers["Cache-Control"] = "public, max-age=60, stale-while-revalidate=30"
    return result
