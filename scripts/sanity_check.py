"""
Phase 0 sanity check — verify all three APIs and the DB connection.
Run: python scripts/sanity_check.py
"""
import os
import sys
from dotenv import load_dotenv

load_dotenv()

errors = []

# ── Recreation.gov ──────────────────────────────────────────────────────────
print("Checking Recreation.gov...", end=" ", flush=True)
try:
    import httpx
    key = os.environ["RECREATION_GOV_API_KEY"]
    r = httpx.get(
        "https://ridb.recreation.gov/api/v1/facilities",
        params={"state": "GA", "limit": 1, "offset": 0},
        headers={"apikey": key},
        timeout=10,
    )
    r.raise_for_status()
    data = r.json()
    count = data.get("METADATA", {}).get("RESULTS", {}).get("TOTAL_COUNT", "?")
    print(f"OK ({count} facilities in GA)")
except Exception as e:
    print(f"FAIL — {e}")
    errors.append("Recreation.gov")

# ── NPS ─────────────────────────────────────────────────────────────────────
print("Checking NPS...", end=" ", flush=True)
try:
    key = os.environ["NPS_API_KEY"]
    r = httpx.get(
        "https://developer.nps.gov/api/v1/campgrounds",
        params={"stateCode": "GA", "limit": 1, "start": 0},
        headers={"X-Api-Key": key},
        timeout=10,
    )
    r.raise_for_status()
    data = r.json()
    count = data.get("total", "?")
    print(f"OK ({count} campgrounds in GA)")
except Exception as e:
    print(f"FAIL — {e}")
    errors.append("NPS")

# ── NOAA ────────────────────────────────────────────────────────────────────
print("Checking NOAA...", end=" ", flush=True)
try:
    ua = os.getenv("NOAA_USER_AGENT", "campscout")
    r = httpx.get(
        "https://api.weather.gov/points/34.05,-84.25",  # Roswell, GA
        headers={"User-Agent": ua},
        timeout=10,
    )
    r.raise_for_status()
    props = r.json().get("properties", {})
    office = props.get("gridId", "?")
    print(f"OK (grid office: {office})")
except Exception as e:
    print(f"FAIL — {e}")
    errors.append("NOAA")

# ── Database ─────────────────────────────────────────────────────────────────
print("Checking database...", end=" ", flush=True)
try:
    import sqlalchemy as sa
    url = os.environ["DATABASE_URL"]
    engine = sa.create_engine(url)
    with engine.connect() as conn:
        result = conn.execute(sa.text("SELECT postgis_full_version()"))
        version = result.scalar().split(" ")[0]
    print(f"OK ({version})")
except Exception as e:
    print(f"FAIL — {e}")
    errors.append("Database")

# ── Summary ──────────────────────────────────────────────────────────────────
print()
if errors:
    print(f"FAILED: {', '.join(errors)}")
    sys.exit(1)
else:
    print("All checks passed — Phase 0 complete.")
