# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

FloraFind is a community map of neighborhood plants (fruit trees, ornamental trees,
shrubs, flowerbeds, vines) built on MapLibre GL + OpenStreetMap — **no map API key
required**. FastAPI/SQLAlchemy backend, React/Vite frontend, JWT email-password auth.

## Commands

### Backend (`backend/`)
```bash
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000        # API + docs at :8000/docs
.venv/bin/python -m pytest tests/ -q             # run test suite
.venv/bin/python -m pytest tests/test_api.py::test_name -q   # single test
.venv/bin/python seed.py [--force]               # load Belgrade/Serbia sample data + admin/seed accounts
```

### Frontend (`frontend/`)
```bash
npm install
npm run dev        # Vite dev server on :5173, proxies /api/* to :8000
npm run build      # production build (this is what CI checks)
```

CI (`.github/workflows/ci.yml`) runs backend pytest and the frontend production build
on every PR and push to `main`. There is no linter configured; there are **no frontend tests**.

## Architecture

### Backend request flow
`main.py` wires everything at import time: it runs `run_migrations(engine)` **before**
`Base.metadata.create_all()`, mounts CORS, includes the two routers, mounts `/uploads`
(static photos), and — if `FLORA_FRONTEND_DIST` points at a build — mounts the frontend
at `/` **last** so API routes keep precedence (this is how the Docker image serves
everything from one origin).

- `database.py` — engine + `get_db()` session dependency. `FLORA_DATABASE_URL` swaps
  SQLite (default, dev) for Postgres (docker-compose) transparently.
- `models.py` — `User`, `Tree`, `TreeConfirmation`, `TreePhoto`. Notable: derived
  properties live on `Tree` (`in_season`, `last_confirmed_at`, `gone_reports`,
  `flagged_gone`). `GONE_FLAG_THRESHOLD = 3` gone-votes flags a tree. `PLANT_CATEGORIES`
  is the canonical category tuple. Season is stored as `season_start`/`season_end`
  month integers and **wraps around the new year** (e.g. Nov→Feb) — this wrap logic is
  duplicated in three places: `month_in_season()` (Python), the `ripe_now` SQL filter in
  `tree_routes.list_trees`, and the frontend; keep them in sync.
- `migrations.py` — hand-rolled additive startup migrations for columns
  `create_all` can't add to existing tables (`is_admin`, `category`, `hazard`,
  `season_start/end`). Runs on every startup, idempotent via column introspection.
  Backfills structured seasons from a legacy free-text `season` column. Add new schema
  changes here, not with a migration framework.
- `auth.py` — JWT (PyJWT, HS256, 7-day TTL) + PBKDF2-SHA256 password hashing (no
  passlib/bcrypt). Dependencies: `get_current_user` (401) and `get_current_admin` (403).
  `FLORA_JWT_SECRET` **must** be set in production.
- `storage.py` — photo constraints: max 3/tree, 5 MB, JPEG/PNG/WebP only.
- `routers/tree_routes.py` — the bulk of the app. Single `GET /api/trees` endpoint does
  free-text search, category/type/hazard filters, `ripe_now`, viewport bbox **and**
  radius search. Radius search prefilters with a bbox in SQL then refines with a Python
  haversine (`over-fetches limit*4`, sorts by distance). Ownership is enforced on
  update/delete/photos (`owner_id == current_user.id → else 403`). Export is admin-only,
  returns a `Response` with GeoJSON/CSV and an `X-Export-Count` header.

### Frontend
Single-page React app, no router. `App.jsx` owns nearly all state (filters, selection,
add/edit mode, export area) and orchestrates children. `api.js` is the only HTTP layer —
a thin `fetch` wrapper; token/user persisted in `localStorage` (`florafind_*` keys).
`AuthContext.jsx` provides `user`/`login`/`logout`. Components: `MapView` (MapLibre map,
markers, click-to-place, rectangle draw for export), `TreeForm`, `TreeDetails`,
`AuthModal`, `ExportPanel`. Shared helpers: `fruitIcons.js` (emoji per category/type),
`seasons.js` (month formatting — mirror of backend season logic).

The tree list auto-follows the map viewport via debounced bbox refetches, **except**
during text search (search is global, ignores bounds — see `refreshTrees` in `App.jsx`).

## Configuration (backend env)

| Variable | Default | Purpose |
| --- | --- | --- |
| `FLORA_DATABASE_URL` | `sqlite:///./florafind.db` | SQLAlchemy URL (Postgres in docker-compose) |
| `FLORA_UPLOAD_DIR` | `./uploads` | Uploaded photo directory |
| `FLORA_JWT_SECRET` | dev value | JWT signing secret — set in production |
| `FLORA_CORS_ORIGINS` | `localhost:5173,...` | Comma-separated allowed origins |
| `FLORA_FRONTEND_DIST` | unset | Path to frontend build for same-origin serving (set in Docker image) |

## Deployment

Multi-stage `Dockerfile` builds the frontend then serves it + API + `/uploads` from one
FastAPI origin. `docker compose up --build` runs it against Postgres (needs
`FLORA_JWT_SECRET` in a `.env`). Migrations run automatically at startup against whatever
`FLORA_DATABASE_URL` points to.
</content>
</invoke>
