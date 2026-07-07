import os
import sys

os.environ.setdefault("FLORA_DATABASE_URL", "sqlite://")
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

import app.database as database
from app.models import Base, Tree, User
from app.plant_import import add_plant, dedup_key, load_existing_keys
from app.species_map import classify

import import_osm
import import_gbif


@pytest.fixture()
def db():
    engine = create_engine(
        "sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool
    )
    Base.metadata.create_all(bind=engine)
    Session = sessionmaker(bind=engine)
    session = Session()
    session.add(User(email="s@x.rs", username="seed", password_hash="x"))
    session.commit()
    yield session
    session.close()


# --- OSM ancillary-tag enrichment (task #1) ------------------------------------

def test_osm_describe_from_leaf_and_denotation():
    d = import_osm.describe(
        {"leaf_type": "broadleaved", "leaf_cycle": "deciduous",
         "denotation": "avenue", "start_date": "2016", "height": "14"}
    )
    assert d == ("Broadleaved deciduous tree, part of a tree-lined avenue, "
                 "~14 m tall, planted 2016.")


def test_osm_describe_natural_monument_without_leaf_tags():
    d = import_osm.describe({"denotation": "natural_monument"})
    assert d == "A protected natural monument."


def test_osm_describe_returns_none_when_barren():
    assert import_osm.describe({"natural": "tree"}) is None


def test_osm_include_unknown_still_gets_a_description(db):
    seed = db.query(User).first()
    els = [{"type": "node", "lat": 44.81, "lon": 20.46,
            "tags": {"natural": "tree", "leaf_type": "broadleaved", "denotation": "urban"}}]
    import_osm.import_elements(db, els, seed, include_unknown=True)
    tree = db.query(Tree).one()
    assert tree.category == "tree"
    assert tree.description and "urban" in tree.description.lower()


def test_osm_skips_unknown_without_flag(db):
    seed = db.query(User).first()
    els = [{"type": "node", "lat": 44.81, "lon": 20.46, "tags": {"natural": "tree"}}]
    import_osm.import_elements(db, els, seed, include_unknown=False)
    assert db.query(Tree).count() == 0


# --- shared dedupe helper ------------------------------------------------------

def test_add_plant_dedupes_on_rounded_coords(db):
    seed = db.query(User).first()
    existing = load_existing_keys(db)
    info = classify(genus="Tilia")
    assert add_plant(db, existing, seed.id, lat=44.8100, lng=20.4600, info=info, name="A")
    # 44.81004 rounds to the same 4-dp key -> duplicate.
    assert not add_plant(db, existing, seed.id, lat=44.81004, lng=20.46001, info=info, name="B")
    db.commit()
    assert db.query(Tree).count() == 1


# --- GBIF importer (task #2) ---------------------------------------------------

def test_gbif_describe_has_provenance_and_caveat():
    d = import_gbif.describe(
        {"basisOfRecord": "HUMAN_OBSERVATION", "eventDate": "2021-06-01",
         "datasetName": "iNaturalist", "coordinateUncertaintyInMeters": 40}
    )
    assert "observed 2021" in d
    assert "iNaturalist" in d
    assert "~40 m" in d
    assert "not a fixed planting" in d


def test_gbif_import_filters_unknown_and_fuzzy(db):
    seed = db.query(User).first()
    records = [
        {"decimalLatitude": 44.80, "decimalLongitude": 20.45, "species": "Morus alba",
         "genus": "Morus", "coordinateUncertaintyInMeters": 30, "basisOfRecord": "HUMAN_OBSERVATION"},
        {"decimalLatitude": 44.81, "decimalLongitude": 20.46, "species": "Rubus idaeus",
         "genus": "Rubus", "coordinateUncertaintyInMeters": 5000},  # too fuzzy -> dropped
        {"decimalLatitude": 44.82, "decimalLongitude": 20.47, "species": "Sequoia sempervirens",
         "genus": "Sequoia"},  # not in vocab -> dropped
        {"decimalLatitude": 44.83, "decimalLongitude": 20.48, "species": "Prunus avium",
         "genus": "Prunus"},
    ]
    import_gbif.import_records(db, records, seed, max_uncertainty=1000)
    kinds = {t.fruit_type for t in db.query(Tree).all()}
    assert kinds == {"Mulberry", "Cherry"}
