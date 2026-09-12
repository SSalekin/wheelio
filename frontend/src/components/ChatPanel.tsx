import { useRef, useState } from "react";
import type { TranscriptItem } from "../types";

interface ChatPanelProps {
  transcript: TranscriptItem[];
  isLoading: boolean;
  isBusy: boolean;
  onSubmit: (prompt: string, image: File | null) => void;
}

export default function ChatPanel({
  transcript,
  isLoading,
  isBusy,
  onSubmit,
}: ChatPanelProps) {
  const [prompt, setPrompt] = useState("");
  const [image, setImage] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const transcriptEndRef = useRef<HTMLDivElement>(null);

  const handleSubmit = () => {
    const trimmed = prompt.trim();
    if (!trimmed && !image) return;
    onSubmit(trimmed, image);
    setPrompt("");
    setImage(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const scrollToBottom = () => {
    transcriptEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <div className="chat-panel">
      <div className="chat-transcript" onScroll={scrollToBottom}>
        {transcript.map((item) => (
          <div key={item.id} className={`chat-message chat-message-${item.role}`}>
            <span className="chat-role">{item.role === "user" ? "You" : "System"}</span>
            <p>{item.text}</p>
          </div>
        ))}
        <div ref={transcriptEndRef} />
      </div>

      <div className="chat-input-area">
        <textarea
          className="chat-textarea"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Enter names, list, or describe what to extract..."
          disabled={isLoading || isBusy}
          rows={3}
        />
        <div className="chat-controls">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg"
            onChange={(e) => setImage(e.target.files?.[0] ?? null)}
            disabled={isLoading || isBusy}
            className="chat-file-input"
          />
          <button
            className="chat-submit"
            onClick={handleSubmit}
            disabled={isLoading || isBusy || (!prompt.trim() && !image)}
          >
            {isLoading ? "Extracting entries…" : "Submit"}
          </button>
        </div>
      </div>
    </div>
  );
}
