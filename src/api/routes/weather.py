"""
Weather forecast endpoint.

GET /campgrounds/{id}/weather — upcoming forecast rows for a campground.
"""
import logging
from datetime import date, timedelta
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from ...storage.models import Campground, WeatherForecast
from ..deps import get_db
from ..schemas import WeatherRow

log = logging.getLogger(__name__)

router = APIRouter()


@router.get("/{campground_id}/weather", response_model=list[WeatherRow])
def get_weather(
    campground_id: int,
    db: Annotated[Session, Depends(get_db)],
    days: Annotated[int, Query(ge=1, le=7)] = 7,
) -> list[WeatherRow]:
    if not db.query(Campground).filter(Campground.id == campground_id).first():
        raise HTTPException(status_code=404, detail="Campground not found")

    today = date.today()
    end_date = today + timedelta(days=days)

    rows = (
        db.query(WeatherForecast)
        .filter(
            WeatherForecast.campground_id == campground_id,
            WeatherForecast.forecast_date >= today,
            WeatherForecast.forecast_date < end_date,
        )
        .order_by(WeatherForecast.forecast_date, WeatherForecast.is_daytime.desc())
        .all()
    )
    return [WeatherRow.model_validate(r) for r in rows]
