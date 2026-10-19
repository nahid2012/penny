import { formatAmount, formatDate } from './money';

export function ExpenseRow({ x, onClick }) {
  return (
    <li>
      <button className="row" onClick={() => onClick(x)}>
        <span className="row-main">
          <span className="row-title">{x.description}</span>
          <span className="row-sub">{formatDate(x.date)} · <span className="chip">{x.category}</span></span>
        </span>
        <span className="row-amount">{formatAmount(x.amountMinor)}</span>
      </button>
    </li>
  );
}

export function Empty({ title, hint }) {
  return (
    <div className="empty">
      <div className="empty-icon" aria-hidden>🪙</div>
      <strong>{title}</strong>
      <p>{hint}</p>
    </div>
  );
}