from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class SuccessResult(BaseModel):
    model_config = ConfigDict(extra="forbid", populate_by_name=True)

    kind: Literal["success"] = "success"
    entries: list[str]
    source_column: str | None = Field(default=None, serialization_alias="sourceColumn")


class ClarificationResult(BaseModel):
    model_config = ConfigDict(extra="forbid", populate_by_name=True)

    kind: Literal["clarification"] = "clarification"
    message: str
    available_columns: list[str] = Field(
        default_factory=list, serialization_alias="availableColumns"
    )


class ErrorResult(BaseModel):
    model_config = ConfigDict(extra="forbid", populate_by_name=True)

    kind: Literal["error"] = "error"
    message: str


class FaceDetectionResult(BaseModel):
    model_config = ConfigDict(extra="forbid", populate_by_name=True)

    kind: Literal["faces"] = "faces"
    faces: list[str]
    count: int


ExtractionResult = SuccessResult | ClarificationResult | ErrorResult | FaceDetectionResult
