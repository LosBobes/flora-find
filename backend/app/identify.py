"""Plant identification from a photo, via the Pl@ntNet API.

Some contributors know exactly what they've found; others just have a photo and
no idea what it is. This module turns a photo into a ranked list of candidate
species so the add-plant form can pre-fill itself instead of leaving the user
staring at an empty "Species" box.

The feature is **opt-in and best-effort**, mirroring ``enrichment.py``:

  * It is disabled unless ``FLORA_PLANTNET_API_KEY`` is set, so the app runs fine
    with no key (the frontend simply hides the affordance).
  * Every network failure is turned into an :class:`IdentifyError` carrying a
    friendly, user-facing message rather than a raw traceback.

Each raw candidate (a Latin binomial + confidence score) is run through
:func:`app.species_map.classify` so a recognised species arrives at the form
already mapped to FloraFind's ``category`` / ``fruit_type`` / season / ``hazard``.

Get a free key at https://my.plantnet.org/ and set ``FLORA_PLANTNET_API_KEY``.
"""

import os
from dataclasses import dataclass

import httpx

from .species_map import classify

# Pl@ntNet's "all flora" project; overridable so a deployment can point at a
# regional project (e.g. "weurope") or a mock in tests.
PLANTNET_URL = os.environ.get(
    "FLORA_PLANTNET_URL", "https://my-api.plantnet.org/v2/identify/all"
)
USER_AGENT = "FloraFind-identify/1.0 (https://github.com/Vbatocanin/flora-find)"

# Below this Pl@ntNet score a match is too speculative to surface as a suggestion.
MIN_SCORE = 0.05
MAX_SUGGESTIONS = 5


def api_key() -> str:
    return os.environ.get("FLORA_PLANTNET_API_KEY", "").strip()


def enabled() -> bool:
    """Whether photo identification is configured on this server."""
    return bool(api_key())


class IdentifyError(Exception):
    """A best-effort failure carrying a message safe to show the user."""


@dataclass(frozen=True)
class Candidate:
    """One raw match from the identification service."""

    score: float
    scientific_name: str
    common_name: str | None
    genus: str | None


def parse_results(payload: dict, *, max_results: int = MAX_SUGGESTIONS) -> list[Candidate]:
    """Pull the ranked candidates out of a Pl@ntNet ``identify`` response.

    Tolerant of missing fields: a result without a usable scientific name, or
    scoring below :data:`MIN_SCORE`, is skipped rather than raised on.
    """
    candidates: list[Candidate] = []
    for result in payload.get("results", []):
        species = result.get("species") or {}
        name = (species.get("scientificNameWithoutAuthor") or "").strip()
        if not name:
            continue
        try:
            score = float(result.get("score") or 0.0)
        except (TypeError, ValueError):
            score = 0.0
        if score < MIN_SCORE:
            continue
        common_names = species.get("commonNames") or []
        common = next((c.strip() for c in common_names if c and c.strip()), None)
        genus = ((species.get("genus") or {}).get("scientificNameWithoutAuthor") or "").strip()
        candidates.append(
            Candidate(
                score=round(score, 4),
                scientific_name=name,
                common_name=common,
                genus=genus or None,
            )
        )
        if len(candidates) >= max_results:
            break
    return candidates


def build_suggestion(candidate: Candidate, known_types: set[str]) -> dict:
    """Turn a raw :class:`Candidate` into a form-ready suggestion.

    Runs the Latin name through :func:`classify`; when that lands on a plant type
    we already carry in the vocabulary, the mapped ``category`` / ``fruit_type`` /
    season / ``hazard`` are attached so the form can fill itself in one tap.
    ``known_type`` tells the frontend whether ``fruit_type`` is safe to apply
    (an unknown type would be rejected by the create endpoint).
    """
    suggestion = {
        "scientific_name": candidate.scientific_name,
        "common_name": candidate.common_name,
        "score": candidate.score,
        "category": None,
        "fruit_type": None,
        "season_start": None,
        "season_end": None,
        "hazard": False,
        "known_type": False,
    }
    info = classify(species=candidate.scientific_name, genus=candidate.genus)
    if info is not None:
        known = info.fruit_type.strip().lower() in known_types
        suggestion.update(
            category=info.category,
            fruit_type=info.fruit_type if known else None,
            season_start=info.season_start,
            season_end=info.season_end,
            hazard=info.hazard,
            known_type=known,
        )
    return suggestion


def identify(
    image_bytes: bytes,
    content_type: str,
    filename: str,
    *,
    organs: str = "auto",
    client: httpx.Client | None = None,
) -> list[Candidate]:
    """Identify a plant photo, returning ranked candidates (best first).

    Raises :class:`IdentifyError` with a user-facing message on any failure,
    including a missing API key.
    """
    key = api_key()
    if not key:
        raise IdentifyError("Plant identification is not configured on this server.")

    owns_client = client is None
    c = client or httpx.Client(timeout=30.0, headers={"User-Agent": USER_AGENT})
    try:
        resp = c.post(
            PLANTNET_URL,
            params={"api-key": key},
            files={"images": (filename, image_bytes, content_type)},
            data={"organs": organs},
        )
    except httpx.HTTPError:
        raise IdentifyError("Could not reach the identification service. Try again later.")
    finally:
        if owns_client:
            c.close()

    if resp.status_code == 404:
        # Pl@ntNet returns 404 when nothing in its database matched the photo.
        return []
    if resp.status_code in (401, 403):
        raise IdentifyError("Plant identification is misconfigured on this server.")
    if resp.status_code == 429:
        raise IdentifyError("Identification is busy right now. Try again in a moment.")
    if resp.status_code >= 400:
        raise IdentifyError("The identification service returned an error. Try another photo.")

    try:
        payload = resp.json()
    except ValueError:
        raise IdentifyError("The identification service returned an unexpected response.")
    return parse_results(payload)
