interface ResultModalProps {
  value: string;
  faces: string[];
  onClose: () => void;
  onSpinAgain: () => void;
  canSpinAgain: boolean;
}

export default function ResultModal({
  value,
  faces,
  onClose,
  onSpinAgain,
  canSpinAgain,
}: ResultModalProps) {
  const faceIdx = parseInt(value, 10) - 1;
  const showFace = faces.length > 0 && faceIdx >= 0 && faceIdx < faces.length;

  return (
    <div className="result-overlay" onClick={onClose}>
      <div className="result-modal" onClick={(e) => e.stopPropagation()}>
        <h2>Winner!</h2>
        {showFace ? (
          <img
            src={`data:image/png;base64,${faces[faceIdx]}`}
            alt={`Face ${value}`}
            className="result-face"
          />
        ) : (
          <p className="result-value">{value}</p>
        )}
        <div className="result-actions">
          <button className="result-btn result-close" onClick={onClose}>
            Close
          </button>
          <button
            className="result-btn result-spin-again"
            onClick={onSpinAgain}
            disabled={!canSpinAgain}
          >
            Spin Again
          </button>
        </div>
      </div>
    </div>
  );
}
