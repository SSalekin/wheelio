import type { ExtractionResult } from "./types";

export async function requestExtraction(
  prompt: string,
  image: File | null,
): Promise<ExtractionResult> {
  const formData = new FormData();
  formData.append("prompt", prompt);
  if (image) {
    formData.append("image", image);
  }

  try {
    const response = await fetch("/api/extract", {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      return {
        kind: "error",
        message: "The service is unavailable. Please try again.",
      };
    }

    return (await response.json()) as ExtractionResult;
  } catch {
    return {
      kind: "error",
      message: "The service is unavailable. Please try again.",
    };
  }
}
