"""Bulk-import neighbourhood plants from OpenStreetMap into FloraFind.

OSM tags individual urban plants as ``natural=tree`` / ``natural=shrub`` nodes,
often with a Latin ``species`` or ``genus``. This script pulls those nodes for a
bounding box from the Overpass API, runs each through ``app.species_map`` to fill
in category / type / season / hazard, and inserts them as ``Tree`` rows owned by
the seed contributor account.

Most OSM tree nodes carry no species, so we also mine the *ancillary* tags
(``leaf_type``, ``leaf_cycle``, ``denotation``, ``height``, ``start_date``…) into
a human description, which turns otherwise-anonymous points into useful ones and
lets ``--include-unknown`` seed richly-described generic trees.

Data (C) OpenStreetMap contributors, ODbL 1.0. See ``docs/SEED_DATA_SOURCES.md``.

Run from the ``backend`` directory:

    python import_osm.py                     # Belgrade default bbox, live Overpass
    python import_osm.py --bbox 44.79,20.40,44.84,20.52
    python import_osm.py --file sample.json  # import a saved Overpass JSON response
    python import_osm.py --limit 500 --dry-run
    python import_osm.py --include-unknown    # keep OSM species we can't classify

Requires the seed contributor account to exist; run ``python seed.py`` first, or
this script will create it.
"""

import argparse
import json
import sys

import httpx

from app.database import Base, SessionLocal, engine
from app.migrations import run_migrations
from app.plant_import import add_plant, load_existing_keys
from app.plant_type_seed import backfill_plant_types
from app.species_map import PlantInfo, classify

# Reuse the contributor the manual seed data is attributed to.
from seed import CONTRIBUTOR, get_or_create_user

OVERPASS_URL = "https://overpass-api.de/api/interpreter"
# south, west, north, east — central Belgrade by default.
DEFAULT_BBOX = (44.77, 20.38, 44.86, 20.53)

# Overpass rejects requests without a descriptive User-Agent (HTTP 406).
HEADERS = {
    "User-Agent": "FloraFind-importer/1.0 (https://github.com/Vbatocanin/flora-find)",
    "Accept": "application/json",
}

# Readable phrases for the coded OSM tag values we describe.
_LEAF_TYPE = {"broadleaved": "broadleaved", "needleleaved": "needle-leaved", "mixed": "mixed-leaf"}
_LEAF_CYCLE = {"deciduous": "deciduous", "evergreen": "evergreen", "semi_deciduous": "semi-deciduous"}
_DENOTATION = {
    "urban": "a street/urban tree",
    "avenue": "part of a tree-lined avenue",
    "park": "a park tree",
    "garden": "a garden tree",
    "landmark": "a landmark tree",
    "natural_monument": "a protected natural monument",
    "agricultural": "an agricultural planting",
}


def build_query(bbox: tuple[float, float, float, float]) -> str:
    south, west, north, east = bbox
    b = f"{south},{west},{north},{east}"
    return f"""
[out:json][timeout:180];
(
  node["natural"="tree"]({b});
  node["natural"="shrub"]({b});
);
out body;
""".strip()


def fetch_overpass(bbox, timeout: float = 200.0) -> dict:
    query = build_query(bbox)
    print(f"Querying Overpass for bbox {bbox}…")
    resp = httpx.post(OVERPASS_URL, data={"data": query}, headers=HEADERS, timeout=timeout)
    resp.raise_for_status()
    return resp.json()


def load_elements(payload: dict) -> list[dict]:
    return [e for e in payload.get("elements", []) if e.get("type") == "node"]


def title_for(info: PlantInfo, tags: dict) -> str:
    """A human title, preferring an OSM-supplied name, else '<Type> <noun>'."""
    named = tags.get("name")
    if named:
        return named[:120]
    noun = {"vine": "vine", "shrub": "shrub", "flowerbed": "bed"}.get(info.category, "tree")
    label = info.fruit_type
    if label.lower() == noun:  # generic unknown fallback, avoid "Tree tree"
        return f"Unidentified {noun}"
    return f"{label} {noun}"


def describe(tags: dict) -> str | None:
    """Build a sentence from the ancillary OSM tags most nodes do carry.

    e.g. "Broadleaved deciduous tree, part of a tree-lined avenue, ~14 m tall,
    planted 2016." Returns ``None`` when there's nothing worth saying.
    """
    leaf = _LEAF_TYPE.get(tags.get("leaf_type", ""))
    cycle = _LEAF_CYCLE.get(tags.get("leaf_cycle", ""))
    lead = " ".join(w for w in (leaf, cycle) if w)
    head = f"{lead} tree".strip().capitalize() if lead else None

    clauses: list[str] = []
    if head:
        clauses.append(head)
    if den := _DENOTATION.get(tags.get("denotation", "")):
        clauses.append(den if clauses else den.capitalize())
    if height := tags.get("height"):
        clauses.append(f"~{height} m tall" if not str(height).endswith("m") else f"~{height} tall")
    if planted := (tags.get("start_date") or tags.get("planted")):
        year = str(planted)[:4]
        if year.isdigit():
            clauses.append(f"planted {year}")
    if op := tags.get("operator"):
        clauses.append(f"maintained by {op}")

    if not clauses:
        return None
    return ", ".join(clauses) + "."


def import_elements(db, elements, contributor, *, limit=None, include_unknown=False, dry_run=False):
    existing = load_existing_keys(db)

    added = skipped_unknown = skipped_dup = skipped_nogeo = 0
    for el in elements:
        if limit is not None and added >= limit:
            break
        lat, lng = el.get("lat"), el.get("lon")
        if lat is None or lng is None:
            skipped_nogeo += 1
            continue
        tags = el.get("tags", {})
        info = classify(tags.get("species"), tags.get("genus"))
        if info is None:
            if not include_unknown:
                skipped_unknown += 1
                continue
            # No species: keep it as a generic tree rather than invent structure.
            label = (tags.get("genus") or tags.get("species") or "Tree").split()[0].title()
            info = PlantInfo("tree", label)

        species = tags.get("species") or tags.get("genus") or None
        if add_plant(
            db, existing, contributor.id,
            lat=lat, lng=lng, info=info,
            name=title_for(info, tags),
            species=species,
            description=describe(tags),
        ):
            added += 1
        else:
            skipped_dup += 1

    print(
        f"Matched {added} plant(s); skipped {skipped_unknown} unknown species, "
        f"{skipped_dup} duplicate(s), {skipped_nogeo} without coordinates."
    )
    if dry_run:
        db.rollback()
        print("Dry run: nothing written.")
        return added

    db.commit()
    added_types = backfill_plant_types(db)
    print(f"Committed {added} plant(s); registered {added_types} new plant type(s).")
    return added


def parse_bbox(text: str) -> tuple[float, float, float, float]:
    parts = [float(p) for p in text.split(",")]
    if len(parts) != 4:
        raise argparse.ArgumentTypeError("bbox must be 'south,west,north,east'")
    return tuple(parts)  # type: ignore[return-value]


def main():
    parser = argparse.ArgumentParser(description="Import OSM plants into FloraFind.")
    parser.add_argument("--bbox", type=parse_bbox, default=DEFAULT_BBOX,
                        help="south,west,north,east (default: central Belgrade)")
    parser.add_argument("--file", help="import a saved Overpass JSON file instead of querying")
    parser.add_argument("--limit", type=int, help="cap the number of plants added")
    parser.add_argument("--include-unknown", action="store_true",
                        help="keep OSM entries whose species we can't classify")
    parser.add_argument("--dry-run", action="store_true", help="report counts without writing")
    args = parser.parse_args()

    run_migrations(engine)
    Base.metadata.create_all(bind=engine)

    if args.file:
        with open(args.file) as fh:
            payload = json.load(fh)
    else:
        try:
            payload = fetch_overpass(args.bbox)
        except httpx.HTTPError as exc:
            print(f"Overpass request failed: {exc}", file=sys.stderr)
            return 1

    elements = load_elements(payload)
    print(f"Fetched {len(elements)} OSM node(s).")

    db = SessionLocal()
    try:
        contributor = get_or_create_user(db, **CONTRIBUTOR)
        db.commit()
        import_elements(
            db, elements, contributor,
            limit=args.limit,
            include_unknown=args.include_unknown,
            dry_run=args.dry_run,
        )
    finally:
        db.close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
