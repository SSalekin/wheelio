import type { Entry } from "../types";

const NAME_LIKE = /^[A-Za-z]+(?:[' -][A-Za-z]+)*$/;

function titleCase(value: string): string {
  return value
    .toLowerCase()
    .replace(/(?:^|[\s'-])\S/g, (c) => c.toUpperCase());
}

function isNameLike(value: string): boolean {
  return NAME_LIKE.test(value);
}

function splitLine(line: string): string[] {
  if (line.includes(",")) {
    return line.split(",").map((p) => p.trim()).filter((p) => p.length > 0);
  }
  return [line.trim()];
}

export function parseSimpleList(text: string): string[] | null {
  const trimmed = text.trim();
  if (!trimmed) return null;

  if (trimmed.includes("\t")) return null;

  const lines = trimmed.split("\n").filter((l) => l.trim() !== "");
  if (lines.length === 0) return null;

  if (lines.length > 1) {
    const commaLineCount = lines.filter((l) => l.includes(",")).length;
    if (commaLineCount >= 2) return null;

    const values: string[] = [];
    for (const line of lines) {
      values.push(...splitLine(line));
    }
    return values;
  }

  const line = lines[0].trim();
  if (line.includes(",")) {
    const parts = line.split(",").map((p) => p.trim());
    const nonEmpty = parts.filter((p) => p.length > 0);
    if (nonEmpty.length > 1) return nonEmpty;
  }

  if (line.includes("  ")) {
    return null;
  }

  return [line];
}

export function normalizeEntries(values: string[]): Entry[] {
  const seen = new Map<string, Entry>();

  for (const raw of values) {
    const trimmed = raw.trim();
    if (!trimmed) continue;

    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;

    const display = isNameLike(trimmed) ? titleCase(trimmed) : trimmed;
    const entry: Entry = { id: crypto.randomUUID(), value: display };
    seen.set(key, entry);
  }

  return Array.from(seen.values());
}
