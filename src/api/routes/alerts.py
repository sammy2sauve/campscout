"""
Alerts endpoint.

GET /campgrounds/{id}/alerts — active alerts for a campground, newest first.
"""
import logging
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ...storage.models import Campground, CampgroundAlert
from ..deps import get_db
from ..schemas import AlertRow

log = logging.getLogger(__name__)

router = APIRouter()


@router.get("/{campground_id}/alerts", response_model=list[AlertRow])
def get_alerts(
    campground_id: int,
    db: Annotated[Session, Depends(get_db)],
) -> list[AlertRow]:
    if not db.query(Campground).filter(Campground.id == campground_id).first():
        raise HTTPException(status_code=404, detail="Campground not found")

    rows = (
        db.query(CampgroundAlert)
        .filter(CampgroundAlert.campground_id == campground_id)
        .order_by(CampgroundAlert.published_at.desc())
        .all()
    )
    return [AlertRow.model_validate(r) for r in rows]
