import os
from pathlib import Path

UPLOAD_DIR = Path(os.environ.get("FLORA_UPLOAD_DIR", "./uploads"))
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

MAX_PHOTOS_PER_TREE = 3
MAX_PHOTO_BYTES = 5 * 1024 * 1024  # 5 MB

# Content types we accept, mapped to the extension we store on disk.
ALLOWED_PHOTO_TYPES = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
}
