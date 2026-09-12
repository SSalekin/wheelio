import { useCallback, useEffect, useState } from "react";
import { requestExtraction } from "./api";
import ChatPanel from "./components/ChatPanel";
import { normalizeEntries, parseSimpleList } from "./lib/entries";
import { clearSession, loadSession, saveSession } from "./lib/session";
import type { Entry, TranscriptItem, WheelSession } from "./types";

function createEmptySession(): WheelSession {
  return {
    entries: [],
    picks: [],
    transcript: [],
    removeOnPick: true,
    expiresAt: 0,
  };
}

export default function App() {
  const [session, setSession] = useState<WheelSession>(() => {
    const loaded = loadSession(Date.now());
    return loaded ?? createEmptySession();
  });
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    setSession((prev) => saveSession(prev, Date.now()));
  }, [session.entries, session.picks, session.transcript]);

  const handleEntriesChange = useCallback((entries: Entry[]) => {
    setSession((prev) => saveSession({ ...prev, entries }, Date.now()));
  }, []);

  const handlePick = useCallback(
    (value: string, remove: boolean) => {
      setSession((prev) => {
        const newPicks = [...prev.picks, value];
        const newEntries = remove
          ? prev.entries.filter((e) => e.value !== value)
          : prev.entries;
        return saveSession(
          { ...prev, entries: newEntries, picks: newPicks },
          Date.now(),
        );
      });
    },
    [],
  );

  const handleReset = useCallback(() => {
    clearSession();
    setSession(createEmptySession());
  }, []);

  const handleSubmit = useCallback(
    async (prompt: string, image: File | null) => {
      const userMessage: TranscriptItem = {
        id: crypto.randomUUID(),
        role: "user",
        text: prompt || "(image)",
      };

      setSession((prev) =>
        saveSession(
          { ...prev, transcript: [...prev.transcript, userMessage] },
          Date.now(),
        ),
      );

      if (!image) {
        const localEntries = parseSimpleList(prompt);
        if (localEntries) {
          const normalized = normalizeEntries(localEntries);
          if (normalized.length > 0) {
            const systemMessage: TranscriptItem = {
              id: crypto.randomUUID(),
              role: "system",
              text: `Created wheel with ${normalized.length} entries.`,
            };
            setSession((prev) =>
              saveSession(
                {
                  ...prev,
                  entries: normalized,
                  picks: [],
                  transcript: [...prev.transcript, systemMessage],
                },
                Date.now(),
              ),
            );
            return;
          } else {
            const systemMessage: TranscriptItem = {
              id: crypto.randomUUID(),
              role: "system",
              text: "No usable entries were found.",
            };
            setSession((prev) =>
              saveSession(
                { ...prev, transcript: [...prev.transcript, systemMessage] },
                Date.now(),
              ),
            );
            return;
          }
        }
      }

      setIsLoading(true);
      try {
        const result = await requestExtraction(prompt, image);

        if (result.kind === "success") {
          const normalized = normalizeEntries(result.entries);
          if (normalized.length > 0) {
            const sourceText = result.sourceColumn
              ? ` from column "${result.sourceColumn}"`
              : "";
            const systemMessage: TranscriptItem = {
              id: crypto.randomUUID(),
              role: "system",
              text: `Created wheel with ${normalized.length} entries${sourceText}.`,
            };
            setSession((prev) =>
              saveSession(
                {
                  ...prev,
                  entries: normalized,
                  picks: [],
                  transcript: [...prev.transcript, systemMessage],
                },
                Date.now(),
              ),
            );
          } else {
            const systemMessage: TranscriptItem = {
              id: crypto.randomUUID(),
              role: "system",
              text: "No usable entries were found.",
            };
            setSession((prev) =>
              saveSession(
                { ...prev, transcript: [...prev.transcript, systemMessage] },
                Date.now(),
              ),
            );
          }
        } else {
          const systemMessage: TranscriptItem = {
            id: crypto.randomUUID(),
            role: "system",
            text: result.message,
          };
          setSession((prev) =>
            saveSession(
              { ...prev, transcript: [...prev.transcript, systemMessage] },
              Date.now(),
            ),
          );
        }
      } finally {
        setIsLoading(false);
      }
    },
    [],
  );

  return (
    <main className="app">
      <h1>Wheelio</h1>
      <ChatPanel
        transcript={session.transcript}
        isLoading={isLoading}
        isBusy={false}
        onSubmit={handleSubmit}
      />
    </main>
  );
}
