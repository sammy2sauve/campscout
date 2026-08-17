"""
Campground list and detail endpoints.

GET /campgrounds       — filtered list with pagination
GET /campgrounds/{id}  — single campground detail
"""
import logging
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import cast, func
from sqlalchemy.dialects.postgresql import ARRAY as PgARRAY
from sqlalchemy.orm import Session
from sqlalchemy.types import String

from ...storage.models import Campground
from ..deps import get_db
from ..schemas import CampgroundDetail, CampgroundList, CampgroundSummary

log = logging.getLogger(__name__)

router = APIRouter()


@router.get("", response_model=CampgroundList)
def list_campgrounds(
    db: Annotated[Session, Depends(get_db)],
    bbox: Annotated[str | None, Query(description="min_lon,min_lat,max_lon,max_lat")] = None,
    state: Annotated[str | None, Query(max_length=2)] = None,
    has_electricity: bool | None = None,
    has_showers: bool | None = None,
    has_toilets: bool | None = None,
    has_drinking_water: bool | None = None,
    pets_allowed: bool | None = None,
    wildlife_tags: Annotated[str | None, Query(description="Comma-separated tags; campground must contain ALL")] = None,
    terrain_tags: Annotated[str | None, Query(description="Comma-separated tags; campground must contain ALL")] = None,
    limit: Annotated[int, Query(ge=1, le=200)] = 50,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> CampgroundList:
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

    # Amenity boolean filters — only applied when explicitly provided
    bool_filters = {
        "has_electricity": has_electricity,
        "has_showers": has_showers,
        "has_toilets": has_toilets,
        "has_drinking_water": has_drinking_water,
        "pets_allowed": pets_allowed,
    }
    for col_name, val in bool_filters.items():
        if val is not None:
            query = query.filter(getattr(Campground, col_name) == val)

    # Tag filters — campground must contain ALL requested tags (@> operator)
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

    total = query.count()
    items = query.offset(offset).limit(limit).all()

    return CampgroundList(
        items=[CampgroundSummary.model_validate(cg) for cg in items],
        total=total,
        limit=limit,
        offset=offset,
    )


@router.get("/{campground_id}", response_model=CampgroundDetail)
def get_campground(
    campground_id: int,
    db: Annotated[Session, Depends(get_db)],
) -> CampgroundDetail:
    cg = db.query(Campground).filter(Campground.id == campground_id).first()
    if cg is None:
        raise HTTPException(status_code=404, detail="Campground not found")
    return CampgroundDetail.model_validate(cg)
