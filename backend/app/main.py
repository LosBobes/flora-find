import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from .database import Base, SessionLocal, engine
from .migrations import run_migrations
from .plant_type_seed import backfill_plant_types
from .routers import auth_routes, plant_type_routes, tree_routes
from .storage import UPLOAD_DIR

run_migrations(engine)
Base.metadata.create_all(bind=engine)

# Register a plant type for any fruit_type already in use (e.g. seeded data or a
# database from before plant types existed) so the vocabulary is never empty.
with SessionLocal() as _db:
    backfill_plant_types(_db)

app = FastAPI(
    title="FloraFind API",
    description="Register and search fruit trees in your vicinity.",
    version="1.0.0",
)

allowed_origins = os.environ.get(
    "FLORA_CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173"
).split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["Content-Disposition", "X-Export-Count"],
)

app.include_router(auth_routes.router)
app.include_router(plant_type_routes.router)
app.include_router(tree_routes.router)

app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")


@app.get("/api/health")
def health():
    return {"status": "ok"}


# In production the frontend build is served from the same origin (see Dockerfile).
# Mounted last so API routes keep precedence.
frontend_dist = os.environ.get("FLORA_FRONTEND_DIST", "")
if frontend_dist and os.path.isdir(frontend_dist):
    app.mount("/", StaticFiles(directory=frontend_dist, html=True), name="frontend")
