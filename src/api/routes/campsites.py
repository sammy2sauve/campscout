"""
Campsites endpoint.

GET /campgrounds/{id}/campsites — individual site attributes for a campground.
"""
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException

from ...storage.models import Campground, Campsite
from ..deps import get_db
from ..schemas import CampsiteDetail

router = APIRouter()


@router.get("/{campground_id}/campsites", response_model=list[CampsiteDetail])
def get_campsites(
    campground_id: int,
    db: Annotated[object, Depends(get_db)],
) -> list[CampsiteDetail]:
    if not db.query(Campground).filter(Campground.id == campground_id).first():
        raise HTTPException(status_code=404, detail="Campground not found")

    sites = (
        db.query(Campsite)
        .filter(Campsite.campground_id == campground_id)
        .order_by(Campsite.name)
        .all()
    )
    return [CampsiteDetail.model_validate(s) for s in sites]
