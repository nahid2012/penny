import { useEffect, useState, useCallback } from 'react';
import { initDb, listCategories, addExpense, updateExpense, deleteExpense,
         listExpenses, monthSummary } from './db';
import { parseAmount, formatAmount, monthRange, todayLocal } from './money';

const thisMonth = () => todayLocal().slice(0, 7);
const empty = (cats) => ({ description: '', amount: '', categoryId: cats[0]?.id ?? '', date: todayLocal() });

export default function App() {
  const [ready, setReady] = useState(false);
  const [cats, setCats] = useState([]);
  const [month, setMonth] = useState(thisMonth());
  const [summary, setSummary] = useState(null);
  const [expenses, setExpenses] = useState([]);
  const [form, setForm] = useState(null);       // null = closed
  const [editingId, setEditingId] = useState(null);
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    const { from, to } = monthRange(month);
    setSummary(await monthSummary(month));
    setExpenses(await listExpenses({ from, to }));
  }, [month]);

  useEffect(() => {
    (async () => {
      await initDb();
      const c = await listCategories();
      setCats(c);
      setReady(true);
    })().catch((e) => setError(e.message));
  }, []);

  useEffect(() => { if (ready) refresh().catch((e) => setError(e.message)); }, [ready, refresh]);

  async function save(e) {
    e.preventDefault();
    setError('');
    const amountMinor = parseAmount(form.amount);
    if (amountMinor === null) return setError('Enter a valid amount, e.g. 250 or 99.50');
    const payload = { description: form.description, amountMinor,
                      categoryId: Number(form.categoryId), date: form.date };
    try {
      editingId ? await updateExpense(editingId, payload) : await addExpense(payload);
      setForm(null); setEditingId(null);
      await refresh();
    } catch (err) { setError(err.message); }
  }

  async function remove(x) {
    if (!window.confirm(`Delete "${x.description}" (${formatAmount(x.amountMinor)})?`)) return;
    await deleteExpense(x.id);
    await refresh();
  }

  function edit(x) {
    setEditingId(x.id);
    setForm({ description: x.description, amount: (x.amountMinor / 100).toFixed(2),
              categoryId: x.categoryId, date: x.date });
  }

  if (!ready) return <p style={{ padding: 16 }}>{error || 'Loading…'}</p>;

  return (
    <main style={{ maxWidth: 520, margin: '0 auto', padding: 16, fontFamily: 'system-ui' }}>
      <h1>Penny</h1>
      <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} />

      {summary && (
        <section>
          <h2>{formatAmount(summary.total)}</h2>
          <p>{summary.count} transaction{summary.count === 1 ? '' : 's'} in {month}</p>
          <ul>
            {summary.byCategory.map((c) => (
              <li key={c.category}>{c.category}: {formatAmount(c.total)}</li>
            ))}
          </ul>
        </section>
      )}

      {error && <p role="alert" style={{ color: 'crimson' }}>{error}</p>}

      {form ? (
        <form onSubmit={save} style={{ display: 'grid', gap: 8 }}>
          <input placeholder="Description" value={form.description}
                 onChange={(e) => setForm({ ...form, description: e.target.value })} />
          <input placeholder="Amount (৳)" inputMode="decimal" value={form.amount}
                 onChange={(e) => setForm({ ...form, amount: e.target.value })} />
          <select value={form.categoryId}
                  onChange={(e) => setForm({ ...form, categoryId: e.target.value })}>
            {cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <input type="date" value={form.date}
                 onChange={(e) => setForm({ ...form, date: e.target.value })} />
          <button type="submit">{editingId ? 'Save changes' : 'Add expense'}</button>
          <button type="button" onClick={() => { setForm(null); setEditingId(null); setError(''); }}>
            Cancel
          </button>
        </form>
      ) : (
        <button onClick={() => setForm(empty(cats))}>+ Add expense</button>
      )}

      <h2>Expenses</h2>
      {expenses.length === 0 ? (
        <p>No expenses in {month}. Tap “Add expense” to record your first one.</p>
      ) : (
        <ul style={{ padding: 0, listStyle: 'none' }}>
          {expenses.map((x) => (
            <li key={x.id} style={{ padding: '8px 0', borderBottom: '1px solid #ddd' }}>
              <strong>{formatAmount(x.amountMinor)}</strong> {x.description}
              <div style={{ fontSize: 12, color: '#666' }}>{x.date} · {x.category}</div>
              <button onClick={() => edit(x)}>Edit</button>{' '}
              <button onClick={() => remove(x)}>Delete</button>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}