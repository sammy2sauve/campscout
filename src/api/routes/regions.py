"""
Region endpoints.

GET /regions — list all 6 regions with campground counts
"""
from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.orm import Session

from ..deps import get_db
from ..schemas import RegionSchema

router = APIRouter()


@router.get("/regions", response_model=list[RegionSchema])
def list_regions(db: Session = Depends(get_db)):
    rows = db.execute(
        text("""
            SELECT
                r.id, r.name, r.states,
                r.bbox_min_lon, r.bbox_min_lat, r.bbox_max_lon, r.bbox_max_lat,
                r.center_lat, r.center_lon, r.default_zoom,
                COUNT(c.id)::int AS campground_count
            FROM regions r
            LEFT JOIN campgrounds c ON c.region_id = r.id
            GROUP BY r.id
            ORDER BY r.name
        """)
    ).mappings().all()

    return [RegionSchema.model_validate(dict(row)) for row in rows]
