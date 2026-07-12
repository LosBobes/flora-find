# 🌳 FloraFind

A community map of neighborhood plants. Register fruit trees, ornamental trees, evergreens,
shrubs, flowerbeds and vines you find around you, flag hazards like poison ivy, and search for
fruit (or flowers) near you — built on [MapLibre GL](https://maplibre.org/) and
[OpenStreetMap](https://www.openstreetmap.org/), fully open source with no map API key required.

- **Backend:** FastAPI + SQLAlchemy + SQLite (swappable via `FLORA_DATABASE_URL`)
- **Frontend:** React (Vite) + [`@vis.gl/react-maplibre`](https://visgl.github.io/react-maplibre/)
- **Auth:** email/password registration with JWT bearer tokens

## Features

- Interactive OpenStreetMap map (MapLibre GL) with emoji plant markers and popups — no API key needed
- Register any plant by clicking its exact spot on the map (name, type, species, season, notes)
- Plant categories: fruit trees, general (deciduous) trees, evergreens/conifers, shrubs/bushes, flowerbeds, vines and more
- ☠️ Hazard flag for poisonous or dangerous plants (poison ivy, giant hogweed…) with
  red warning markers and a prominent banner — filterable via `?hazard=true|false`
- Attach up to 3 photos per plant — thumbnails show in the info window
- Structured harvest/blooming seasons (start/end month) with a "🟢 In season" filter and badges
- Free-text search across names, types, species and notes
- Filter by category and type; the list auto-follows the map viewport
- "📍 Near me" — geolocate, center the map on you, and list trees within 5 km with distances
- Radius search API (`?lat=&lng=&radius_km=`) with distance-sorted results
- Community verification: "Still there / Gone" votes (one per user per tree), "last confirmed
  X days ago", and a ⚠️ flag once 3+ people report a tree gone
- Only the person who registered a tree can edit or delete it
- 🛠️ **Admin data export** — admins can drag a rectangle on the map and download every plant
  inside it as GeoJSON or CSV
- Ready-to-load sample data for Belgrade and Serbia (`backend/seed.py`)

## Getting started

The map uses OpenStreetMap tiles rendered with MapLibre GL — there is nothing to sign up
for and no API key to configure.

### 1. Backend

```bash
cd backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

API docs at http://localhost:8000/docs. The SQLite database (`florafind.db`) is created
automatically on first start.

#### Seed sample data (Belgrade & Serbia)

To populate the map with ~37 real Belgrade parks/neighbourhoods (Kalemegdan, Ada Ciganlija,
Tašmajdan, Košutnjak, Zemun, Topčider…) plus a few entries in Novi Sad, Niš and Subotica:

```bash
cd backend
.venv/bin/python seed.py          # only seeds if the database has no plants yet
.venv/bin/python seed.py --force  # add the sample plants even if others exist
```

This also creates two accounts:

| Email | Password | Role |
| --- | --- | --- |
| `admin@florafind.rs` | `admin1234` | **admin** (can export map areas) |
| `seed@florafind.rs` | `seed1234` | contributor (owns the seeded plants) |

> Change these credentials before using the seed script anywhere public.

### 2. Frontend

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:5173 — the dev server proxies `/api/*` to the backend on port 8000.

## Configuration

| Variable | Where | Default | Purpose |
| --- | --- | --- | --- |
| `FLORA_DATABASE_URL` | backend env | `sqlite:///./florafind.db` | SQLAlchemy database URL |
| `FLORA_UPLOAD_DIR` | backend env | `./uploads` | Directory for uploaded tree photos |
| `FLORA_JWT_SECRET` | backend env | dev value | JWT signing secret — **set in production** |
| `FLORA_CORS_ORIGINS` | backend env | `http://localhost:5173,...` | Comma-separated allowed origins |

## API overview

| Method | Path | Auth | Description |
| --- | --- | --- | --- |
| `POST` | `/api/auth/register` | — | Create account, returns JWT |
| `POST` | `/api/auth/login` | — | Log in, returns JWT |
| `GET` | `/api/auth/me` | ✅ | Current user |
| `GET` | `/api/trees` | — | List/search trees (`q`, `fruit_type`, `ripe_now`, bbox `min_lat…max_lng`, radius `lat`+`lng`+`radius_km`) |
| `GET` | `/api/trees/fruit-types` | — | Distinct fruit types (for filters) |
| `GET` | `/api/trees/export` | ✅ admin | Export plants in an area (`min_lat`, `max_lat`, `min_lng`, `max_lng`, `format=geojson\|csv`) |
| `GET` | `/api/trees/{id}` | — | Tree details |
| `POST` | `/api/trees` | ✅ | Register a tree |
| `PUT` | `/api/trees/{id}` | ✅ owner | Update own tree |
| `DELETE` | `/api/trees/{id}` | ✅ owner | Delete own tree |
| `POST` | `/api/trees/{id}/confirmations` | ✅ | Vote `{"status": "present"\|"gone"}` — one vote per user, latest wins |
| `POST` | `/api/trees/{id}/photos` | ✅ owner | Upload photos (multipart `files`, max 3/tree, JPEG/PNG/WebP ≤ 5 MB) |
| `DELETE` | `/api/trees/{id}/photos/{photo_id}` | ✅ owner | Remove a photo |

Uploaded photos are served from `/uploads/…`.

## Tests

```bash
cd backend
.venv/bin/python -m pytest tests/ -q
```

CI (`.github/workflows/ci.yml`) runs the pytest suite and the frontend production build
on every pull request and on pushes to `main`.

## Deployment

The repo ships with a multi-stage `Dockerfile` (frontend production build + FastAPI backend
serving the API, `/uploads` and the built frontend from one origin) and a `docker-compose.yml`
with Postgres:

```bash
# .env next to docker-compose.yml
cat > .env <<'EOF'
FLORA_JWT_SECRET=a-long-random-secret
EOF

docker compose up --build
```

Open http://localhost:8000 — the app, API and uploaded photos are all served from the same
origin, backed by Postgres (`FLORA_DATABASE_URL` is preconfigured in the compose file, and
uploads persist in a named volume). Schema migrations run automatically at app startup
against whichever database `FLORA_DATABASE_URL` points to.

| Variable | Purpose |
| --- | --- |
| `FLORA_FRONTEND_DIST` | Path to a frontend build for same-origin serving (set in the image) |
