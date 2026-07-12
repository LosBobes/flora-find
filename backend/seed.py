"""Seed FloraFind with sample plants around Belgrade & Serbia.

Run from the ``backend`` directory:

    python seed.py            # seed only if the database has no plants yet
    python seed.py --force    # add the sample plants even if others already exist

It creates two accounts and a spread of real Belgrade parks/neighbourhoods
(plus a few entries in Novi Sad, Niš and Subotica):

    admin@florafind.rs / admin1234   : an ADMIN who can export map areas
    seed@florafind.rs  / seed1234    : the contributor who "registered" the plants

The coordinates are hand-picked to fall inside well-known green spaces
(Kalemegdan, Ada Ciganlija, Tašmajdan, Košutnjak, Zemun, Topčider…), so the
seeded map looks realistic when you open it centred on Belgrade.

The sample data itself and the loading logic live in ``app/sample_data.py`` so
the FastAPI app can reuse them to auto-seed an empty production database at
startup; this script is the manual CLI wrapper around the same helper.
"""

import sys

from app.database import Base, SessionLocal, engine
from app.migrations import run_migrations
from app.models import Tree
from app.plant_type_seed import seed_builtin_plant_types

# Re-exported for the importer/enrichment scripts (import_osm, import_gbif,
# enrich) that historically pulled these names from ``seed``.
from app.sample_data import (  # noqa: F401
    ADMIN,
    CONTRIBUTOR,
    PLANTS,
    get_or_create_user,
    seed_sample_plants,
)


def main():
    force = "--force" in sys.argv

    run_migrations(engine)
    Base.metadata.create_all(bind=engine)

    db = SessionLocal()
    try:
        print("Ensuring seed accounts…")

        seeded_types = seed_builtin_plant_types(db)
        if seeded_types:
            print(f"Seeded {seeded_types} built-in plant type(s) into the vocabulary.")

        inserted = seed_sample_plants(db, force=force)
        if inserted:
            print(f"Seeded {inserted} plants around Belgrade & Serbia.")
            print(f"Admin login: {ADMIN['email']} / {ADMIN['password']}")
        else:
            print(
                f"Database already has {db.query(Tree).count()} plant(s); skipping plant "
                "seed. Re-run with --force to add the sample plants anyway."
            )
    finally:
        db.close()


if __name__ == "__main__":
    main()
