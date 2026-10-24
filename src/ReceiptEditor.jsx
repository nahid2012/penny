import { useEffect, useRef, useState } from "react";
import { addReceipt, updateReceipt, getReceipt, deleteExpense } from "./db";
import {
  formatAmount,
  formatQuantity,
  parseQuantity,
  parseAmount,
  todayLocal,
  QTY_SCALE,
} from "./money";
import { evaluateReceipt, newItem } from "./receipt";
import { useCountUp } from "./useCountUp";
import { CATEGORY_STYLE } from "./config";
import { success, warn, tap } from "./haptics";

// Compare drafts without the React-only `key`, to know if anything changed.
const snapshot = (d) =>
  JSON.stringify({
    ...d,
    items: d.items.map((it) => [it.name, it.categoryId, it.price, it.qty]),
  });

const blank = (cats) => ({
  title: "",
  date: todayLocal(),
  notes: "",
  items: [newItem(cats[0].id)],
});

const toDraft = (r) => ({
  title: r.title,
  date: r.date,
  notes: r.notes ?? "",
  items: r.items.map((it) => ({
    ...newItem(it.categoryId),
    name: it.name,
    price: (it.unitPriceMinor / 100).toFixed(2),
    qty: formatQuantity(it.quantityMilli),
  })),
});

// Full-screen editor for creating or editing a receipt (id = null -> new).
export default function ReceiptEditor({
  cats,
  id,
  onClose,
  onSaved,
  onRegisterBackHandler,
}) {
  const [state, setState] = useState(() => {
    if (id) return null; // editing: wait for the receipt to load
    const d = blank(cats);
    return { draft: d, base: snapshot(d) };
  });
  const [loadError, setLoadError] = useState("");
  const [showErrors, setShowErrors] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [closing, setClosing] = useState(false);
  const [focusKey, setFocusKey] = useState(null);
  const bodyRef = useRef(null);

  const draft = state?.draft;
  const ev = draft ? evaluateReceipt(draft) : null;
  const animatedTotal = useCountUp(ev?.totalMinor ?? 0, 350);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    getReceipt(id)
      .then((r) => {
        if (cancelled) return;
        if (!r) return setLoadError("This receipt no longer exists.");
        const d = toDraft(r);
        setState({ draft: d, base: snapshot(d) });
      })
      .catch((e) => !cancelled && setLoadError(e.message));
    return () => {
      cancelled = true;
    };
  }, [id]);

  const dismiss = (after) => {
    setClosing(true);
    setTimeout(after, 200);
  };

  const update = (fn) => setState((s) => ({ ...s, draft: fn(s.draft) }));
  const setField = (k) => (e) => update((d) => ({ ...d, [k]: e.target.value }));
  const setItem = (key, patch) =>
    update((d) => ({
      ...d,
      items: d.items.map((it) => (it.key === key ? { ...it, ...patch } : it)),
    }));

  const addItem = () => {
    tap();
    const last = draft.items[draft.items.length - 1];
    const it = newItem(last?.categoryId ?? cats[0].id); // same category as the last item
    setFocusKey(it.key);
    update((d) => ({ ...d, items: [...d.items, it] }));
  };

  const removeItem = (key) => {
    if (draft.items.length === 1) return;
    tap();
    update((d) => ({ ...d, items: d.items.filter((it) => it.key !== key) }));
  };

  const bump = (it, delta) => {
    const next = (parseQuantity(it.qty) ?? QTY_SCALE) + delta * QTY_SCALE;
    if (next <= 0) return;
    tap();
    setItem(it.key, { qty: formatQuantity(next) });
  };

  const dirty = draft && snapshot(draft) !== state.base;

  const requestClose = () => {
    if (
      dirty &&
      !window.confirm("Discard this receipt? Your changes won't be saved.")
    )
      return;
    dismiss(onClose);
  };

  useEffect(
    () => onRegisterBackHandler?.(requestClose),
    [onRegisterBackHandler, requestClose],
  );

  async function save() {
    setShowErrors(true);
    setError("");
    if (!ev.ok) {
      warn();
      setError("Fix the highlighted fields to save.");
      requestAnimationFrame(() =>
        bodyRef.current?.querySelector(".bad")?.scrollIntoView({
          block: "center",
          behavior: "smooth",
        }),
      );
      return;
    }
    setSaving(true);
    try {
      if (id) await updateReceipt(id, ev.value);
      else await addReceipt(ev.value);
      success();
      dismiss(() => onSaved(id ? "Receipt updated" : "Receipt saved"));
    } catch (err) {
      warn();
      setError(err.message);
      setSaving(false);
    }
  }

  async function remove() {
    if (
      !window.confirm(
        `Delete "${draft.title}" and its ${draft.items.length} item${draft.items.length === 1 ? "" : "s"}?`,
      )
    )
      return;
    try {
      await deleteExpense(id);
      success();
      dismiss(() => onSaved("Receipt deleted"));
    } catch (err) {
      warn();
      setError(err.message);
    }
  }

  const cls = `screen ${closing ? "closing" : ""}`;
  const title = id ? "Edit receipt" : "New receipt";

  if (!draft) {
    return (
      <div className={cls} role="dialog" aria-label={title}>
        <div className="screen-bar">
          <button
            className="icon-btn"
            aria-label="Close"
            onClick={() => dismiss(onClose)}
          >
            ✕
          </button>
          <h2>{title}</h2>
          <span />
        </div>
        <div className="screen-body">
          {loadError ? (
            <p className="error" role="alert">
              {loadError}
            </p>
          ) : (
            <p className="muted">Loading…</p>
          )}
        </div>
      </div>
    );
  }

  const fieldErr = (msg) =>
    showErrors && msg && <p className="field-error">{msg}</p>;
  const bad = (msg) => (showErrors && msg ? "bad" : "");
  const count = draft.items.length;

  return (
    <div className={cls} role="dialog" aria-label={title}>
      <div className="screen-bar">
        <button className="icon-btn" aria-label="Close" onClick={requestClose}>
          ✕
        </button>
        <h2>{title}</h2>
        <span />
      </div>

      <div className="screen-body" ref={bodyRef}>
        <section className="card stack">
          <label>
            Title
            <input
              autoFocus={!id}
              className={bad(ev.errors.title)}
              value={draft.title}
              onChange={setField("title")}
              placeholder="Bazar, Shwapno, pharmacy…"
            />
            {fieldErr(ev.errors.title)}
          </label>
          <label>
            Date
            <input
              type="date"
              className={bad(ev.errors.date)}
              value={draft.date}
              onChange={setField("date")}
            />
            {fieldErr(ev.errors.date)}
          </label>
          <label>
            Notes (optional)
            <textarea
              rows={2}
              value={draft.notes}
              onChange={setField("notes")}
              placeholder="Anything worth remembering"
            />
          </label>
        </section>

        <div className="items-head">
          <h3>Items</h3>
          <span className="muted">
            {count} item{count === 1 ? "" : "s"}
          </span>
        </div>

        {draft.items.map((it, i) => {
          const row = ev.rows[i];
          const style =
            CATEGORY_STYLE[
              cats.find((c) => String(c.id) === String(it.categoryId))?.name
            ] ?? CATEGORY_STYLE.Other;
          const qty = parseQuantity(it.qty);
          const price = parseAmount(it.price);
          return (
            <div
              className="item-card"
              key={it.key}
              style={{ "--h": style.hue }}
            >
              <div className="item-top">
                <input
                  autoFocus={it.key === focusKey}
                  className={bad(row.errors.name)}
                  value={it.name}
                  onChange={(e) => setItem(it.key, { name: e.target.value })}
                  placeholder={`Item ${i + 1}, e.g. Rice 5 kg`}
                  aria-label={`Item ${i + 1} name`}
                />
                <button
                  type="button"
                  className="icon-btn remove-btn"
                  aria-label={`Remove item ${i + 1}`}
                  disabled={count === 1}
                  onClick={() => removeItem(it.key)}
                >
                  ✕
                </button>
              </div>
              {fieldErr(row.errors.name)}

              <div className="item-grid">
                <label className="span2">
                  Category
                  <select
                    value={it.categoryId}
                    onChange={(e) =>
                      setItem(it.key, { categoryId: e.target.value })
                    }
                  >
                    {cats.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Price each
                  <input
                    inputMode="decimal"
                    className={bad(row.errors.price)}
                    value={it.price}
                    onChange={(e) => setItem(it.key, { price: e.target.value })}
                    placeholder="0.00"
                  />
                  {fieldErr(row.errors.price)}
                </label>
                <div className="field">
                  Quantity
                  <div className="stepper">
                    <button
                      type="button"
                      aria-label="Decrease quantity"
                      onClick={() => bump(it, -1)}
                    >
                      −
                    </button>
                    <input
                      inputMode="decimal"
                      className={bad(row.errors.qty)}
                      value={it.qty}
                      onChange={(e) => setItem(it.key, { qty: e.target.value })}
                      aria-label="Quantity"
                    />
                    <button
                      type="button"
                      aria-label="Increase quantity"
                      onClick={() => bump(it, 1)}
                    >
                      +
                    </button>
                  </div>
                  {fieldErr(row.errors.qty)}
                </div>
              </div>

              <div className="item-total">
                <span>
                  {qty !== null && price !== null
                    ? `${formatQuantity(qty)} × ${formatAmount(price)}`
                    : "Price × quantity"}
                </span>
                <strong>
                  {row.lineTotalMinor !== null
                    ? formatAmount(row.lineTotalMinor)
                    : "—"}
                </strong>
              </div>
            </div>
          );
        })}

        <button type="button" className="btn add-item" onClick={addItem}>
          + Add item
        </button>

        {id && (
          <button type="button" className="btn danger" onClick={remove}>
            Delete receipt
          </button>
        )}
      </div>

      <div className="screen-foot">
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <div className="foot-total">
          <span className="muted">
            Total · {count} item{count === 1 ? "" : "s"}
          </span>
          <strong>{formatAmount(animatedTotal)}</strong>
        </div>
        <button className="btn primary" onClick={save} disabled={saving}>
          {id ? "Save changes" : "Save receipt"}
        </button>
      </div>
    </div>
  );
}
