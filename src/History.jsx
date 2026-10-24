import { useEffect, useState } from "react";
import { listExpenses } from "./db";
import { formatAmount, addDays, formatDate } from "./money";
import { ExpenseRow, Empty } from "./components";

export default function History({ cats, version, onEdit }) {
  const [f, setF] = useState({ from: "", to: "", categoryId: "", search: "" });
  const [rows, setRows] = useState([]);
  const [error, setError] = useState("");
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  useEffect(() => {
    let cancelled = false;
    if (f.from && f.to && f.from > f.to) {
      return () => {
        cancelled = true;
      };
    }
    listExpenses({
      from: f.from || undefined,
      to: f.to ? addDays(f.to, 1) : undefined, // "to" is inclusive in the UI
      categoryId: f.categoryId ? Number(f.categoryId) : undefined,
      search: f.search,
    })
      .then((r) => {
        if (!cancelled) {
          setRows(r);
          setError("");
        }
      })
      .catch((e) => {
        console.error("Failed to load history:", e);
        if (!cancelled) setError("Could not load history.");
      });
    return () => {
      cancelled = true;
    };
  }, [f, version]);

  // shareMinor = the part of each expense that matches the category filter
  // (a receipt only contributes its matching items), so filtered totals add up.
  const invalidRange = f.from && f.to && f.from > f.to;
  const visibleRows = invalidRange ? [] : rows;
  const total = visibleRows.reduce((sum, x) => sum + x.shareMinor, 0);
  const filtered = f.from || f.to || f.categoryId || f.search;
  const period = f.from && f.to
    ? `${formatDate(f.from)} → ${formatDate(f.to)}`
    : f.from
      ? `From ${formatDate(f.from)}`
      : f.to
        ? `Through ${formatDate(f.to)}`
        : "All dates";

  return (
    <>
      <section className="card filters">
        <input
          type="search"
          placeholder="Search titles, items and notes"
          value={f.search}
          onChange={set("search")}
        />
        <div className="two">
          <label>
            From
            <input type="date" value={f.from} onChange={set("from")} />
          </label>
          <label>
            To
            <input type="date" value={f.to} onChange={set("to")} />
          </label>
        </div>
        <select value={f.categoryId} onChange={set("categoryId")}>
          <option value="">All categories</option>
          {cats.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        {filtered && (
          <button
            className="btn ghost small"
            onClick={() =>
              setF({ from: "", to: "", categoryId: "", search: "" })
            }
          >
            Clear filters
          </button>
        )}
      </section>

      {(invalidRange || error) && (
        <p className="error" role="alert">
          {invalidRange ? "From date must not be after To date." : error}
        </p>
      )}

      <p className="summary-line">
        <strong>{formatAmount(total)}</strong> · {visibleRows.length}{" "}
        transaction{visibleRows.length === 1 ? "" : "s"} · {period}
      </p>

      {visibleRows.length === 0 ? (
        <Empty
          title={filtered ? "No matches" : "No expenses yet"}
          hint={
            filtered
              ? "Try loosening the filters."
              : "Tap + to record your first expense."
          }
        />
      ) : (
        <ul className="list card">
          {visibleRows.map((x, i) => (
            <ExpenseRow key={x.id} x={x} i={i} onClick={onEdit} />
          ))}
        </ul>
      )}
    </>
  );
}
