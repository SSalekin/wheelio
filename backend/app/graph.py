import asyncio
from typing import Annotated, Literal, TypedDict

from langchain_core.messages import HumanMessage, SystemMessage
from langchain_openai import ChatOpenAI
from langgraph.graph import END, START, StateGraph
from pydantic import BaseModel

from app.config import OPENROUTER_BASE_URL, get_settings
from app.schemas import ClarificationResult, ErrorResult, ExtractionResult, SuccessResult


class ModelExtraction(BaseModel):
    status: Literal["success", "clarification", "error"]
    entries: list[str] = []
    source_column: str | None = None
    message: str | None = None
    available_columns: list[str] = []


class GraphState(TypedDict):
    prompt: str
    image_bytes: bytes | None
    image_media_type: str | None
    result: ExtractionResult


SYSTEM_PROMPT = """\
You extract structured entry lists from user input for a random-wheel spinner.

Rules:
- Extract only the entries the user requests.
- When the user asks for a specific column, use it. If no column is requested and the data has headers, infer the most likely name column.
- If the selection is ambiguous (e.g., multiple plausible columns and no column requested), return clarification with the detected column headers.
- Return ONLY the structured schema. Never return free-form prose.
- For image inputs, read the text/table from the image and extract entries accordingly.
"""


def _build_content(
    prompt: str, image_bytes: bytes | None, image_media_type: str | None
) -> list[dict]:
    content: list[dict] = []
    if image_bytes and image_media_type:
        import base64

        b64 = base64.b64encode(image_bytes).decode()
        content.append(
            {
                "type": "image_url",
                "image_url": {"url": f"data:{image_media_type};base64,{b64}"},
            }
        )
    content.append({"type": "text", "text": prompt})
    return content


def _normalize_entries(raw: list[str]) -> list[str]:
    seen: set[str] = set()
    result: list[str] = []
    for item in raw:
        trimmed = item.strip()
        if not trimmed:
            continue
        key = trimmed.lower()
        if key in seen:
            continue
        seen.add(key)
        result.append(trimmed)
    return result


async def _extract_node(state: GraphState) -> dict:
    settings = get_settings()
    llm = ChatOpenAI(
        model=settings.openrouter_model,
        api_key=settings.openrouter_api_key,
        base_url=OPENROUTER_BASE_URL,
        timeout=60,
        max_retries=0,
    )

    structured_llm = llm.with_structured_output(ModelExtraction)

    content = _build_content(state["prompt"], state["image_bytes"], state["image_media_type"])
    messages = [SystemMessage(content=SYSTEM_PROMPT), HumanMessage(content=content)]

    model_result = await structured_llm.ainvoke(messages)

    if model_result.status == "clarification":
        result: ExtractionResult = ClarificationResult(
            message=model_result.message or "Please clarify your request.",
            available_columns=model_result.available_columns,
        )
    elif model_result.status == "error":
        result = ErrorResult(
            message=model_result.message or "Could not extract entries from the input."
        )
    else:
        entries = _normalize_entries(model_result.entries)
        if not entries:
            result = ErrorResult(message="No usable entries were found.")
        else:
            result = SuccessResult(
                entries=entries,
                source_column=model_result.source_column,
            )

    return {"result": result}


graph = StateGraph(GraphState).add_node("extract", _extract_node).add_edge(START, "extract").add_edge("extract", END)
compiled_graph = graph.compile()


async def extract_entries(
    prompt: str,
    image_bytes: bytes | None,
    image_media_type: str | None,
) -> ExtractionResult:
    try:
        state: GraphState = {
            "prompt": prompt,
            "image_bytes": image_bytes,
            "image_media_type": image_media_type,
            "result": ErrorResult(message="Extraction could not be completed. Please try a clearer input."),
        }
        final_state = await asyncio.wait_for(
            compiled_graph.ainvoke(state),
            timeout=60,
        )
        return final_state["result"]
    except asyncio.TimeoutError:
        return ErrorResult(message="Extraction could not be completed. Please try a clearer input.")
    except Exception:
        return ErrorResult(message="Extraction could not be completed. Please try a clearer input.")
