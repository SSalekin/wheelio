import asyncio
import base64
import io
from typing import TypedDict

from langchain_core.messages import HumanMessage
from langchain_openai import ChatOpenAI
from langgraph.graph import END, START, StateGraph
from PIL import Image
from pydantic import BaseModel

from app.config import OPENROUTER_BASE_URL, get_settings
from app.schemas import ErrorResult, ExtractionResult, FaceDetectionResult

MAX_FACES = 25
MAX_FACE_STORAGE_BYTES = 500 * 1024  # 500KB


class ClassificationResult(BaseModel):
    has_faces: bool


class FaceBox(BaseModel):
    x1: int
    y1: int
    x2: int
    y2: int


class FaceDetectionResponse(BaseModel):
    faces: list[FaceBox]


class FaceGraphState(TypedDict):
    image_bytes: bytes
    image_media_type: str
    has_faces: bool
    faces: list[str]
    result: ExtractionResult


CLASSIFIER_PROMPT = """\
You are an image classifier. Look at the image and determine if it primarily contains people's faces.

Rules:
- Return has_faces: true if the image contains one or more recognizable human faces
- Return has_faces: false if the image contains text, documents, tables, objects, scenery, or non-face content
- Even if faces are present but the image is primarily a document or table, return false
- Focus on whether faces are the PRIMARY subject of the image
"""

FACE_DETECTION_PROMPT = """\
You are a face detection system. Look at the image and identify all human faces.

For each face detected, return its bounding box coordinates as [x1, y1, x2, y2] where:
- x1, y1 = top-left corner
- x2, y2 = bottom-right corner
- Coordinates are in pixels relative to the image dimensions

Rules:
- Detect ALL visible faces, even partial or profile views
- Maximum 25 faces
- Return precise bounding boxes that tightly fit each face
- Include some margin around the face for hair and context
- Do not include non-face objects
"""


def _build_content(image_bytes: bytes, image_media_type: str, text: str) -> list[dict]:
    b64 = base64.b64encode(image_bytes).decode()
    return [
        {
            "type": "image_url",
            "image_url": {"url": f"data:{image_media_type};base64,{b64}"},
        },
        {"type": "text", "text": text},
    ]


def _crop_face(
    image_bytes: bytes, bbox: FaceBox, image_media_type: str
) -> str | None:
    try:
        img = Image.open(io.BytesIO(image_bytes))
        width, height = img.size

        x1 = max(0, min(bbox.x1, width))
        y1 = max(0, min(bbox.y1, height))
        x2 = max(0, min(bbox.x2, width))
        y2 = max(0, min(bbox.y2, height))

        if x2 <= x1 or y2 <= y1:
            return None

        face = img.crop((x1, y1, x2, y2))
        face.thumbnail((200, 200))

        buf = io.BytesIO()
        fmt = "PNG" if "png" in image_media_type else "JPEG"
        save_kwargs = {"format": fmt}
        if fmt == "JPEG":
            save_kwargs["quality"] = 85
        face.save(buf, **save_kwargs)

        return base64.b64encode(buf.getvalue()).decode()
    except Exception:  # noqa: BLE001
        return None


async def _classify_node(state: FaceGraphState) -> dict:
    settings = get_settings()
    llm = ChatOpenAI(
        model=settings.openrouter_face_model,
        api_key=settings.openrouter_api_key,
        base_url=OPENROUTER_BASE_URL,
        timeout=60,
        max_retries=0,
    )
    structured_llm = llm.with_structured_output(ClassificationResult)

    content = _build_content(
        state["image_bytes"], state["image_media_type"], CLASSIFIER_PROMPT
    )
    messages = [HumanMessage(content=content)]

    result = await structured_llm.ainvoke(messages)
    return {"has_faces": result.has_faces}


async def _detect_faces_node(state: FaceGraphState) -> dict:
    settings = get_settings()
    llm = ChatOpenAI(
        model=settings.openrouter_face_model,
        api_key=settings.openrouter_api_key,
        base_url=OPENROUTER_BASE_URL,
        timeout=60,
        max_retries=0,
    )
    structured_llm = llm.with_structured_output(FaceDetectionResponse)

    content = _build_content(
        state["image_bytes"], state["image_media_type"], FACE_DETECTION_PROMPT
    )
    messages = [HumanMessage(content=content)]

    response = await structured_llm.ainvoke(messages)

    cropped_faces: list[str] = []
    total_bytes = 0

    for bbox in response.faces[:MAX_FACES]:
        crop = _crop_face(state["image_bytes"], bbox, state["image_media_type"])
        if crop is None:
            continue

        crop_bytes = len(base64.b64decode(crop))
        if total_bytes + crop_bytes > MAX_FACE_STORAGE_BYTES:
            break

        cropped_faces.append(crop)
        total_bytes += crop_bytes

    return {"faces": cropped_faces}


async def _route_after_classify(state: FaceGraphState) -> str:
    return "detect_faces" if state["has_faces"] else "no_faces"


async def _no_faces_node(state: FaceGraphState) -> dict:
    return {
        "result": ErrorResult(
            message="No faces detected. Please upload a different image."
        )
    }


async def _finalize_node(state: FaceGraphState) -> dict:
    if not state["faces"]:
        return {
            "result": ErrorResult(message="No faces detected. Please upload a different image.")
        }
    return {
        "result": FaceDetectionResult(faces=state["faces"], count=len(state["faces"]))
    }


graph = (
    StateGraph(FaceGraphState)
    .add_node("classify", _classify_node)
    .add_node("detect_faces", _detect_faces_node)
    .add_node("no_faces", _no_faces_node)
    .add_node("finalize", _finalize_node)
    .add_edge(START, "classify")
    .add_conditional_edges("classify", _route_after_classify)
    .add_edge("detect_faces", "finalize")
    .add_edge("no_faces", END)
    .add_edge("finalize", END)
)

compiled_face_graph = graph.compile()


async def detect_faces(
    image_bytes: bytes, image_media_type: str
) -> ExtractionResult:
    import logging
    logger = logging.getLogger(__name__)

    try:
        state: FaceGraphState = {
            "image_bytes": image_bytes,
            "image_media_type": image_media_type,
            "has_faces": False,
            "faces": [],
            "result": ErrorResult(message="Face detection failed. Please try again."),
        }
        final_state = await asyncio.wait_for(
            compiled_face_graph.ainvoke(state),
            timeout=60,
        )
        return final_state["result"]
    except TimeoutError:
        logger.exception("Face detection timed out")
        return ErrorResult(message="Face detection failed. Please try again.")
    except Exception:
        logger.exception("Face detection error")
        return ErrorResult(message="Face detection failed. Please try again.")


async def classify_image(image_bytes: bytes, image_media_type: str) -> bool:
    """Return True if the image primarily contains faces."""
    settings = get_settings()
    llm = ChatOpenAI(
        model=settings.openrouter_face_model,
        api_key=settings.openrouter_api_key,
        base_url=OPENROUTER_BASE_URL,
        timeout=60,
        max_retries=0,
    )
    structured_llm = llm.with_structured_output(ClassificationResult)
    content = _build_content(image_bytes, image_media_type, CLASSIFIER_PROMPT)
    result = await structured_llm.ainvoke([HumanMessage(content=content)])
    return result.has_faces
