# 🌳 FloraFind

A community map of fruit trees. Register apple, cherry, fig (or any other) trees you find in
your neighborhood, and search for fruit near you — built on Google Maps.

- **Backend:** FastAPI + SQLAlchemy + SQLite (swappable via `FLORA_DATABASE_URL`)
- **Frontend:** React (Vite) + [`@vis.gl/react-google-maps`](https://visgl.github.io/react-google-maps/)
- **Auth:** email/password registration with JWT bearer tokens

## Features

- Interactive Google Map with emoji fruit markers and info windows
- Register a tree by clicking its exact spot on the map (name, fruit, species, season, notes)
- Attach up to 3 photos per tree — thumbnails show in the info window
- Structured harvest seasons (start/end month) with a "🟢 Ripe now" filter and in-season badges
- Free-text search across names, fruits, species and notes
- Filter by fruit type; the list auto-follows the map viewport
- "📍 Near me" — geolocate, center the map on you, and list trees within 5 km with distances
- Radius search API (`?lat=&lng=&radius_km=`) with distance-sorted results
- Community verification: "Still there / Gone" votes (one per user per tree), "last confirmed
  X days ago", and a ⚠️ flag once 3+ people report a tree gone
- Only the person who registered a tree can edit or delete it

## Getting started

### 1. Google Maps API key

Create an API key in the [Google Cloud Console](https://console.cloud.google.com/google/maps-apis)
with the **Maps JavaScript API** enabled, then:

```bash
cp frontend/.env.example frontend/.env
# edit frontend/.env and set VITE_GOOGLE_MAPS_API_KEY
```

### 2. Backend

```bash
cd backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

API docs at http://localhost:8000/docs. The SQLite database (`florafind.db`) is created
automatically on first start.

### 3. Frontend

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:5173 — the dev server proxies `/api/*` to the backend on port 8000.

## Configuration

| Variable | Where | Default | Purpose |
| --- | --- | --- | --- |
| `VITE_GOOGLE_MAPS_API_KEY` | frontend `.env` | — | Google Maps JS API key (required) |
| `VITE_GOOGLE_MAPS_MAP_ID` | frontend `.env` | `DEMO_MAP_ID` | Map ID for Advanced Markers |
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
VITE_GOOGLE_MAPS_API_KEY=your-maps-key
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
| `VITE_GOOGLE_MAPS_API_KEY` / `VITE_GOOGLE_MAPS_MAP_ID` | Build args for the frontend stage |
