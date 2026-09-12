from fastapi import UploadFile

MAX_UPLOAD_SIZE = 2 * 1024 * 1024 + 1
ALLOWED_TYPES = {"image/png", "image/jpeg"}


async def validate_upload(upload: UploadFile | None) -> bytes | None:
    if upload is None or upload.filename is None:
        return None

    if upload.content_type not in ALLOWED_TYPES:
        raise ValueError("Upload a PNG or JPEG image no larger than 2 MB.")

    content = await upload.read()
    if len(content) > MAX_UPLOAD_SIZE:
        raise ValueError("Upload a PNG or JPEG image no larger than 2 MB.")

    return content
