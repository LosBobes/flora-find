import os
import sys
import tempfile

os.environ.setdefault("FLORA_DATABASE_URL", "sqlite://")
os.environ.setdefault("FLORA_UPLOAD_DIR", tempfile.mkdtemp(prefix="florafind-identify-"))
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app import identify


SAMPLE_PAYLOAD = {
    "results": [
        {
            "score": 0.8123,
            "species": {
                "scientificNameWithoutAuthor": "Ficus carica",
                "genus": {"scientificNameWithoutAuthor": "Ficus"},
                "commonNames": ["Common fig", "Fig"],
            },
        },
        {
            "score": 0.11,
            "species": {
                "scientificNameWithoutAuthor": "Quercus robur",
                "genus": {"scientificNameWithoutAuthor": "Quercus"},
                "commonNames": ["English oak"],
            },
        },
        # Below MIN_SCORE -> dropped.
        {"score": 0.001, "species": {"scientificNameWithoutAuthor": "Acer campestre"}},
        # No usable name -> dropped.
        {"score": 0.5, "species": {"commonNames": ["Mystery"]}},
    ]
}


# --- parse_results ------------------------------------------------------------

def test_parse_results_ranks_and_filters():
    candidates = identify.parse_results(SAMPLE_PAYLOAD)
    assert [c.scientific_name for c in candidates] == ["Ficus carica", "Quercus robur"]
    first = candidates[0]
    assert first.score == 0.8123
    assert first.common_name == "Common fig"
    assert first.genus == "Ficus"


def test_parse_results_respects_max():
    assert len(identify.parse_results(SAMPLE_PAYLOAD, max_results=1)) == 1


def test_parse_results_empty_payload():
    assert identify.parse_results({}) == []


# --- build_suggestion ---------------------------------------------------------

def test_build_suggestion_maps_known_species():
    candidate = identify.Candidate(0.8, "Ficus carica", "Common fig", "Ficus")
    suggestion = identify.build_suggestion(candidate, {"fig"})
    assert suggestion["category"] == "fruit_tree"
    assert suggestion["fruit_type"] == "Fig"
    assert suggestion["known_type"] is True
    assert suggestion["season_start"] == 8 and suggestion["season_end"] == 9


def test_build_suggestion_known_species_but_type_not_in_vocabulary():
    candidate = identify.Candidate(0.8, "Ficus carica", "Common fig", "Ficus")
    suggestion = identify.build_suggestion(candidate, set())
    # Category still surfaces, but fruit_type is withheld so the create endpoint
    # (which rejects unknown types) won't get an invalid value.
    assert suggestion["category"] == "fruit_tree"
    assert suggestion["fruit_type"] is None
    assert suggestion["known_type"] is False


def test_build_suggestion_carries_hazard():
    candidate = identify.Candidate(0.9, "Nerium oleander", "Oleander", "Nerium")
    suggestion = identify.build_suggestion(candidate, {"oleander"})
    assert suggestion["hazard"] is True


def test_build_suggestion_unknown_species():
    candidate = identify.Candidate(0.9, "Zzz nonexistent", None, "Zzz")
    suggestion = identify.build_suggestion(candidate, set())
    assert suggestion["category"] is None
    assert suggestion["fruit_type"] is None
    assert suggestion["known_type"] is False
    assert suggestion["scientific_name"] == "Zzz nonexistent"


# --- enabled / identify guard -------------------------------------------------

def test_identify_without_key_raises(monkeypatch):
    monkeypatch.delenv("FLORA_PLANTNET_API_KEY", raising=False)
    assert identify.enabled() is False
    try:
        identify.identify(b"bytes", "image/jpeg", "photo.jpg")
    except identify.IdentifyError as exc:
        assert "not configured" in str(exc)
    else:  # pragma: no cover
        raise AssertionError("expected IdentifyError")


def test_enabled_true_with_key(monkeypatch):
    monkeypatch.setenv("FLORA_PLANTNET_API_KEY", "test-key")
    assert identify.enabled() is True
