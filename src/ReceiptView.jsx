import { useEffect, useState } from "react";
import { getReceipt } from "./db";
import { formatAmount, formatQuantity, formatDate } from "./money";
import { categoryTotals } from "./receipt";
import { CATEGORY_STYLE } from "./config";
import { CategoryIcon } from "./components";
import { useCountUp } from "./useCountUp";

// Read-only view of a saved receipt. Editing happens in ReceiptEditor.
export default function ReceiptView({ id, onClose, onEdit }) {
  const [r, setR] = useState(undefined); // undefined = loading, null = missing
  const [closing, setClosing] = useState(false);
  const total = useCountUp(r?.amountMinor ?? 0);

  useEffect(() => {
    let cancelled = false;
    getReceipt(id)
      .then((x) => !cancelled && setR(x))
      .catch(() => !cancelled && setR(null));
    return () => {
      cancelled = true;
    };
  }, [id]);

  const dismiss = (after) => {
    setClosing(true);
    setTimeout(after, 200);
  };

  const groups = r
    ? categoryTotals(r.items).map((g) => ({
        ...g,
        name: r.items.find((i) => i.categoryId === g.categoryId).category,
      }))
    : [];

  return (
    <div
      className={`screen ${closing ? "closing" : ""}`}
      role="dialog"
      aria-label="Receipt"
    >
      <div className="screen-bar">
        <button
          className="icon-btn"
          aria-label="Close"
          onClick={() => dismiss(onClose)}
        >
          ✕
        </button>
        <h2>Receipt</h2>
        <span />
      </div>

      <div className="screen-body">
        {r === undefined && <p className="muted">Loading…</p>}
        {r === null && (
          <p className="error" role="alert">
            This receipt could not be loaded.
          </p>
        )}

        {r && (
          <>
            <section className="hero">
              <span className="hero-label">{r.title}</span>
              <span className="hero-amount">{formatAmount(total)}</span>
              <span className="hero-sub">
                {formatDate(r.date)} · {r.items.length} item
                {r.items.length === 1 ? "" : "s"}
              </span>
            </section>

            {r.notes && (
              <section className="card">
                <h3>Notes</h3>
                <p className="note-text">{r.notes}</p>
              </section>
            )}

            <section className="card">
              <h3>Items</h3>
              <ul className="list">
                {r.items.map((it) => (
                  <li className="line" key={it.id}>
                    <CategoryIcon name={it.category} />
                    <span className="line-main">
                      <span className="line-name">{it.name}</span>
                      <span className="line-sub">
                        {formatQuantity(it.quantityMilli)} ×{" "}
                        {formatAmount(it.unitPriceMinor)} · {it.category}
                      </span>
                    </span>
                    <span className="line-amount">
                      {formatAmount(it.lineTotalMinor)}
                    </span>
                  </li>
                ))}
              </ul>
            </section>

            {groups.length > 1 && (
              <section className="card">
                <h3>By category</h3>
                {groups.map((g) => {
                  const style = CATEGORY_STYLE[g.name] ?? CATEGORY_STYLE.Other;
                  const pct = Math.min(100, (g.total / r.amountMinor) * 100);
                  return (
                    <div
                      className="bar-row"
                      key={g.categoryId}
                      style={{ "--h": style.hue }}
                    >
                      <div className="bar-head">
                        <span className="bar-name">
                          <CategoryIcon name={g.name} />
                          {g.name}
                        </span>
                        <span>{formatAmount(g.total)}</span>
                      </div>
                      <div className="bar">
                        <div style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </section>
            )}
          </>
        )}
      </div>

      {r && (
        <div className="screen-foot">
          <button className="btn primary" onClick={() => onEdit(r.id)}>
            Edit receipt
          </button>
        </div>
      )}
    </div>
  );
}
