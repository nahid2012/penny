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

// Receipts get their own icon, tinted with their category's colour when all
// items share one, and a neutral blue when the receipt is mixed.
function ReceiptIcon({ category, mixed }) {
  const hue = mixed
    ? 215
    : (CATEGORY_STYLE[category] ?? CATEGORY_STYLE.Other).hue;
  return (
    <span className="icon" style={{ "--h": hue }} aria-hidden>
      🧾
    </span>
  );
}

export function ExpenseRow({ x, i = 0, onClick }) {
  const isReceipt = x.kind === "receipt";
  const mixed = isReceipt && x.categoryCount > 1;
  // When a category filter is on, a receipt shows only the matching part.
  const share = x.shareMinor ?? x.amountMinor;
  const partial = share !== x.amountMinor;

  const sub = isReceipt
    ? `${formatDate(x.date)} · ${x.itemCount} item${x.itemCount === 1 ? "" : "s"} · ${mixed ? "Mixed" : x.category}`
    : `${formatDate(x.date)} · ${x.category}`;

  return (
    <li style={{ "--i": Math.min(i, 10) }}>
      <button
        className="row"
        onClick={() => {
          tap();
          onClick(x);
        }}
      >
        {isReceipt ? (
          <ReceiptIcon category={x.category} mixed={mixed} />
        ) : (
          <CategoryIcon name={x.category} />
        )}
        <span className="row-main">
          <span className="row-title">{x.description}</span>
          <span className="row-sub">{sub}</span>
        </span>
        <span className="row-amount-wrap">
          <span className="row-amount">{formatAmount(share)}</span>
          {partial && (
            <span className="row-of">of {formatAmount(x.amountMinor)}</span>
          )}
        </span>
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
