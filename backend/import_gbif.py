"""Bulk-import foraging plants from GBIF / iNaturalist into FloraFind.

OpenStreetMap is weak on exactly the fruit, berry and nut species FloraFind cares
about (see ``import_osm.py``). GBIF aggregates georeferenced species occurrences
from iNaturalist, museums and citizen science, and is strong there. This script
queries the GBIF occurrence search API for plant occurrences (kingdom Plantae) in
a bounding box, runs each through ``app.species_map``, and inserts the ones we
recognise as ``Tree`` rows owned by the seed contributor.

Caveats worth knowing (reflected in the synthesized description):
  * an occurrence is where an *observer stood*, not a permanent planting;
  * some coordinates are fuzzed, so we drop records whose stated uncertainty is
    larger than ``--max-uncertainty`` metres.

Licensing: each GBIF record carries its own CC licence. We request only CC0 and
CC BY by default; pass ``--allow-nc`` to also pull CC BY-NC (non-commercial only).
A GBIF query also has a citable DOI if you register the download; this ad-hoc
search path does not mint one. See ``docs/SEED_DATA_SOURCES.md``.

Run from the ``backend`` directory:

    python import_gbif.py                     # central Belgrade default bbox
    python import_gbif.py --bbox 44.77,20.38,44.86,20.53 --max-pages 5
    python import_gbif.py --file gbif.json    # import a saved GBIF response (offline)
    python import_gbif.py --allow-nc --dry-run
"""

import argparse
import json
import sys

import httpx

from app.database import Base, SessionLocal, engine
from app.migrations import run_migrations
from app.plant_import import add_plant, load_existing_keys
from app.plant_type_seed import backfill_plant_types
from app.species_map import classify

from seed import CONTRIBUTOR, get_or_create_user

GBIF_URL = "https://api.gbif.org/v1/occurrence/search"
PLANTAE_TAXON_KEY = 6  # GBIF backbone key for kingdom Plantae.
PAGE_SIZE = 300  # GBIF max per page.
DEFAULT_BBOX = (44.77, 20.38, 44.86, 20.53)  # south, west, north, east — central Belgrade.
HEADERS = {"User-Agent": "FloraFind-importer/1.0 (https://github.com/Vbatocanin/flora-find)"}

_DATASET_HINT = {
    "HUMAN_OBSERVATION": "observed",
    "MACHINE_OBSERVATION": "recorded",
    "PRESERVED_SPECIMEN": "specimen collected",
    "OBSERVATION": "observed",
}


def build_params(bbox, licenses, offset):
    south, west, north, east = bbox
    params = [
        ("taxonKey", PLANTAE_TAXON_KEY),
        ("hasCoordinate", "true"),
        ("hasGeospatialIssue", "false"),
        ("decimalLatitude", f"{south},{north}"),
        ("decimalLongitude", f"{west},{east}"),
        ("limit", PAGE_SIZE),
        ("offset", offset),
    ]
    params += [("license", lic) for lic in licenses]
    return params


def fetch_gbif(bbox, licenses, *, max_pages, timeout=60.0):
    """Page through the GBIF occurrence search, returning a list of records."""
    results = []
    offset = 0
    for page in range(max_pages):
        params = build_params(bbox, licenses, offset)
        resp = httpx.get(GBIF_URL, params=params, headers=HEADERS, timeout=timeout)
        resp.raise_for_status()
        payload = resp.json()
        batch = payload.get("results", [])
        results.extend(batch)
        print(f"  page {page + 1}: {len(batch)} record(s) (total so far {len(results)})")
        if payload.get("endOfRecords") or not batch:
            break
        offset += PAGE_SIZE
    return results


def describe(rec: dict) -> str:
    """Provenance sentence: how/when observed, source, coordinate accuracy."""
    verb = _DATASET_HINT.get(rec.get("basisOfRecord", ""), "recorded")
    year = str(rec.get("eventDate") or "")[:4]
    when = f" {year}" if year.isdigit() else ""
    source = rec.get("datasetName") or "GBIF"
    clauses = [f"Wild occurrence {verb}{when} via {source}"]
    unc = rec.get("coordinateUncertaintyInMeters")
    if isinstance(unc, (int, float)) and unc > 0:
        clauses.append(f"location accurate to ~{int(unc)} m")
    clauses.append("marks where the plant was seen, not a fixed planting")
    return "; ".join(clauses) + "."


def import_records(db, records, contributor, *, limit=None, max_uncertainty=1000.0, dry_run=False):
    existing = load_existing_keys(db)

    added = skipped_unknown = skipped_dup = skipped_nogeo = skipped_fuzzy = 0
    for rec in records:
        if limit is not None and added >= limit:
            break
        lat, lng = rec.get("decimalLatitude"), rec.get("decimalLongitude")
        if lat is None or lng is None:
            skipped_nogeo += 1
            continue
        unc = rec.get("coordinateUncertaintyInMeters")
        if isinstance(unc, (int, float)) and unc > max_uncertainty:
            skipped_fuzzy += 1
            continue
        info = classify(rec.get("species"), rec.get("genus"))
        if info is None:
            skipped_unknown += 1
            continue

        species = rec.get("species") or rec.get("genus") or None
        name = f"{info.fruit_type} ({species})" if species else info.fruit_type
        if add_plant(
            db, existing, contributor.id,
            lat=lat, lng=lng, info=info,
            name=name, species=species, description=describe(rec),
        ):
            added += 1
        else:
            skipped_dup += 1

    print(
        f"Matched {added} plant(s); skipped {skipped_unknown} unknown, "
        f"{skipped_dup} duplicate(s), {skipped_fuzzy} too-fuzzy, "
        f"{skipped_nogeo} without coordinates."
    )
    if dry_run:
        db.rollback()
        print("Dry run: nothing written.")
        return added

    db.commit()
    added_types = backfill_plant_types(db)
    print(f"Committed {added} plant(s); registered {added_types} new plant type(s).")
    return added


def parse_bbox(text: str):
    parts = [float(p) for p in text.split(",")]
    if len(parts) != 4:
        raise argparse.ArgumentTypeError("bbox must be 'south,west,north,east'")
    return tuple(parts)


def main():
    parser = argparse.ArgumentParser(description="Import GBIF/iNaturalist plants into FloraFind.")
    parser.add_argument("--bbox", type=parse_bbox, default=DEFAULT_BBOX,
                        help="south,west,north,east (default: central Belgrade)")
    parser.add_argument("--file", help="import a saved GBIF JSON response instead of querying")
    parser.add_argument("--max-pages", type=int, default=5, help="GBIF pages to fetch (300/page)")
    parser.add_argument("--limit", type=int, help="cap the number of plants added")
    parser.add_argument("--max-uncertainty", type=float, default=1000.0,
                        help="drop records fuzzier than this many metres")
    parser.add_argument("--allow-nc", action="store_true",
                        help="also import CC BY-NC records (non-commercial use only)")
    parser.add_argument("--dry-run", action="store_true", help="report counts without writing")
    args = parser.parse_args()

    run_migrations(engine)
    Base.metadata.create_all(bind=engine)

    licenses = ["CC0_1_0", "CC_BY_4_0"]
    if args.allow_nc:
        licenses.append("CC_BY_NC_4_0")

    if args.file:
        with open(args.file) as fh:
            payload = json.load(fh)
        records = payload.get("results", payload if isinstance(payload, list) else [])
    else:
        print(f"Querying GBIF for plant occurrences in bbox {args.bbox}…")
        try:
            records = fetch_gbif(args.bbox, licenses, max_pages=args.max_pages)
        except httpx.HTTPError as exc:
            print(f"GBIF request failed: {exc}", file=sys.stderr)
            return 1
    print(f"Fetched {len(records)} GBIF record(s).")

    db = SessionLocal()
    try:
        contributor = get_or_create_user(db, **CONTRIBUTOR)
        db.commit()
        import_records(
            db, records, contributor,
            limit=args.limit,
            max_uncertainty=args.max_uncertainty,
            dry_run=args.dry_run,
        )
    finally:
        db.close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
