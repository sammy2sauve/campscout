"""
Availability endpoint.

GET /campgrounds/{id}/availability — grouped availability by campsite over a date range.

Returns AvailabilityResponse with per-campsite windows so the frontend can show
which specific sites are open and link directly to Recreation.gov.
"""
import logging
from collections import defaultdict
from datetime import date
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func
from sqlalchemy.orm import Session

from ...storage.models import AvailabilitySnapshot, Campground, Campsite
from ..deps import get_db
from ..schemas import AvailabilityResponse, CampsiteWindow

log = logging.getLogger(__name__)

router = APIRouter()


@router.get("/{campground_id}/availability", response_model=AvailabilityResponse)
def get_availability(
    campground_id: int,
    db: Annotated[Session, Depends(get_db)],
    start: Annotated[date, Query(description="Start date (inclusive), ISO format YYYY-MM-DD")],
    end: Annotated[date, Query(description="End date (inclusive), ISO format YYYY-MM-DD")],
) -> AvailabilityResponse:
    if not db.query(Campground).filter(Campground.id == campground_id).first():
        raise HTTPException(status_code=404, detail="Campground not found")

    campsites = db.query(Campsite).filter(Campsite.campground_id == campground_id).all()
    if not campsites:
        return AvailabilityResponse(sites=[], available_site_count=0, start=start, end=end)

    campsite_ids = [c.id for c in campsites]
    campsite_map = {c.id: c for c in campsites}

    # Latest snapshot per (campsite_id, date) — availability table is append-only
    subq = (
        db.query(
            AvailabilitySnapshot.campsite_id,
            AvailabilitySnapshot.date,
            func.max(AvailabilitySnapshot.fetched_at).label("latest"),
        )
        .filter(
            AvailabilitySnapshot.campsite_id.in_(campsite_ids),
            AvailabilitySnapshot.date >= start,
            AvailabilitySnapshot.date <= end,
        )
        .group_by(AvailabilitySnapshot.campsite_id, AvailabilitySnapshot.date)
        .subquery()
    )

    rows = (
        db.query(AvailabilitySnapshot)
        .join(
            subq,
            (AvailabilitySnapshot.campsite_id == subq.c.campsite_id)
            & (AvailabilitySnapshot.date == subq.c.date)
            & (AvailabilitySnapshot.fetched_at == subq.c.latest),
        )
        .all()
    )

    # Group snapshots by campsite_id
    by_site: dict[int, list] = defaultdict(list)
    for row in rows:
        by_site[row.campsite_id].append(row)

    windows: list[CampsiteWindow] = []
    for site_id, snapshots in by_site.items():
        campsite = campsite_map[site_id]
        avail_dates = sorted(s.date for s in snapshots if s.status == "Available")
        windows.append(
            CampsiteWindow(
                rec_campsite_id=campsite.rec_campsite_id,
                name=campsite.name,
                loop=campsite.loop,
                site_type=campsite.site_type,
                available_dates=avail_dates,
                total_dates=len(snapshots),
            )
        )

    # Sites with availability first, then alphabetically by name
    windows.sort(key=lambda w: (-len(w.available_dates), w.name or ""))

    available_site_count = sum(1 for w in windows if w.available_dates)

    return AvailabilityResponse(
        sites=windows,
        available_site_count=available_site_count,
        start=start,
        end=end,
    )
