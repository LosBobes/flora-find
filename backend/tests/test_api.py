import os
import sys
import tempfile

os.environ["FLORA_DATABASE_URL"] = "sqlite://"  # in-memory
os.environ["FLORA_UPLOAD_DIR"] = tempfile.mkdtemp(prefix="florafind-uploads-")

_frontend_dist = tempfile.mkdtemp(prefix="florafind-dist-")
with open(os.path.join(_frontend_dist, "index.html"), "w") as f:
    f.write("<!doctype html><title>FloraFind</title>")
os.environ["FLORA_FRONTEND_DIST"] = _frontend_dist

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.pool import StaticPool

import app.database as database

# Rebind the engine to a shared in-memory SQLite before the app builds tables.
from sqlalchemy import create_engine

database.engine = create_engine(
    "sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool
)
database.SessionLocal.configure(bind=database.engine)

from app.main import app  # noqa: E402

client = TestClient(app)


@pytest.fixture(autouse=True)
def clean_db():
    database.Base.metadata.drop_all(bind=database.engine)
    database.Base.metadata.create_all(bind=database.engine)
    yield


def register(email="ana@example.com", username="ana", password="secret-pass-1"):
    resp = client.post(
        "/api/auth/register",
        json={"email": email, "username": username, "password": password},
    )
    assert resp.status_code == 201, resp.text
    return resp.json()


def auth_headers(token):
    return {"Authorization": f"Bearer {token}"}


def ensure_plant_type(category, fruit_type):
    """Register a plant type directly (as the app's backfill/admin would) so a
    tree that uses it passes the vocabulary check."""
    from app.database import SessionLocal
    from app.models import PlantType

    db = SessionLocal()
    try:
        wanted = fruit_type.strip().lower()
        if not any(pt.canonical.strip().lower() == wanted for pt in db.query(PlantType).all()):
            db.add(PlantType(category=category, names={"en": fruit_type, "sr": fruit_type}))
            db.commit()
    finally:
        db.close()


def make_tree(token, **overrides):
    body = {
        "name": "Old cherry by the school",
        "fruit_type": "Cherry",
        "lat": 44.8125,
        "lng": 20.4612,
        "description": "Sweet dark cherries in June.",
        "season_start": 6,
        "season_end": 6,
    }
    body.update(overrides)
    ensure_plant_type(body.get("category", "fruit_tree"), body["fruit_type"])
    resp = client.post("/api/trees", json=body, headers=auth_headers(token))
    assert resp.status_code == 201, resp.text
    return resp.json()


def make_admin(email="ana@example.com"):
    from app.database import SessionLocal
    from app.models import User

    db = SessionLocal()
    try:
        user = db.query(User).filter(User.email == email.lower()).first()
        user.is_admin = True
        db.commit()
    finally:
        db.close()


def month_offset(delta):
    """Current UTC month shifted by delta, wrapped to 1-12."""
    from app.models import utcnow

    return (utcnow().month - 1 + delta) % 12 + 1


def test_frontend_served_from_same_origin():
    resp = client.get("/")
    assert resp.status_code == 200
    assert "FloraFind" in resp.text
    # API routes still take precedence over the static mount.
    assert client.get("/api/health").json() == {"status": "ok"}


def test_register_login_me():
    data = register()
    assert data["user"]["username"] == "ana"

    resp = client.post(
        "/api/auth/login", json={"email": "ana@example.com", "password": "secret-pass-1"}
    )
    assert resp.status_code == 200
    token = resp.json()["access_token"]

    resp = client.get("/api/auth/me", headers=auth_headers(token))
    assert resp.status_code == 200
    assert resp.json()["email"] == "ana@example.com"


def test_duplicate_email_rejected():
    register()
    resp = client.post(
        "/api/auth/register",
        json={"email": "ana@example.com", "username": "other", "password": "secret-pass-1"},
    )
    assert resp.status_code == 409


def test_wrong_password_rejected():
    register()
    resp = client.post(
        "/api/auth/login", json={"email": "ana@example.com", "password": "wrong-password"}
    )
    assert resp.status_code == 401


def test_create_requires_auth():
    resp = client.post(
        "/api/trees",
        json={"name": "X", "fruit_type": "Fig", "lat": 0, "lng": 0},
    )
    assert resp.status_code == 401


def test_create_and_get_tree():
    token = register()["access_token"]
    tree = make_tree(token)
    assert tree["fruit_type"] == "Cherry"
    assert tree["owner"]["username"] == "ana"

    resp = client.get(f"/api/trees/{tree['id']}")
    assert resp.status_code == 200
    assert resp.json()["name"] == "Old cherry by the school"


def test_text_and_fruit_type_search():
    token = register()["access_token"]
    make_tree(token)
    make_tree(token, name="Fig behind the church", fruit_type="Fig", lat=44.8, lng=20.45)

    resp = client.get("/api/trees", params={"q": "church"})
    assert [t["name"] for t in resp.json()] == ["Fig behind the church"]

    resp = client.get("/api/trees", params={"fruit_type": "cherry"})
    assert len(resp.json()) == 1
    assert resp.json()[0]["fruit_type"] == "Cherry"


def test_default_category_is_fruit_tree():
    token = register()["access_token"]
    tree = make_tree(token)
    assert tree["category"] == "fruit_tree"
    assert tree["hazard"] is False


def test_create_non_fruit_plants_and_filter_by_category():
    token = register()["access_token"]
    make_tree(token)
    make_tree(token, name="Big oak", category="tree", fruit_type="Oak")
    make_tree(token, name="Corner pine", category="evergreen", fruit_type="Pine")
    make_tree(token, name="Tulip bed", category="flowerbed", fruit_type="Tulips")
    make_tree(token, name="Lilac hedge", category="shrub", fruit_type="Lilac")

    resp = client.get("/api/trees", params={"category": "flowerbed"})
    assert [t["name"] for t in resp.json()] == ["Tulip bed"]

    resp = client.get("/api/trees", params={"category": "evergreen"})
    assert [t["name"] for t in resp.json()] == ["Corner pine"]

    resp = client.get("/api/trees", params={"category": "fruit_tree"})
    assert [t["name"] for t in resp.json()] == ["Old cherry by the school"]

    resp = client.get("/api/trees")
    assert len(resp.json()) == 5


def test_invalid_category_rejected():
    token = register()["access_token"]
    resp = client.post(
        "/api/trees",
        json={"name": "X", "category": "spaceship", "fruit_type": "Oak", "lat": 0, "lng": 0},
        headers=auth_headers(token),
    )
    assert resp.status_code == 422


def test_hazard_plants_and_filter():
    token = register()["access_token"]
    make_tree(token)
    poison = make_tree(
        token, name="Poison ivy patch", category="vine", fruit_type="Poison ivy", hazard=True
    )
    assert poison["hazard"] is True

    resp = client.get("/api/trees", params={"hazard": "true"})
    assert [t["name"] for t in resp.json()] == ["Poison ivy patch"]

    resp = client.get("/api/trees", params={"hazard": "false"})
    assert [t["name"] for t in resp.json()] == ["Old cherry by the school"]

    resp = client.get("/api/trees")
    assert len(resp.json()) == 2


def test_update_category_and_hazard():
    token = register()["access_token"]
    tree = make_tree(token)
    resp = client.put(
        f"/api/trees/{tree['id']}",
        json={"category": "shrub", "hazard": True},
        headers=auth_headers(token),
    )
    assert resp.status_code == 200
    assert resp.json()["category"] == "shrub"
    assert resp.json()["hazard"] is True


def test_fruit_types_scoped_by_category():
    token = register()["access_token"]
    make_tree(token)
    make_tree(token, name="Big oak", category="tree", fruit_type="Oak")

    resp = client.get("/api/trees/fruit-types", params={"category": "tree"})
    assert resp.json() == ["Oak"]
    resp = client.get("/api/trees/fruit-types")
    assert resp.json() == ["Cherry", "Oak"]


def test_category_and_hazard_migration():
    from sqlalchemy import create_engine, text

    from app.migrations import run_migrations

    engine = create_engine("sqlite://")
    with engine.begin() as conn:
        conn.execute(
            text(
                "CREATE TABLE trees (id INTEGER PRIMARY KEY, name TEXT, fruit_type TEXT, "
                "season TEXT, lat FLOAT, lng FLOAT)"
            )
        )
        conn.execute(
            text("INSERT INTO trees (id, name, fruit_type, lat, lng) VALUES (1, 'A', 'Cherry', 0, 0)")
        )

    run_migrations(engine)

    with engine.connect() as conn:
        rows = conn.execute(text("SELECT category, hazard FROM trees")).all()
    assert rows == [("fruit_tree", 0)]

    # Running again is a no-op.
    run_migrations(engine)


def test_bounding_box_search():
    token = register()["access_token"]
    make_tree(token, name="Belgrade cherry", lat=44.81, lng=20.46)
    make_tree(token, name="Paris apple", fruit_type="Apple", lat=48.85, lng=2.35)

    resp = client.get(
        "/api/trees",
        params={"min_lat": 44, "max_lat": 45, "min_lng": 20, "max_lng": 21},
    )
    names = [t["name"] for t in resp.json()]
    assert names == ["Belgrade cherry"]


def test_radius_search_sorted_by_distance():
    token = register()["access_token"]
    make_tree(token, name="Near", lat=44.8130, lng=20.4620)
    make_tree(token, name="Far", lat=44.9000, lng=20.6000)
    make_tree(token, name="Very far", lat=48.85, lng=2.35)

    resp = client.get(
        "/api/trees", params={"lat": 44.8125, "lng": 20.4612, "radius_km": 20}
    )
    data = resp.json()
    assert [t["name"] for t in data] == ["Near", "Far"]
    assert data[0]["distance_km"] < data[1]["distance_km"]


def test_fruit_types_endpoint():
    token = register()["access_token"]
    make_tree(token)
    make_tree(token, fruit_type="Apple", name="Apple 1")
    make_tree(token, fruit_type="Apple", name="Apple 2")

    resp = client.get("/api/trees/fruit-types")
    assert resp.json() == ["Apple", "Cherry"]


def test_ripe_now_filter():
    token = register()["access_token"]
    make_tree(token, name="In season", season_start=month_offset(-1), season_end=month_offset(1))
    make_tree(token, name="Out of season", season_start=month_offset(2), season_end=month_offset(3))
    make_tree(token, name="No season", season_start=None, season_end=None)

    resp = client.get("/api/trees", params={"ripe_now": "true"})
    assert [t["name"] for t in resp.json()] == ["In season"]

    resp = client.get("/api/trees")
    by_name = {t["name"]: t for t in resp.json()}
    assert by_name["In season"]["in_season"] is True
    assert by_name["Out of season"]["in_season"] is False
    assert by_name["No season"]["in_season"] is False


def test_ripe_now_handles_wraparound_season():
    token = register()["access_token"]
    # Season spans the new year and covers the current month, e.g. Nov-Feb in January.
    make_tree(token, name="Wrap", season_start=month_offset(-1), season_end=month_offset(-11))

    resp = client.get("/api/trees", params={"ripe_now": "true"})
    assert [t["name"] for t in resp.json()] == ["Wrap"]
    assert resp.json()[0]["in_season"] is True


def test_single_month_season_filled():
    token = register()["access_token"]
    tree = make_tree(token, season_start=7, season_end=None)
    assert tree["season_start"] == 7
    assert tree["season_end"] == 7


def test_season_month_validated():
    token = register()["access_token"]
    resp = client.post(
        "/api/trees",
        json={"name": "X", "fruit_type": "Fig", "lat": 0, "lng": 0, "season_start": 13},
        headers=auth_headers(token),
    )
    assert resp.status_code == 422


def test_season_text_migration():
    from sqlalchemy import create_engine, text

    from app.migrations import parse_season_text, run_migrations

    assert parse_season_text("June") == (6, 6)
    assert parse_season_text("June–July") == (6, 7)
    assert parse_season_text("late Sep to early Nov") == (9, 11)
    assert parse_season_text("whenever") == (None, None)
    assert parse_season_text(None) == (None, None)

    engine = create_engine("sqlite://")
    with engine.begin() as conn:
        conn.execute(
            text(
                "CREATE TABLE trees (id INTEGER PRIMARY KEY, name TEXT, fruit_type TEXT, "
                "season TEXT, lat FLOAT, lng FLOAT)"
            )
        )
        conn.execute(
            text("INSERT INTO trees (id, name, fruit_type, season, lat, lng) VALUES "
                 "(1, 'A', 'Cherry', 'June–July', 0, 0), (2, 'B', 'Fig', NULL, 0, 0)")
        )

    run_migrations(engine)

    with engine.connect() as conn:
        rows = conn.execute(
            text("SELECT id, season_start, season_end FROM trees ORDER BY id")
        ).all()
    assert rows == [(1, 6, 7), (2, None, None)]

    # Running again is a no-op.
    run_migrations(engine)


def confirm(token, tree_id, status_value):
    return client.post(
        f"/api/trees/{tree_id}/confirmations",
        json={"status": status_value},
        headers=auth_headers(token),
    )


def test_confirmation_requires_auth():
    token = register()["access_token"]
    tree = make_tree(token)
    resp = client.post(f"/api/trees/{tree['id']}/confirmations", json={"status": "present"})
    assert resp.status_code == 401


def test_confirm_still_there_sets_last_confirmed():
    token = register()["access_token"]
    tree = make_tree(token)
    assert tree["last_confirmed_at"] is None

    resp = confirm(token, tree["id"], "present")
    assert resp.status_code == 200
    data = resp.json()
    assert data["last_confirmed_at"] is not None
    assert data["gone_reports"] == 0
    assert data["flagged_gone"] is False


def test_one_vote_per_user_latest_wins():
    token = register()["access_token"]
    tree = make_tree(token)

    confirm(token, tree["id"], "gone")
    data = confirm(token, tree["id"], "gone").json()
    assert data["gone_reports"] == 1  # voting twice doesn't double-count

    data = confirm(token, tree["id"], "present").json()
    assert data["gone_reports"] == 0  # switching the vote replaces it
    assert data["last_confirmed_at"] is not None


def test_flagged_gone_after_three_reports():
    token = register()["access_token"]
    tree = make_tree(token)

    for i in range(3):
        voter = register(f"voter{i}@example.com", f"voter{i}")["access_token"]
        data = confirm(voter, tree["id"], "gone").json()
    assert data["gone_reports"] == 3
    assert data["flagged_gone"] is True

    resp = client.get(f"/api/trees/{tree['id']}")
    assert resp.json()["flagged_gone"] is True


def test_confirm_missing_tree_404():
    token = register()["access_token"]
    resp = confirm(token, 999, "present")
    assert resp.status_code == 404

    tree = make_tree(token)
    resp = confirm(token, tree["id"], "maybe")
    assert resp.status_code == 422


PNG_BYTES = bytes.fromhex(
    "89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c489"
    "0000000d4944415478da63f8ffff3f0300050001ffb7f5cc000000004945"
    "4e44ae426082"
)


def upload_photos(token, tree_id, files):
    return client.post(
        f"/api/trees/{tree_id}/photos", files=files, headers=auth_headers(token)
    )


def png_file(name="tree.png"):
    return ("files", (name, PNG_BYTES, "image/png"))


def test_upload_and_delete_photos():
    from app.storage import UPLOAD_DIR

    token = register()["access_token"]
    tree = make_tree(token)

    resp = upload_photos(token, tree["id"], [png_file(), png_file("two.png")])
    assert resp.status_code == 201, resp.text
    photos = resp.json()
    assert len(photos) == 2
    assert all(photo["url"].startswith("/uploads/") for photo in photos)

    # Files exist on disk and are served.
    filename = photos[0]["url"].removeprefix("/uploads/")
    assert (UPLOAD_DIR / filename).read_bytes() == PNG_BYTES
    resp = client.get(photos[0]["url"])
    assert resp.status_code == 200
    assert resp.content == PNG_BYTES

    # Photos appear on the tree.
    resp = client.get(f"/api/trees/{tree['id']}")
    assert len(resp.json()["photos"]) == 2

    # Deleting a photo removes the record and the file.
    resp = client.delete(
        f"/api/trees/{tree['id']}/photos/{photos[0]['id']}", headers=auth_headers(token)
    )
    assert resp.status_code == 204
    assert not (UPLOAD_DIR / filename).exists()
    resp = client.get(f"/api/trees/{tree['id']}")
    assert len(resp.json()["photos"]) == 1


def test_photo_limit_enforced():
    token = register()["access_token"]
    tree = make_tree(token)

    resp = upload_photos(token, tree["id"], [png_file(f"{i}.png") for i in range(4)])
    assert resp.status_code == 400

    resp = upload_photos(token, tree["id"], [png_file(f"{i}.png") for i in range(3)])
    assert resp.status_code == 201
    resp = upload_photos(token, tree["id"], [png_file("extra.png")])
    assert resp.status_code == 400


def test_photo_type_and_size_validated():
    token = register()["access_token"]
    tree = make_tree(token)

    resp = upload_photos(token, tree["id"], [("files", ("evil.svg", b"<svg/>", "image/svg+xml"))])
    assert resp.status_code == 415

    from app.storage import MAX_PHOTO_BYTES

    resp = upload_photos(
        token, tree["id"], [("files", ("big.png", b"x" * (MAX_PHOTO_BYTES + 1), "image/png"))]
    )
    assert resp.status_code == 413


def test_photo_upload_requires_owner():
    token_a = register()["access_token"]
    token_b = register("bob@example.com", "bob")["access_token"]
    tree = make_tree(token_a)

    resp = client.post(f"/api/trees/{tree['id']}/photos", files=[png_file()])
    assert resp.status_code == 401

    resp = upload_photos(token_b, tree["id"], [png_file()])
    assert resp.status_code == 403


def test_deleting_tree_removes_photo_files():
    from app.storage import UPLOAD_DIR

    token = register()["access_token"]
    tree = make_tree(token)
    photos = upload_photos(token, tree["id"], [png_file()]).json()
    filename = photos[0]["url"].removeprefix("/uploads/")
    assert (UPLOAD_DIR / filename).exists()

    resp = client.delete(f"/api/trees/{tree['id']}", headers=auth_headers(token))
    assert resp.status_code == 204
    assert not (UPLOAD_DIR / filename).exists()


def test_only_owner_can_edit_or_delete():
    token_a = register()["access_token"]
    token_b = register("bob@example.com", "bob")["access_token"]
    tree = make_tree(token_a)

    resp = client.put(
        f"/api/trees/{tree['id']}", json={"name": "Hijacked"}, headers=auth_headers(token_b)
    )
    assert resp.status_code == 403

    resp = client.delete(f"/api/trees/{tree['id']}", headers=auth_headers(token_b))
    assert resp.status_code == 403

    resp = client.put(
        f"/api/trees/{tree['id']}", json={"name": "Renamed"}, headers=auth_headers(token_a)
    )
    assert resp.status_code == 200
    assert resp.json()["name"] == "Renamed"

    resp = client.delete(f"/api/trees/{tree['id']}", headers=auth_headers(token_a))
    assert resp.status_code == 204
    assert client.get(f"/api/trees/{tree['id']}").status_code == 404


BELGRADE_BBOX = {"min_lat": 44.7, "max_lat": 44.9, "min_lng": 20.3, "max_lng": 20.6}


def test_is_admin_defaults_false_and_surfaces_on_me():
    data = register()
    assert data["user"]["is_admin"] is False

    make_admin()
    resp = client.get("/api/auth/me", headers=auth_headers(data["access_token"]))
    assert resp.json()["is_admin"] is True


def test_export_requires_admin():
    token = register()["access_token"]
    make_tree(token, name="Belgrade cherry", lat=44.81, lng=20.46)

    # Unauthenticated.
    resp = client.get("/api/trees/export", params=BELGRADE_BBOX)
    assert resp.status_code == 401

    # Authenticated but not an admin.
    resp = client.get("/api/trees/export", params=BELGRADE_BBOX, headers=auth_headers(token))
    assert resp.status_code == 403


def test_export_geojson_filters_by_area():
    token = register()["access_token"]
    make_tree(token, name="Belgrade cherry", lat=44.81, lng=20.46)
    make_tree(token, name="Paris apple", fruit_type="Apple", lat=48.85, lng=2.35)
    make_admin()

    resp = client.get(
        "/api/trees/export",
        params={**BELGRADE_BBOX, "format": "geojson"},
        headers=auth_headers(token),
    )
    assert resp.status_code == 200
    assert resp.headers["content-type"].startswith("application/geo+json")
    assert "attachment" in resp.headers["content-disposition"]
    assert resp.headers["x-export-count"] == "1"

    data = resp.json()
    assert data["type"] == "FeatureCollection"
    assert len(data["features"]) == 1
    feature = data["features"][0]
    assert feature["geometry"]["coordinates"] == [20.46, 44.81]
    assert feature["properties"]["name"] == "Belgrade cherry"
    assert feature["properties"]["owner"] == "ana"


def test_export_csv_format():
    token = register()["access_token"]
    make_tree(token, name="Belgrade cherry", lat=44.81, lng=20.46)
    make_admin()

    resp = client.get(
        "/api/trees/export",
        params={**BELGRADE_BBOX, "format": "csv"},
        headers=auth_headers(token),
    )
    assert resp.status_code == 200
    assert resp.headers["content-type"].startswith("text/csv")
    lines = resp.text.strip().splitlines()
    assert lines[0].startswith("id,name,category,fruit_type")
    assert len(lines) == 2  # header + one row
    assert "Belgrade cherry" in lines[1]


def test_export_empty_area_is_valid():
    token = register()["access_token"]
    make_tree(token, name="Belgrade cherry", lat=44.81, lng=20.46)
    make_admin()

    resp = client.get(
        "/api/trees/export",
        params={"min_lat": 0, "max_lat": 1, "min_lng": 0, "max_lng": 1},
        headers=auth_headers(token),
    )
    assert resp.status_code == 200
    assert resp.headers["x-export-count"] == "0"
    assert resp.json()["features"] == []


def test_is_admin_migration_adds_column():
    from sqlalchemy import create_engine, text

    from app.migrations import run_migrations

    engine = create_engine("sqlite://")
    with engine.begin() as conn:
        conn.execute(
            text(
                "CREATE TABLE users (id INTEGER PRIMARY KEY, email TEXT, username TEXT, "
                "password_hash TEXT)"
            )
        )
        conn.execute(
            text("INSERT INTO users (id, email, username, password_hash) VALUES (1, 'a', 'a', 'x')")
        )

    run_migrations(engine)

    with engine.connect() as conn:
        rows = conn.execute(text("SELECT is_admin FROM users")).all()
    assert rows == [(0,)]

    # Running again is a no-op.
    run_migrations(engine)


# --- Plant types (managed vocabulary) ---


def add_plant_type(token, category, names):
    return client.post(
        "/api/plant-types",
        json={"category": category, "names": names},
        headers=auth_headers(token),
    )


def test_unknown_plant_type_rejected():
    token = register()["access_token"]
    resp = client.post(
        "/api/trees",
        json={"name": "Mystery", "category": "fruit_tree", "fruit_type": "Dragonfruit",
              "lat": 44.8, "lng": 20.4},
        headers=auth_headers(token),
    )
    assert resp.status_code == 400


def test_plant_types_listed_and_filtered_by_category():
    token = register()["access_token"]
    make_tree(token, fruit_type="Cherry")
    make_tree(token, name="Oak", category="tree", fruit_type="Oak")

    resp = client.get("/api/plant-types")
    assert resp.status_code == 200
    canon = sorted(pt["names"]["en"] for pt in resp.json())
    assert canon == ["Cherry", "Oak"]

    resp = client.get("/api/plant-types", params={"category": "tree"})
    assert [pt["names"]["en"] for pt in resp.json()] == ["Oak"]


def test_user_adds_type_then_it_can_be_used():
    token = register()["access_token"]

    resp = add_plant_type(token, "vine", {"en": "Kiwi", "sr": "Kivi"})
    assert resp.status_code == 201, resp.text
    assert resp.json()["names"] == {"en": "Kiwi", "sr": "Kivi"}

    # The new type now passes the vocabulary check for a plant.
    resp = client.post(
        "/api/trees",
        json={"name": "Kiwi vine", "category": "vine", "fruit_type": "Kiwi",
              "lat": 44.8, "lng": 20.4},
        headers=auth_headers(token),
    )
    assert resp.status_code == 201


def test_add_plant_type_requires_login():
    # Any signed-in user can extend the vocabulary...
    token = register()["access_token"]
    resp = add_plant_type(token, "vine", {"en": "Kiwi", "sr": "Kivi"})
    assert resp.status_code == 201

    # ...but an anonymous request is rejected.
    resp = client.post(
        "/api/plant-types", json={"category": "vine", "names": {"en": "Grape", "sr": "Grožđe"}}
    )
    assert resp.status_code == 401


def test_add_plant_type_requires_every_language():
    token = register()["access_token"]
    resp = add_plant_type(token, "vine", {"en": "Kiwi"})
    assert resp.status_code == 422


def test_duplicate_plant_type_rejected():
    token = register()["access_token"]
    assert add_plant_type(token, "fruit_tree", {"en": "Cherry", "sr": "Trešnja"}).status_code == 201
    # Same canonical name, any casing, is a conflict.
    assert add_plant_type(token, "tree", {"en": "cherry", "sr": "Trešnja"}).status_code == 409


# --- User profiles (contribution catalog) ----------------------------------


def test_profile_catalogs_a_users_contributions():
    session = register()
    token = session["access_token"]
    user_id = session["user"]["id"]

    make_tree(token, fruit_type="Cherry")
    make_tree(token, name="Another cherry", fruit_type="Cherry")
    make_tree(token, name="Oak in the park", category="tree", fruit_type="Oak")

    resp = client.get(f"/api/users/{user_id}/profile")
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["user"]["username"] == "ana"
    assert body["plant_count"] == 3
    assert body["area_count"] == 0
    assert "member_since" in body

    # One badge per distinct type, most-added first: Cherry (2) then Oak (1).
    badges = body["badges"]
    assert [(b["fruit_type"], b["count"]) for b in badges] == [("Cherry", 2), ("Oak", 1)]
    assert badges[0]["category"] == "fruit_tree"
    assert badges[1]["category"] == "tree"


def test_profile_marks_hazard_types():
    session = register()
    token = session["access_token"]
    user_id = session["user"]["id"]

    ensure_plant_type("other", "Poison ivy")
    client.post(
        "/api/trees",
        json={"name": "Nasty patch", "category": "other", "fruit_type": "Poison ivy",
              "hazard": True, "lat": 44.8, "lng": 20.4},
        headers=auth_headers(token),
    )

    badges = client.get(f"/api/users/{user_id}/profile").json()["badges"]
    assert badges == [{"category": "other", "fruit_type": "Poison ivy", "count": 1, "hazard": True}]


def test_profile_unknown_user_is_404():
    assert client.get("/api/users/999999/profile").status_code == 404


# --- Areas -----------------------------------------------------------------

SQUARE = [[20.46, 44.81], [20.47, 44.81], [20.47, 44.82], [20.46, 44.82]]


def make_area(token, **overrides):
    body = {
        "name": "Riverside plum orchard",
        "category": "fruit_tree",
        "fruit_type": "Plum",
        "description": "Rows of plum trees by the water.",
        "season_start": 8,
        "season_end": 9,
        "polygon": SQUARE,
    }
    body.update(overrides)
    ensure_plant_type(body.get("category", "fruit_tree"), body["fruit_type"])
    resp = client.post("/api/areas", json=body, headers=auth_headers(token))
    assert resp.status_code == 201, resp.text
    return resp.json()


def test_create_area_computes_centroid_and_lists():
    token = register()["access_token"]
    area = make_area(token)
    assert area["polygon"] == SQUARE
    assert area["center_lng"] == pytest.approx(20.465)
    assert area["center_lat"] == pytest.approx(44.815)
    assert area["owner"]["username"] == "ana"

    listed = client.get("/api/areas").json()
    assert [a["id"] for a in listed] == [area["id"]]


def test_create_area_requires_auth_and_valid_polygon():
    resp = client.post("/api/areas", json={"name": "x", "fruit_type": "Plum", "polygon": SQUARE})
    assert resp.status_code == 401

    token = register()["access_token"]
    ensure_plant_type("fruit_tree", "Plum")
    resp = client.post(
        "/api/areas",
        json={"name": "x", "fruit_type": "Plum", "polygon": [[20.46, 44.81], [20.47, 44.81]]},
        headers=auth_headers(token),
    )
    assert resp.status_code == 422


def test_area_rejects_unknown_plant_type():
    token = register()["access_token"]
    resp = client.post(
        "/api/areas",
        json={"name": "x", "fruit_type": "Dragonfruit", "polygon": SQUARE},
        headers=auth_headers(token),
    )
    assert resp.status_code == 400


def test_area_bbox_filter_uses_centroid():
    token = register()["access_token"]
    make_area(token)
    # Centroid (44.815, 20.465) is inside this box...
    inside = client.get(
        "/api/areas", params={"min_lat": 44.8, "max_lat": 44.83, "min_lng": 20.4, "max_lng": 20.5}
    ).json()
    assert len(inside) == 1
    # ...and outside this one.
    outside = client.get(
        "/api/areas", params={"min_lat": 45.0, "max_lat": 46.0, "min_lng": 20.4, "max_lng": 20.5}
    ).json()
    assert outside == []


def test_area_ripe_now_filter():
    token = register()["access_token"]
    make_area(token, season_start=month_offset(0), season_end=month_offset(0))
    make_area(token, name="Winter patch", season_start=month_offset(4), season_end=month_offset(5))
    ripe = client.get("/api/areas", params={"ripe_now": "true"}).json()
    assert [a["name"] for a in ripe] == ["Riverside plum orchard"]


def test_update_area_recomputes_centroid_and_enforces_owner():
    token = register()["access_token"]
    area = make_area(token)

    moved = [[10.0, 5.0], [10.1, 5.0], [10.1, 5.1], [10.0, 5.1]]
    resp = client.put(
        f"/api/areas/{area['id']}", json={"polygon": moved}, headers=auth_headers(token)
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["center_lng"] == pytest.approx(10.05)
    assert resp.json()["center_lat"] == pytest.approx(5.05)

    other = register(email="bob@example.com", username="bob")["access_token"]
    resp = client.put(
        f"/api/areas/{area['id']}", json={"name": "hijack"}, headers=auth_headers(other)
    )
    assert resp.status_code == 403


def test_delete_area_enforces_owner():
    token = register()["access_token"]
    area = make_area(token)

    other = register(email="bob@example.com", username="bob")["access_token"]
    assert client.delete(f"/api/areas/{area['id']}", headers=auth_headers(other)).status_code == 403

    assert client.delete(f"/api/areas/{area['id']}", headers=auth_headers(token)).status_code == 204
    assert client.get("/api/areas").json() == []
