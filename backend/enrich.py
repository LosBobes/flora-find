"""Enrich already-imported FloraFind plants with better names and photos.

Runs *after* the importers (``import_osm.py`` / ``import_gbif.py``). Two passes,
either or both:

  * ``--names``  reverse-geocode each plant and rename it "<Type> near <street>,
    <area>" (task #4, via Nominatim).
  * ``--photos`` attach a representative, attributed Wikimedia Commons image for
    the plant's species when it has none (task #3).

Both are network-bound and politely rate-limited, so a large run takes a while;
results are cached under ``FLORA_CACHE_DIR`` (default ``./.florafind_cache``) so
re-runs are fast. By default only plants owned by the seed contributor (i.e.
imported/seeded data) are touched, so user contributions are left alone.

Run from the ``backend`` directory:

    python enrich.py                       # both passes, seeded plants
    python enrich.py --names --limit 50
    python enrich.py --photos --dry-run
    python enrich.py --all-owners          # also enrich user-contributed plants
"""

import argparse
import secrets
import sys

from app import enrichment
from app.database import Base, SessionLocal, engine
from app.migrations import run_migrations
from app.models import Tree, TreePhoto, User
from app.storage import ALLOWED_PHOTO_TYPES, UPLOAD_DIR

from seed import CONTRIBUTOR


def select_trees(db, *, all_owners, limit):
    query = db.query(Tree)
    if not all_owners:
        contributor = db.query(User).filter(User.email == CONTRIBUTOR["email"]).first()
        if contributor is None:
            print("No seed contributor found; run seed.py or pass --all-owners.", file=sys.stderr)
            return []
        query = query.filter(Tree.owner_id == contributor.id)
    query = query.order_by(Tree.id)
    if limit is not None:
        query = query.limit(limit)
    return query.all()


def enrich_names(db, trees, *, dry_run):
    updated = 0
    for tree in trees:
        address = enrichment.reverse_geocode(tree.lat, tree.lng)
        name = enrichment.geocoded_name(tree.fruit_type, address)
        if name and name != tree.name:
            print(f"  #{tree.id}: {tree.name!r} -> {name!r}")
            if not dry_run:
                tree.name = name
            updated += 1
    print(f"Names: {updated} renamed.")
    return updated


def enrich_photos(db, trees, *, dry_run):
    added = skipped = 0
    for tree in trees:
        if tree.photos or not tree.species:
            skipped += 1
            continue
        ref = enrichment.species_image(tree.species)
        if ref is None:
            skipped += 1
            continue
        extension = ALLOWED_PHOTO_TYPES.get(ref.mime)
        if extension is None:  # e.g. SVG/TIFF Commons files we can't serve
            skipped += 1
            continue
        print(f"  #{tree.id} {tree.species}: {ref.license} / {ref.artist}")
        if dry_run:
            added += 1
            continue
        try:
            data = enrichment.download(ref.thumb_url)
        except Exception as exc:  # noqa: BLE001 - never let one image abort the run
            print(f"    download failed: {exc}", file=sys.stderr)
            skipped += 1
            continue
        filename = f"{secrets.token_hex(12)}{extension}"
        (UPLOAD_DIR / filename).write_bytes(data)
        db.add(TreePhoto(
            filename=filename,
            content_type=ref.mime,
            tree=tree,
            attribution=enrichment.attribution_text(tree.species, ref),
            source_url=ref.source_url,
        ))
        added += 1
    print(f"Photos: {added} added, {skipped} skipped.")
    return added


def main():
    parser = argparse.ArgumentParser(description="Enrich imported FloraFind plants.")
    parser.add_argument("--names", action="store_true", help="reverse-geocode plant names")
    parser.add_argument("--photos", action="store_true", help="attach species photos")
    parser.add_argument("--all-owners", action="store_true",
                        help="enrich every plant, not just seeded ones")
    parser.add_argument("--limit", type=int, help="cap how many plants to process")
    parser.add_argument("--dry-run", action="store_true", help="report changes without writing")
    args = parser.parse_args()

    # Default to doing both passes when neither is named.
    do_names = args.names or not (args.names or args.photos)
    do_photos = args.photos or not (args.names or args.photos)

    run_migrations(engine)
    Base.metadata.create_all(bind=engine)

    db = SessionLocal()
    try:
        trees = select_trees(db, all_owners=args.all_owners, limit=args.limit)
        print(f"Enriching {len(trees)} plant(s).")
        if do_names:
            enrich_names(db, trees, dry_run=args.dry_run)
        if do_photos:
            enrich_photos(db, trees, dry_run=args.dry_run)
        if args.dry_run:
            db.rollback()
            print("Dry run: nothing written.")
        else:
            db.commit()
    finally:
        db.close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
