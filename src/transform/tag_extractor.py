"""
Keyword-based wildlife, landscape, and activity tag extraction.

Keyword lists live in keywords.json — add/edit tags there, not here.

activities in keywords.json is a grouped dict:
  { "canonical_id": ["keyword1", "keyword2", ...], ... }
This ensures each activity appears at most once in the output, using the
canonical ID as the stored value (e.g. "swimming" not "swim").
"""
import json
import re
from pathlib import Path

_KEYWORDS_PATH = Path(__file__).parent / "keywords.json"

with _KEYWORDS_PATH.open() as f:
    _raw: dict = json.load(f)

# ── Wildlife + landscape: flat lists ──────────────────────────────────────
# Pre-compile patterns sorted longest-first so "black bear" matches before "bear"
_FLAT_PATTERNS: dict[str, list[tuple[re.Pattern, str]]] = {}
for category in ("wildlife", "landscape"):
    words = _raw.get(category, [])
    sorted_words = sorted(words, key=len, reverse=True)
    _FLAT_PATTERNS[category] = [
        (re.compile(r"\b" + re.escape(w) + r"\b", re.IGNORECASE), w)
        for w in sorted_words
    ]

# ── Activities: grouped dict → (pattern, canonical_id) pairs per group ────
# Each group fires at most once; result is the canonical group ID.
_ACTIVITY_GROUPS: list[tuple[str, list[re.Pattern]]] = []
for group_id, keywords in _raw.get("activities", {}).items():
    sorted_kws = sorted(keywords, key=len, reverse=True)
    patterns = [re.compile(r"\b" + re.escape(w) + r"\b", re.IGNORECASE) for w in sorted_kws]
    _ACTIVITY_GROUPS.append((group_id, patterns))

_HTML_TAG = re.compile(r"<[^>]+>")
_WHITESPACE = re.compile(r"\s+")


def strip_html(text: str) -> str:
    text = _HTML_TAG.sub(" ", text)
    return _WHITESPACE.sub(" ", text).strip()


def extract_tags(text: str) -> tuple[list[str], list[str], list[str]]:
    """
    Return (wildlife_tags, landscape_tags, activity_tags) matched in text.

    Wildlife + landscape tags are the raw keyword strings.
    Activity tags are canonical group IDs (e.g. "swimming", never "swim").
    Each activity group appears at most once in the result.
    """
    clean = strip_html(text)
    wildlife: list[str] = []
    landscape: list[str] = []
    activities: list[str] = []

    for pattern, keyword in _FLAT_PATTERNS.get("wildlife", []):
        if pattern.search(clean):
            wildlife.append(keyword)

    for pattern, keyword in _FLAT_PATTERNS.get("landscape", []):
        if pattern.search(clean):
            landscape.append(keyword)

    for group_id, patterns in _ACTIVITY_GROUPS:
        for pattern in patterns:
            if pattern.search(clean):
                activities.append(group_id)
                break  # only add each group once

    return wildlife, landscape, activities
