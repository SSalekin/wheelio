from pathlib import Path

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse, JSONResponse

from app.graph import extract_entries
from app.schemas import ExtractionResult
from app.validation import validate_upload

app = FastAPI()

STATIC_DIR = Path(__file__).parent / "static"
STATIC_INDEX = STATIC_DIR / "index.html"


@app.post("/api/extract", response_model=ExtractionResult, response_model_by_alias=True)
async def api_extract(
    prompt: str = Form(""),
    image: UploadFile | None = File(None),
) -> ExtractionResult:
    try:
        image_bytes = await validate_upload(image)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    image_media_type = image.content_type if image_bytes is not None else None
    return await extract_entries(prompt, image_bytes, image_media_type)


if STATIC_INDEX.exists():
    from starlette.staticfiles import StaticFiles

    app.mount("/assets", StaticFiles(directory=str(STATIC_DIR / "assets")), name="static-assets")

    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str) -> FileResponse:
        return FileResponse(str(STATIC_INDEX))
