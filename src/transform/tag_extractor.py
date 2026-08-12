"""
Keyword-based wildlife and terrain tag extraction.

Keyword lists live in keywords.json — add/edit tags there, not here.
"""
import json
import re
from pathlib import Path

_KEYWORDS_PATH = Path(__file__).parent / "keywords.json"

with _KEYWORDS_PATH.open() as f:
    _KEYWORDS: dict[str, list[str]] = json.load(f)

# Pre-compile patterns sorted longest-first so "black bear" matches before "bear"
_PATTERNS: dict[str, list[tuple[re.Pattern, str]]] = {}
for category, words in _KEYWORDS.items():
    sorted_words = sorted(words, key=len, reverse=True)
    _PATTERNS[category] = [
        (re.compile(r"\b" + re.escape(w) + r"\b", re.IGNORECASE), w)
        for w in sorted_words
    ]

_HTML_TAG = re.compile(r"<[^>]+>")
_WHITESPACE = re.compile(r"\s+")


def strip_html(text: str) -> str:
    text = _HTML_TAG.sub(" ", text)
    return _WHITESPACE.sub(" ", text).strip()


def extract_tags(text: str) -> tuple[list[str], list[str]]:
    """
    Return (wildlife_tags, terrain_tags) matched in text.
    Tags are the canonical keyword strings from keywords.json.
    """
    clean = strip_html(text)
    wildlife: list[str] = []
    terrain: list[str] = []

    for pattern, keyword in _PATTERNS["wildlife"]:
        if pattern.search(clean):
            wildlife.append(keyword)

    for pattern, keyword in _PATTERNS["terrain"]:
        if pattern.search(clean):
            terrain.append(keyword)

    return wildlife, terrain
