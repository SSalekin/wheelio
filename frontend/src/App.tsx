import { useCallback, useEffect, useState } from "react";
import { requestExtraction } from "./api";
import ChatPanel from "./components/ChatPanel";
import ConfirmDialog from "./components/ConfirmDialog";
import WheelPanel from "./components/WheelPanel";
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

interface PendingReplacement {
  entries: Entry[];
  sourceColumn?: string;
}

export default function App() {
  const [session, setSession] = useState<WheelSession>(() => {
    const loaded = loadSession(Date.now());
    return loaded ?? createEmptySession();
  });
  const [isLoading, setIsLoading] = useState(false);
  const [pendingReplacement, setPendingReplacement] =
    useState<PendingReplacement | null>(null);
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  useEffect(() => {
    setSession((prev) => saveSession(prev, Date.now()));
  }, [session.entries, session.picks, session.transcript]);

  const handleEntriesChange = useCallback((entries: Entry[]) => {
    setSession((prev) =>
      saveSession({ ...prev, entries, picks: [] }, Date.now()),
    );
  }, []);

  const handlePick = useCallback((value: string, remove: boolean) => {
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
  }, []);

  const handleReset = useCallback(() => {
    setShowResetConfirm(true);
  }, []);

  const confirmReset = useCallback(() => {
    clearSession();
    setSession(createEmptySession());
    setShowResetConfirm(false);
  }, []);

  const cancelReset = useCallback(() => {
    setShowResetConfirm(false);
  }, []);

  const confirmReplacement = useCallback(() => {
    if (!pendingReplacement) return;
    const { entries, sourceColumn } = pendingReplacement;
    const sourceText = sourceColumn ? ` from column "${sourceColumn}"` : "";
    const systemMessage: TranscriptItem = {
      id: crypto.randomUUID(),
      role: "system",
      text: `Created wheel with ${entries.length} entries${sourceText}.`,
    };
    setSession((prev) =>
      saveSession(
        {
          ...prev,
          entries,
          picks: [],
          transcript: [...prev.transcript, systemMessage],
        },
        Date.now(),
      ),
    );
    setPendingReplacement(null);
  }, [pendingReplacement]);

  const cancelReplacement = useCallback(() => {
    setPendingReplacement(null);
  }, []);

  const applyExtractionResult = useCallback(
    (entries: Entry[], sourceColumn?: string) => {
      if (entries.length === 0) {
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

      if (session.entries.length > 0) {
        setPendingReplacement({ entries, sourceColumn });
      } else {
        const sourceText = sourceColumn
          ? ` from column "${sourceColumn}"`
          : "";
        const systemMessage: TranscriptItem = {
          id: crypto.randomUUID(),
          role: "system",
          text: `Created wheel with ${entries.length} entries${sourceText}.`,
        };
        setSession((prev) =>
          saveSession(
            {
              ...prev,
              entries,
              picks: [],
              transcript: [...prev.transcript, systemMessage],
            },
            Date.now(),
          ),
        );
      }
    },
    [session.entries.length],
  );

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
          applyExtractionResult(normalized);
          return;
        }
      }

      setIsLoading(true);
      try {
        const result = await requestExtraction(prompt, image);

        if (result.kind === "success") {
          const normalized = normalizeEntries(result.entries);
          applyExtractionResult(normalized, result.sourceColumn);
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
    [applyExtractionResult],
  );

  const isBusy = isLoading;

  return (
    <main className="app">
      <h1>Wheelio</h1>
      <div className="app-layout">
        <ChatPanel
          transcript={session.transcript}
          isLoading={isLoading}
          isBusy={isBusy}
          onReset={handleReset}
          onSubmit={handleSubmit}
        />
        <WheelPanel
          entries={session.entries}
          picks={session.picks}
          removeOnPick={session.removeOnPick}
          isBusy={isBusy}
          onEntriesChange={handleEntriesChange}
          onPick={handlePick}
        />
      </div>

      {pendingReplacement && (
        <ConfirmDialog
          message="Replace the current wheel? Its entries and picked history will be discarded."
          onConfirm={confirmReplacement}
          onCancel={cancelReplacement}
        />
      )}

      {showResetConfirm && (
        <ConfirmDialog
          message="Clear this wheel and its picked history?"
          onConfirm={confirmReset}
          onCancel={cancelReset}
        />
      )}
    </main>
  );
}
