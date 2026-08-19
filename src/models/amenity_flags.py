"""
Bit-packed amenity flags for the campgrounds table.

Each flag corresponds to one bit in the amenity_flags INTEGER column.
Backend decodes flags → named dict before returning JSON; frontend is unaware
of the packing.
"""
from enum import IntFlag


class AmenityFlag(IntFlag):
    TOILETS        = 1
    SHOWERS        = 2
    DRINKING_WATER = 4
    ELECTRICITY    = 8
    PETS_ALLOWED   = 16
    ADA_ACCESSIBLE = 32
    DUMP_STATION   = 64
    RV_HOOKUPS     = 128


def flags_to_dict(flags: int) -> dict:
    """Expand an amenity_flags integer into named boolean fields."""
    f = AmenityFlag(flags)
    return {
        "has_toilets":        bool(f & AmenityFlag.TOILETS),
        "has_showers":        bool(f & AmenityFlag.SHOWERS),
        "has_drinking_water": bool(f & AmenityFlag.DRINKING_WATER),
        "has_electricity":    bool(f & AmenityFlag.ELECTRICITY),
        "pets_allowed":       bool(f & AmenityFlag.PETS_ALLOWED),
        "ada_accessible":     bool(f & AmenityFlag.ADA_ACCESSIBLE),
    }


def dict_to_flags(d: dict) -> int:
    """Collapse named boolean fields into an amenity_flags integer."""
    flags = AmenityFlag(0)
    if d.get("has_toilets"):        flags |= AmenityFlag.TOILETS
    if d.get("has_showers"):        flags |= AmenityFlag.SHOWERS
    if d.get("has_drinking_water"): flags |= AmenityFlag.DRINKING_WATER
    if d.get("has_electricity"):    flags |= AmenityFlag.ELECTRICITY
    if d.get("pets_allowed"):       flags |= AmenityFlag.PETS_ALLOWED
    if d.get("ada_accessible"):     flags |= AmenityFlag.ADA_ACCESSIBLE
    return int(flags)
