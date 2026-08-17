"""
Availability endpoint.

GET /campgrounds/{id}/availability — availability snapshots for a campground
                                     over a date range.

Availability is stored at the campsite level (AvailabilitySnapshot.campsite_id).
This route joins through the campsites table to return a flat list for the
entire campground.
"""
import logging
from datetime import date
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from ...storage.models import AvailabilitySnapshot, Campground, Campsite
from ..deps import get_db
from ..schemas import AvailabilityRow

log = logging.getLogger(__name__)

router = APIRouter()


@router.get("/{campground_id}/availability", response_model=list[AvailabilityRow])
def get_availability(
    campground_id: int,
    db: Annotated[Session, Depends(get_db)],
    start: Annotated[date, Query(description="Start date (inclusive), ISO format YYYY-MM-DD")],
    end: Annotated[date, Query(description="End date (inclusive), ISO format YYYY-MM-DD")],
    status: Annotated[str | None, Query(description="Filter by status, e.g. 'Available'")] = None,
) -> list[AvailabilityRow]:
    if not db.query(Campground).filter(Campground.id == campground_id).first():
        raise HTTPException(status_code=404, detail="Campground not found")

    campsite_ids = [
        row[0]
        for row in db.query(Campsite.id).filter(Campsite.campground_id == campground_id).all()
    ]
    if not campsite_ids:
        return []

    query = db.query(AvailabilitySnapshot).filter(
        AvailabilitySnapshot.campsite_id.in_(campsite_ids),
        AvailabilitySnapshot.date >= start,
        AvailabilitySnapshot.date <= end,
    )
    if status:
        query = query.filter(AvailabilitySnapshot.status == status)

    rows = query.order_by(AvailabilitySnapshot.date).all()
    return [AvailabilityRow.model_validate(r) for r in rows]
