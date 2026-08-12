"""
Entity resolution helpers for the transform layer.

- Linking NPS campgrounds to Recreation.gov facilities
- Parsing NPS amenity fields into booleans
- Normalizing Recreation.gov ATTRIBUTES key-value arrays
"""
import re

# Matches recreation.gov campground URLs like:
#   https://www.recreation.gov/camping/campgrounds/253730
_REC_URL = re.compile(r"recreation\.gov/(?:camping/campgrounds|camping/gateways)/(\d+)")


def resolve_rec_id_from_nps(nps_campground: dict) -> str | None:
    """
    Try to extract a Recreation.gov facility ID from an NPS campground record.

    Primary strategy: parse the facilty ID from reservationUrl.
    Returns the ID string (e.g. "253730") or None if not resolvable.
    """
    url = nps_campground.get("reservationUrl", "")
    if url:
        m = _REC_URL.search(url)
        if m:
            return m.group(1)
    return None


def _nps_field_bool(value) -> bool | None:
    """
    Parse a boolean from NPS amenity values.
    Lists like ["Flush Toilets - year round"] → True if non-empty.
    Strings like "Yes - year round" → True, "No" → False.
    """
    if isinstance(value, list):
        if not value:
            return False
        return not all(str(v).lower().startswith("no") for v in value)
    if isinstance(value, str):
        return value.lower().startswith("yes")
    return None


def parse_nps_amenities(nps_campground: dict) -> dict:
    """
    Extract structured amenity booleans from an NPS campground payload.
    Returns a dict with keys matching Campground model fields.
    """
    a = nps_campground.get("amenities", {})
    return {
        "has_toilets": _nps_field_bool(a.get("toilets")),
        "has_showers": _nps_field_bool(a.get("showers")),
        "has_drinking_water": _nps_field_bool(a.get("potableWater")),
    }


# Maps ATTRIBUTES AttributeName (lowercased) to Campsite boolean field names.
# Attribute names are inconsistent across facilities — use lowercase matching.
_ELEC_NAMES = {"electricity hookup", "electric hookups", "electricity"}
_WATER_NAMES = {"water hookup"}
_SEWER_NAMES = {"sewer hookup", "sewer"}
_PETS_NAMES = {"pets allowed"}


def normalize_attributes(attributes: list[dict]) -> dict:
    """
    Normalize a Recreation.gov ATTRIBUTES array into structured fields.
    Returns a dict with keys matching Campsite model fields.
    """
    attr = {a["AttributeName"].lower(): a["AttributeValue"] for a in attributes}

    # Electricity: value is amperage (e.g. "15", "20", "30", "50") or absent
    elec_val = next((attr[k] for k in _ELEC_NAMES if k in attr), "")
    has_electricity = bool(elec_val and elec_val not in ("", "None", "0", "No"))
    # Also treat it as true if the site type contains "ELECTRIC" (checked by caller)

    has_water = attr.get("water hookup", "No").lower() == "yes"
    has_sewer = any(attr.get(k, "No").lower() == "yes" for k in _SEWER_NAMES)
    pets = attr.get("pets allowed", "")
    pets_allowed = pets.lower() == "yes" if pets else None

    max_people_raw = attr.get("max num of people", "")
    max_occupants = int(max_people_raw) if max_people_raw.isdigit() else None

    return {
        "has_electricity": has_electricity,
        "has_water_hookup": has_water,
        "has_sewer_hookup": has_sewer,
        "pets_allowed": pets_allowed,
        "max_occupants": max_occupants,
    }


def max_vehicle_length(permitted_equipment: list[dict]) -> int | None:
    """Return the maximum vehicle length in feet from PERMITTEDEQUIPMENT."""
    lengths = [e["MaxLength"] for e in permitted_equipment if e.get("MaxLength", 0) > 0]
    return max(lengths) if lengths else None
