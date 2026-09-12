import type { ExtractionResult, TranscriptItem } from "./types";

export async function requestExtraction(
  prompt: string,
  image: File | null,
  history?: TranscriptItem[],
): Promise<ExtractionResult> {
  const formData = new FormData();

  if (history && history.length > 0) {
    const historyText = history
      .map((item) => `${item.role === "user" ? "User" : "System"}: ${item.text}`)
      .join("\n");
    formData.append("prompt", `Previous conversation:\n${historyText}\n\nUser: ${prompt}`);
  } else {
    formData.append("prompt", prompt);
  }

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
