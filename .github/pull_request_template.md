<!--
Thanks for contributing to FloraFind! Fill in the sections below.
Delete any that don't apply. Keep the title short and imperative,
e.g. "Add evergreen tree category".
-->

## Summary

<!-- What does this PR do, and why? One or two sentences is fine. -->

## Changes

<!-- Bullet the notable changes. Call out anything a reviewer should look at first. -->

-

## Area

<!-- Check everything this PR touches. -->

- [ ] Backend (FastAPI / SQLAlchemy)
- [ ] Frontend (React / Vite / MapLibre)
- [ ] Database schema / migrations (`backend/app/migrations.py`)
- [ ] Sample / seed data (`backend/app/sample_data.py`)
- [ ] CI / deploy / tooling (`.github/`, `Dockerfile`, `docker-compose*`)
- [ ] Docs (`README`, `CLAUDE.md`)

## Testing

<!-- How did you verify this? Paste commands and note anything that can't be
     covered by automated tests (e.g. manual map interactions). -->

- [ ] `cd backend && .venv/bin/python -m pytest tests/ -q` passes
- [ ] `cd frontend && npm run build` succeeds
- [ ] Manually verified the affected flow

## Screenshots

<!-- Required for user-visible frontend changes. Before / after if relevant. -->

## Checklist

- [ ] Season wrap logic kept in sync across `models.month_in_season()`, the
      `ripe_now` SQL filter, and the frontend `seasons.js` (if seasons touched)
- [ ] New schema changes added to `migrations.py`, not a migration framework
- [ ] No secrets, API keys, or `.env` values committed
