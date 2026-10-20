import { useEffect, useState } from "react";
import { monthSummary, listExpenses } from "./db";
import {
  formatAmount,
  monthRange,
  shiftMonth,
  monthLabel,
  todayLocal,
} from "./money";
import { ExpenseRow, Empty, CategoryIcon } from "./components";
import { useCountUp } from "./useCountUp";
import { CATEGORY_STYLE } from "./config";
import { tap } from "./haptics";

export default function Dashboard({ version, onEdit }) {
  const [month, setMonth] = useState(() => todayLocal().slice(0, 7));
  const [s, setS] = useState(null);
  const [recent, setRecent] = useState([]);

  const animatedTotal = useCountUp(s?.total ?? 0);

  useEffect(() => {
    let cancelled = false;

    setS(null);
    setRecent([]);

    const { from, to } = monthRange(month);

    monthSummary(month)
      .then((summary) => {
        if (!cancelled) setS(summary);
      })
      .catch((error) => {
        console.error("Failed to load monthly summary:", error);
        if (!cancelled) setS(null);
      });

    listExpenses({ from, to, limit: 5 })
      .then((expenses) => {
        if (!cancelled) setRecent(expenses);
      })
      .catch((error) => {
        console.error("Failed to load recent expenses:", error);
        if (!cancelled) setRecent([]);
      });

    return () => {
      cancelled = true;
    };
  }, [month, version]);

  const changeMonth = (delta) => {
    tap();
    setMonth((current) => shiftMonth(current, delta));
  };

  return (
    <>
      <div className="month-nav">
        <button
          type="button"
          aria-label="Previous month"
          onClick={() => changeMonth(-1)}
        >
          ‹
        </button>

        <input
          type="month"
          aria-label="Select month"
          value={month}
          onChange={(e) => {
            if (e.target.value) setMonth(e.target.value);
          }}
        />

        <button
          type="button"
          aria-label="Next month"
          onClick={() => changeMonth(1)}
        >
          ›
        </button>
      </div>

      {s && (
        <div key={month} className="view">
          <section className="hero">
            <span className="hero-label">Spent in {monthLabel(month)}</span>

            <span className="hero-amount">{formatAmount(animatedTotal)}</span>

            <span className="hero-sub">
              {s.count} transaction{s.count === 1 ? "" : "s"}
            </span>
          </section>

          {s.count === 0 ? (
            <Empty
              title="Nothing recorded this month"
              hint="Tap + to add an expense, or use ‹ › to look at another month."
            />
          ) : (
            <>
              <section className="card">
                <h3>By category</h3>

                {s.byCategory.map((c) => {
                  const style =
                    CATEGORY_STYLE[c.category] ?? CATEGORY_STYLE.Other;

                  const percentage =
                    s.total > 0
                      ? Math.min(100, Math.max(0, (c.total / s.total) * 100))
                      : 0;

                  return (
                    <div
                      className="bar-row"
                      key={c.category}
                      style={{ "--h": style.hue }}
                    >
                      <div className="bar-head">
                        <span className="bar-name">
                          <CategoryIcon name={c.category} />
                          {c.category}
                        </span>

                        <span>{formatAmount(c.total)}</span>
                      </div>

                      <div className="bar">
                        <div style={{ width: `${percentage}%` }} />
                      </div>
                    </div>
                  );
                })}
              </section>

              <section className="card">
                <h3>Recent</h3>

                {recent.length > 0 ? (
                  <ul className="list">
                    {recent.map((x, i) => (
                      <ExpenseRow key={x.id} x={x} i={i} onClick={onEdit} />
                    ))}
                  </ul>
                ) : (
                  <p>No recent expenses found.</p>
                )}
              </section>
            </>
          )}
        </div>
      )}
    </>
  );
}
