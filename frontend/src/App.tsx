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
    imageBase64: null,
    imageMediaType: null,
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

  const handleRemoveOnPickChange = useCallback((removeOnPick: boolean) => {
    setSession((prev) =>
      saveSession({ ...prev, removeOnPick }, Date.now()),
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

  const isClarificationResponse = useCallback(() => {
    const lastSystemMsg = [...session.transcript]
      .reverse()
      .find((item) => item.role === "system");
    if (!lastSystemMsg) return false;
    const text = lastSystemMsg.text.toLowerCase();
    return (
      text.includes("clarif") ||
      text.includes("specify") ||
      text.includes("column")
    );
  }, [session.transcript]);

  const fileToBase64 = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        const base64 = result.split(",")[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

  const handleSubmit = useCallback(
    async (prompt: string, image: File | null) => {
      const userMessage: TranscriptItem = {
        id: crypto.randomUUID(),
        role: "user",
        text: prompt || "(image)",
      };

      let imageBase64 = session.imageBase64;
      let imageMediaType = session.imageMediaType;

      if (image) {
        imageBase64 = await fileToBase64(image);
        imageMediaType = image.type;
        setSession((prev) =>
          saveSession(
            {
              ...prev,
              transcript: [...prev.transcript, userMessage],
              imageBase64,
              imageMediaType,
            },
            Date.now(),
          ),
        );
      } else {
        setSession((prev) =>
          saveSession(
            { ...prev, transcript: [...prev.transcript, userMessage] },
            Date.now(),
          ),
        );
      }

      if (!image && !imageBase64) {
        const localEntries = parseSimpleList(prompt);
        if (localEntries) {
          const normalized = normalizeEntries(localEntries);
          applyExtractionResult(normalized);
          return;
        }
      }

      const isClarification = isClarificationResponse();

      let imageToSend = image;
      if (!imageToSend && isClarification && imageBase64 && imageMediaType) {
        const byteString = atob(imageBase64);
        const ab = new ArrayBuffer(byteString.length);
        const ia = new Uint8Array(ab);
        for (let i = 0; i < byteString.length; i++) {
          ia[i] = byteString.charCodeAt(i);
        }
        const blob = new Blob([ab], { type: imageMediaType });
        const ext = imageMediaType.includes("png") ? "png" : "jpg";
        imageToSend = new File([blob], `image.${ext}`, { type: imageMediaType });
      }

      setIsLoading(true);
      try {
        const result = await requestExtraction(
          prompt,
          imageToSend,
          isClarification ? session.transcript : undefined,
        );

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
    [
      applyExtractionResult,
      isClarificationResponse,
      session.transcript,
      session.imageBase64,
      session.imageMediaType,
    ],
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
          onRemoveOnPickChange={handleRemoveOnPickChange}
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
