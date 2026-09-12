import { useCallback, useEffect, useState } from "react";
import ResultModal from "./ResultModal";
import type { Entry } from "../types";

const PALETTE = [
  "#FF6B6B",
  "#4ECDC4",
  "#45B7D1",
  "#96CEB4",
  "#FFEAA7",
  "#DDA0DD",
  "#98D8C8",
  "#F7DC6F",
  "#BB8FCE",
  "#85C1E9",
  "#F0B27A",
  "#82E0AA",
];

interface WheelPanelProps {
  entries: Entry[];
  picks: string[];
  removeOnPick: boolean;
  isBusy: boolean;
  onEntriesChange: (entries: Entry[]) => void;
  onRemoveOnPickChange: (removeOnPick: boolean) => void;
  onPick: (value: string, remove: boolean) => void;
}

export default function WheelPanel({
  entries,
  picks,
  removeOnPick,
  isBusy,
  onEntriesChange,
  onRemoveOnPickChange,
  onPick,
}: WheelPanelProps) {
  const [isSpinning, setIsSpinning] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [winnerValue, setWinnerValue] = useState<string | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [editorText, setEditorText] = useState("");
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    if (!isEditing) {
      setEditorText(entries.map((e) => e.value).join("\n"));
    }
  }, [entries, isEditing]);

  const sliceAngle = entries.length > 0 ? 360 / entries.length : 0;

  const handleSpin = useCallback(() => {
    if (entries.length < 2 || isSpinning || isBusy) return;

    const idx = crypto.getRandomValues(new Uint32Array(1))[0] % entries.length;
    const winner = entries[idx];
    setWinnerValue(winner.value);

    const targetAngle = 360 - idx * sliceAngle - sliceAngle / 2;
    const spins = 5 + Math.floor(Math.random() * 3);
    const finalRotation = spins * 360 + targetAngle;

    setRotation((prev) => prev + finalRotation);
    setIsSpinning(true);
  }, [entries, isSpinning, isBusy, sliceAngle]);

  const handleTransitionEnd = useCallback(() => {
    if (winnerValue === null) return;

    setShowResult(true);
    setIsSpinning(false);
  }, [winnerValue]);

  const handleApplyEdits = useCallback(() => {
    const lines = editorText.split("\n").filter((l) => l.trim() !== "");
    const seen = new Map<string, Entry>();
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      const key = trimmed.toLowerCase();
      if (seen.has(key)) continue;
      seen.set(key, { id: crypto.randomUUID(), value: trimmed });
    }
    onEntriesChange(Array.from(seen.values()));
    setIsEditing(false);
  }, [editorText, onEntriesChange]);

  const handleEditorKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && e.ctrlKey) {
      e.preventDefault();
      handleApplyEdits();
    }
  };

  const renderWheel = () => {
    if (entries.length === 0) {
      return (
        <div className="wheel-empty">
          <p>Wheel is empty</p>
        </div>
      );
    }

    const size = 300;
    const center = size / 2;
    const radius = center - 10;

    const paths = entries.map((_, i) => {
      const startAngle = (i * sliceAngle - 90) * (Math.PI / 180);
      const endAngle = ((i + 1) * sliceAngle - 90) * (Math.PI / 180);
      const x1 = center + radius * Math.cos(startAngle);
      const y1 = center + radius * Math.sin(startAngle);
      const x2 = center + radius * Math.cos(endAngle);
      const y2 = center + radius * Math.sin(endAngle);
      const largeArc = sliceAngle > 180 ? 1 : 0;

      const d = `M ${center} ${center} L ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2} Z`;
      const color = PALETTE[i % PALETTE.length];

      let label = null;
      if (entries.length <= 12) {
        const midAngle = ((i + 0.5) * sliceAngle - 90) * (Math.PI / 180);
        const labelRadius = radius * 0.65;
        const lx = center + labelRadius * Math.cos(midAngle);
        const ly = center + labelRadius * Math.sin(midAngle);
        const rot = (i + 0.5) * sliceAngle;
        const displayText =
          entries[i].value.length > 12
            ? entries[i].value.slice(0, 12) + "…"
            : entries[i].value;
        label = (
          <text
            key={`label-${i}`}
            x={lx}
            y={ly}
            textAnchor="middle"
            dominantBaseline="middle"
            transform={`rotate(${rot}, ${lx}, ${ly})`}
            className="wheel-label"
          >
            {displayText}
          </text>
        );
      }

      return (
        <g key={i}>
          <path d={d} fill={color} stroke="white" strokeWidth="2" />
          {label}
        </g>
      );
    });

    return (
      <div className="wheel-container">
        <div className="wheel-pointer">▼</div>
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          style={{
            transform: `rotate(${rotation}deg)`,
            transition: isSpinning
              ? "transform 4s cubic-bezier(0.17, 0.67, 0.12, 0.99)"
              : "none",
          }}
          onTransitionEnd={handleTransitionEnd}
        >
          {paths}
        </svg>
      </div>
    );
  };

  return (
    <div className="wheel-panel">
      <div className="wheel-workspace">
        {renderWheel()}

        <div className="wheel-controls">
          <label className="remove-checkbox">
            <input
              type="checkbox"
              checked={removeOnPick}
              onChange={(e) => onRemoveOnPickChange(e.target.checked)}
              disabled={isSpinning || isBusy}
            />
            Remove the picked students from wheel
          </label>

          <button
            className="spin-btn"
            onClick={handleSpin}
            disabled={entries.length < 2 || isSpinning || isBusy}
          >
            {isSpinning ? "Spinning…" : "Start"}
          </button>
        </div>

        <div className="wheel-editor">
          <h3>Entries</h3>
          {isEditing ? (
            <div className="editor-area">
              <textarea
                value={editorText}
                onChange={(e) => setEditorText(e.target.value)}
                onKeyDown={handleEditorKeyDown}
                rows={6}
                disabled={isSpinning || isBusy}
              />
              <div className="editor-actions">
                <button
                  onClick={() => setIsEditing(false)}
                  disabled={isSpinning || isBusy}
                >
                  Cancel
                </button>
                <button onClick={handleApplyEdits} disabled={isSpinning || isBusy}>
                  Apply
                </button>
              </div>
              <p className="editor-hint">Ctrl+Enter to apply</p>
            </div>
          ) : (
            <button
              className="edit-btn"
              onClick={() => setIsEditing(true)}
              disabled={isSpinning || isBusy}
            >
              Edit Entries
            </button>
          )}
        </div>
      </div>

      <div className="wheel-history">
        <h3>Pick History</h3>
        {picks.length === 0 ? (
          <p className="history-empty">No picks yet</p>
        ) : (
          <ul>
            {picks.map((value, i) => (
              <li key={i}>
                {i + 1}. {value}
              </li>
            ))}
          </ul>
        )}
      </div>

      {showResult && winnerValue !== null && (
        <ResultModal
          value={winnerValue}
          onClose={() => {
            onPick(winnerValue, removeOnPick);
            setShowResult(false);
          }}
          onSpinAgain={() => {
            onPick(winnerValue, removeOnPick);
            setShowResult(false);
            handleSpin();
          }}
          canSpinAgain={entries.length >= 2}
        />
      )}
    </div>
  );
}
