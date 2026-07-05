import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from .database import Base, engine
from .routers import auth_routes, tree_routes
from .storage import UPLOAD_DIR

Base.metadata.create_all(bind=engine)

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
)

app.include_router(auth_routes.router)
app.include_router(tree_routes.router)

app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")


@app.get("/api/health")
def health():
    return {"status": "ok"}
