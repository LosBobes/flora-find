import os
import sys
import tempfile

os.environ.setdefault("FLORA_DATABASE_URL", "sqlite://")
os.environ.setdefault("FLORA_UPLOAD_DIR", tempfile.mkdtemp(prefix="florafind-enrich-"))
os.environ.setdefault("FLORA_CACHE_DIR", tempfile.mkdtemp(prefix="florafind-cache-"))
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.models import Base, Tree, TreePhoto, User
from app import enrichment
import enrich


@pytest.fixture()
def db():
    engine = create_engine(
        "sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool
    )
    Base.metadata.create_all(bind=engine)
    session = sessionmaker(bind=engine)()
    session.add(User(email="seed@florafind.rs", username="seed", password_hash="x"))
    session.commit()
    yield session
    session.close()


# --- geocoding helpers (task #4) ----------------------------------------------

def test_locality_prefers_road_and_area():
    addr = {"road": "Cara Dušana", "suburb": "Dorćol", "city": "Beograd"}
    assert enrichment.locality(addr) == "Cara Dušana, Dorćol"


def test_locality_falls_back_to_area_only():
    assert enrichment.locality({"suburb": "Vračar"}) == "Vračar"
    assert enrichment.locality({}) is None


def test_geocoded_name_composition():
    addr = {"road": "Bulevar kralja Aleksandra", "neighbourhood": "Vračar"}
    assert enrichment.geocoded_name("Fig", addr) == "Fig near Bulevar kralja Aleksandra, Vračar"
    assert enrichment.geocoded_name("Fig", {}) is None


# --- Commons imageinfo parsing (task #3) --------------------------------------

def test_parse_imageinfo_extracts_url_license_artist():
    info = {
        "thumburl": "https://upload.wikimedia.org/x/800px-Morus.jpg",
        "thumbmime": "image/jpeg",
        "descriptionurl": "https://commons.wikimedia.org/wiki/File:Morus.jpg",
        "extmetadata": {
            "LicenseShortName": {"value": "CC BY-SA 4.0"},
            "Artist": {"value": '<a href="/wiki/User:Jane">Jane Doe</a>'},
        },
    }
    ref = enrichment.parse_imageinfo(info)
    assert ref.thumb_url.endswith("800px-Morus.jpg")
    assert ref.mime == "image/jpeg"
    assert ref.license == "CC BY-SA 4.0"
    assert ref.artist == "Jane Doe"  # HTML stripped
    assert ref.source_url.endswith("File:Morus.jpg")


def test_parse_imageinfo_none_without_url():
    assert enrichment.parse_imageinfo({"extmetadata": {}}) is None
    assert enrichment.parse_imageinfo(None) is None


def test_attribution_text():
    ref = enrichment.ImageRef("u", "image/jpeg", "CC BY 4.0", "Jane Doe", "src")
    text = enrichment.attribution_text("Morus alba", ref)
    assert text == "Representative photo of Morus alba, Jane Doe, CC BY 4.0, via Wikimedia Commons"


# --- enrich passes end-to-end (monkeypatched network) -------------------------

def test_enrich_names_renames_only_when_geocoded(db, monkeypatch):
    seed = db.query(User).first()
    t1 = Tree(name="Fig (Ficus carica)", category="fruit_tree", fruit_type="Fig",
              lat=44.81, lng=20.46, species="Ficus carica", owner_id=seed.id)
    t2 = Tree(name="Walnut tree", category="fruit_tree", fruit_type="Walnut",
              lat=44.99, lng=20.99, species="Juglans regia", owner_id=seed.id)
    db.add_all([t1, t2])
    db.commit()

    def fake_reverse(lat, lng, **kw):
        return {"road": "Cara Dušana", "suburb": "Dorćol"} if lat == 44.81 else None

    monkeypatch.setattr(enrichment, "reverse_geocode", fake_reverse)
    enrich.enrich_names(db, [t1, t2], dry_run=False)
    assert t1.name == "Fig near Cara Dušana, Dorćol"
    assert t2.name == "Walnut tree"  # no geocode -> unchanged


def test_enrich_photos_attaches_attributed_image(db, monkeypatch):
    seed = db.query(User).first()
    tree = Tree(name="Mulberry", category="fruit_tree", fruit_type="Mulberry",
                lat=44.81, lng=20.46, species="Morus alba", owner_id=seed.id)
    db.add(tree)
    db.commit()

    ref = enrichment.ImageRef("https://x/img.jpg", "image/jpeg", "CC BY 4.0", "Jane", "https://src")
    monkeypatch.setattr(enrichment, "species_image", lambda species, **kw: ref)
    monkeypatch.setattr(enrichment, "download", lambda url, **kw: b"\xff\xd8jpegbytes")

    enrich.enrich_photos(db, [tree], dry_run=False)
    db.commit()  # enrich_photos stages rows; main() commits them
    db.refresh(tree)
    assert len(tree.photos) == 1
    photo = tree.photos[0]
    assert photo.content_type == "image/jpeg"
    assert "Morus alba" in photo.attribution
    assert photo.source_url == "https://src"


def test_enrich_photos_skips_when_already_has_one(db, monkeypatch):
    seed = db.query(User).first()
    tree = Tree(name="Fig", category="fruit_tree", fruit_type="Fig",
                lat=44.81, lng=20.46, species="Ficus carica", owner_id=seed.id)
    tree.photos.append(TreePhoto(filename="existing.jpg", content_type="image/jpeg"))
    db.add(tree)
    db.commit()

    called = []
    monkeypatch.setattr(enrichment, "species_image", lambda *a, **k: called.append(1))
    enrich.enrich_photos(db, [tree], dry_run=False)
    assert not called  # never even looked up an image
    assert len(tree.photos) == 1
