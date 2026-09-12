export type Entry = { id: string; value: string };

export type TranscriptItem = {
  id: string;
  role: "user" | "system";
  text: string;
};

export type WheelSession = {
  entries: Entry[];
  picks: string[];
  transcript: TranscriptItem[];
  removeOnPick: boolean;
  expiresAt: number;
};

export type ExtractionResult =
  | { kind: "success"; entries: string[]; sourceColumn?: string }
  | { kind: "clarification"; message: string; availableColumns: string[] }
  | { kind: "error"; message: string };
