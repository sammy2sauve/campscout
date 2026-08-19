"""
CampScout FastAPI application.

Run locally:
    uvicorn src.api.main:app --reload

Endpoints are documented at /docs (Swagger) and /redoc.
"""
import logging

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .routes import alerts, availability, campgrounds, regions, weather

load_dotenv()

log = logging.getLogger(__name__)

app = FastAPI(
    title="CampScout API",
    version="0.1.0",
    description="Federal campsite availability, weather, and alerts for SE US.",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",  # Vite dev server
        "http://localhost:3000",  # CRA / fallback
    ],
    allow_methods=["GET"],
    allow_headers=["*"],
)


@app.get("/health", tags=["meta"])
def health():
    return {"status": "ok"}


app.include_router(regions.router, tags=["regions"])

# All campground-scoped routes share the /campgrounds prefix.
app.include_router(campgrounds.router, prefix="/campgrounds", tags=["campgrounds"])
app.include_router(availability.router, prefix="/campgrounds", tags=["availability"])
app.include_router(weather.router, prefix="/campgrounds", tags=["weather"])
app.include_router(alerts.router, prefix="/campgrounds", tags=["alerts"])
