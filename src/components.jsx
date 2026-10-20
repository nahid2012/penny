import { formatAmount, formatDate } from "./money";
import { CATEGORY_STYLE } from "./config";
import { tap } from "./haptics";

export function CategoryIcon({ name }) {
  const s = CATEGORY_STYLE[name] ?? CATEGORY_STYLE.Other;
  return (
    <span className="icon" style={{ "--h": s.hue }} aria-hidden>
      {s.icon}
    </span>
  );
}

export function ExpenseRow({ x, i = 0, onClick }) {
  return (
    <li style={{ "--i": Math.min(i, 10) }}>
      <button
        className="row"
        onClick={() => {
          tap();
          onClick(x);
        }}
      >
        <CategoryIcon name={x.category} />
        <span className="row-main">
          <span className="row-title">{x.description}</span>
          <span className="row-sub">
            {formatDate(x.date)} · {x.category}
          </span>
        </span>
        <span className="row-amount">{formatAmount(x.amountMinor)}</span>
      </button>
    </li>
  );
}

export function Empty({ title, hint }) {
  return (
    <div className="empty">
      <div className="empty-icon" aria-hidden>
        🪙
      </div>
      <strong>{title}</strong>
      <p>{hint}</p>
    </div>
  );
}
