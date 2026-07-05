import os
import sys
import tempfile

os.environ["FLORA_DATABASE_URL"] = "sqlite://"  # in-memory
os.environ["FLORA_UPLOAD_DIR"] = tempfile.mkdtemp(prefix="florafind-uploads-")

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


def make_tree(token, **overrides):
    body = {
        "name": "Old cherry by the school",
        "fruit_type": "Cherry",
        "lat": 44.8125,
        "lng": 20.4612,
        "description": "Sweet dark cherries in June.",
        "season": "June",
    }
    body.update(overrides)
    resp = client.post("/api/trees", json=body, headers=auth_headers(token))
    assert resp.status_code == 201, resp.text
    return resp.json()


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
