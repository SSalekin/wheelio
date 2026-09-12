interface ResultModalProps {
  value: string;
  onClose: () => void;
  onSpinAgain: () => void;
  canSpinAgain: boolean;
}

export default function ResultModal({
  value,
  onClose,
  onSpinAgain,
  canSpinAgain,
}: ResultModalProps) {
  return (
    <div className="result-overlay" onClick={onClose}>
      <div className="result-modal" onClick={(e) => e.stopPropagation()}>
        <h2>Winner!</h2>
        <p className="result-value">{value}</p>
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
