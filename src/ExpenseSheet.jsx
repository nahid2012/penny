import { useState } from "react";
import { addExpense, updateExpense, deleteExpense } from "./db";
import { parseAmount, formatAmount, todayLocal } from "./money";
import { CURRENCY } from "./config";
import { success, warn } from "./haptics";

export default function ExpenseSheet({ cats, expense, onClose, onSaved }) {
  const initialAmount = expense
    ? (expense.amountMinor / CURRENCY.minorPerMajor).toFixed(2)
    : "";
  const initialCategoryId = expense?.categoryId ?? cats[0].id;
  const initialDate = expense?.date ?? todayLocal();
  const [f, setF] = useState(
    expense
      ? {
          description: expense.description,
          amount: initialAmount,
          categoryId: initialCategoryId,
          date: initialDate,
        }
      : {
          description: "",
          amount: "",
          categoryId: initialCategoryId,
          date: initialDate,
        },
  );
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const [closing, setClosing] = useState(false);

  const dismiss = (after) => {
    // play the slide-down, then tell the parent
    setClosing(true);
    setTimeout(after, 200);
  };

  const dirty = expense
    ? f.description !== expense.description ||
      f.amount !== initialAmount ||
      Number(f.categoryId) !== expense.categoryId ||
      f.date !== expense.date
    : Boolean(f.description.trim() || f.amount.trim());

  const requestClose = () => {
    if (
      dirty &&
      !window.confirm("Discard this expense? Your changes won't be saved.")
    )
      return;
    dismiss(onClose);
  };

  async function save(e) {
    e.preventDefault();
    if (saving) return;
    const amountMinor = parseAmount(f.amount);
    if (amountMinor === null) {
      warn();
      return setError("Enter a valid amount, e.g. 250 or 99.50");
    }
    setSaving(true);
    const payload = {
      description: f.description,
      amountMinor,
      categoryId: Number(f.categoryId),
      date: f.date,
    };
    try {
      expense
        ? await updateExpense(expense.id, payload)
        : await addExpense(payload);
      success();
      dismiss(() => onSaved(expense ? "Changes saved" : "Expense added"));
    } catch (err) {
      warn();
      setError(err.message);
      setSaving(false);
    }
  }

  async function remove() {
    if (
      !window.confirm(
        `Delete "${expense.description}" (${formatAmount(expense.amountMinor)})?`,
      )
    )
      return;
    try {
      await deleteExpense(expense.id);
      success();
      dismiss(() => onSaved("Expense deleted"));
    } catch (err) {
      warn();
      setError(err.message);
    }
  }

  return (
    <div
      className={`backdrop ${closing ? "closing" : ""}`}
      onClick={requestClose}
    >
      <form
        className="sheet"
        role="dialog"
        aria-modal="true"
        aria-label={expense ? "Edit expense" : "New expense"}
        onClick={(e) => e.stopPropagation()}
        onSubmit={save}
      >
        <div className="sheet-handle" />
        <h2>{expense ? "Edit expense" : "New expense"}</h2>

        <label className="amount-field">
          <span>{CURRENCY.symbol}</span>
          <input
            autoFocus
            inputMode="decimal"
            placeholder="0.00"
            value={f.amount}
            onChange={set("amount")}
          />
        </label>
        <label>
          Description
          <input
            value={f.description}
            onChange={set("description")}
            placeholder="Lunch, rickshaw, …"
          />
        </label>
        <div className="two">
          <label>
            Category
            <select value={f.categoryId} onChange={set("categoryId")}>
              {cats.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Date
            <input type="date" value={f.date} onChange={set("date")} />
          </label>
        </div>

        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <button className="btn primary" type="submit" disabled={saving}>
          {expense ? "Save changes" : "Add expense"}
        </button>
        {expense && (
          <button className="btn danger" type="button" onClick={remove}>
            Delete
          </button>
        )}
        <button className="btn ghost" type="button" onClick={requestClose}>
          Cancel
        </button>
      </form>
    </div>
  );
}
