import { useState } from "react";
import { tap } from "./haptics";

// The "+" button opens this: pick a quick expense or an itemised receipt.
export default function AddChooser({ onPick, onClose }) {
  const [closing, setClosing] = useState(false);
  const dismiss = (after) => {
    setClosing(true);
    setTimeout(after, 200);
  };
  const pick = (kind) => {
    tap();
    dismiss(() => onPick(kind));
  };

  return (
    <div
      className={`backdrop ${closing ? "closing" : ""}`}
      onClick={() => dismiss(onClose)}
    >
      <div
        className="sheet"
        role="dialog"
        aria-label="Add"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sheet-handle" />
        <h2>Add</h2>
        <button className="choice" onClick={() => pick("expense")}>
          <span className="icon" style={{ "--h": 160 }} aria-hidden>
            💸
          </span>
          <span className="choice-text">
            <strong>Expense</strong>
            <small>One amount: rent, a payment, a single purchase</small>
          </span>
        </button>
        <button className="choice" onClick={() => pick("receipt")}>
          <span className="icon" style={{ "--h": 215 }} aria-hidden>
            🧾
          </span>
          <span className="choice-text">
            <strong>Receipt</strong>
            <small>Shopping list with items, prices and quantities</small>
          </span>
        </button>
        <button
          className="btn ghost"
          type="button"
          onClick={() => dismiss(onClose)}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
