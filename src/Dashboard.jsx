import { useEffect, useState } from 'react';
import { monthSummary, listExpenses } from './db';
import { formatAmount, monthRange, shiftMonth, monthLabel, todayLocal } from './money';
import { ExpenseRow, Empty } from './components';
import { useCountUp } from './useCountUp';
import { CATEGORY_STYLE } from './config';
import { CategoryIcon } from './components';   // merge into your existing components import
import { tap } from './haptics';
// ...inside the component:
const animatedTotal = useCountUp(s?.total ?? 0);

export default function Dashboard({ version, onEdit }) {
  const [month, setMonth] = useState(todayLocal().slice(0, 7));
  const [s, setS] = useState(null);
  const [recent, setRecent] = useState([]);

  useEffect(() => {
    const { from, to } = monthRange(month);
    monthSummary(month).then(setS);
    listExpenses({ from, to, limit: 5 }).then(setRecent);
  }, [month, version]);

  return (
    <>
      <div className="month-nav">
        <button aria-label="Previous month" onClick={() => { tap(); setMonth(shiftMonth(month, -1)); }}>‹</button>
        <input type="month" value={month} onChange={(e) => e.target.value && setMonth(e.target.value)} />
        <button aria-label="Next month" onClick={() => { tap(); setMonth(shiftMonth(month, 1)); }}>›</button>
        {s && (
          <div key={month} className="view">         {/* remount per month = replay animations */}
            <section className="hero">
              <span className="hero-label">Spent in {monthLabel(month)}</span>
              <span className="hero-amount">{formatAmount(animatedTotal)}</span>
              <span className="hero-sub">{s.count} transaction{s.count === 1 ? '' : 's'}</span>
            </section>
            {/* ...the empty state / cards exactly as before... */}
          </div>
        )}
      </div>

      {s && (
        <>
          <section className="hero">
            <span className="hero-label">Spent in {monthLabel(month)}</span>
            <span className="hero-amount">{formatAmount(s.total)}</span>
            <span className="hero-sub">{s.count} transaction{s.count === 1 ? '' : 's'}</span>
          </section>

          {s.count === 0 ? (
            <Empty title="Nothing recorded this month"
                   hint="Tap + to add an expense, or use ‹ › to look at another month." />
          ) : (
            <>
              <section className="card">
                <h3>By category</h3>
                  {s.byCategory.map((c) => (
                    <div className="bar-row" key={c.category}
                        style={{ '--h': (CATEGORY_STYLE[c.category] ?? CATEGORY_STYLE.Other).hue }}>
                      <div className="bar-head">
                        <span className="bar-name"><CategoryIcon name={c.category} />{c.category}</span>
                        <span>{formatAmount(c.total)}</span>
                      </div>
                      <div className="bar"><div style={{ width: `${(c.total / s.total) * 100}%` }} /></div>
                    </div>
                  ))}
              </section>
              <section className="card">
                <h3>Recent</h3>
                <ul className="list">
                  {recent.map((x, i) => <ExpenseRow key={x.id} x={x} i={i} onClick={onEdit} />)}
                </ul>
              </section>
            </>
          )}
        </>
      )}
    </>
  );
}