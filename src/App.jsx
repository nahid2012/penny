import { useEffect, useState } from 'react';
import { initDb, listCategories } from './db';
import Dashboard from './Dashboard';
import History from './History';
import Settings from './Settings';
import ExpenseSheet from './ExpenseSheet';
import './styles.css';

const TABS = [['home', '🏠', 'Home'], ['history', '🧾', 'History'], ['settings', '⚙️', 'Settings']];

export default function App() {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  const [cats, setCats] = useState([]);
  const [tab, setTab] = useState('home');
  const [sheet, setSheet] = useState(null);      // null | { expense: obj | null }
  const [version, setVersion] = useState(0);     // bump to make views reload

  useEffect(() => {
    (async () => { await initDb(); setCats(await listCategories()); setReady(true); })()
      .catch((e) => setError(e.message));
  }, []);

  if (!ready) return <p className="boot">{error || 'Loading…'}</p>;

  const openEdit = (expense) => setSheet({ expense });
  const changed = () => setVersion((v) => v + 1);

  return (
    <div className="app">
      <header><h1>Penny</h1></header>
      <main>
        {tab === 'home' && <Dashboard version={version} onEdit={openEdit} />}
        {tab === 'history' && <History cats={cats} version={version} onEdit={openEdit} />}
        {tab === 'settings' && <Settings onChanged={changed} />}
      </main>

      {tab !== 'settings' && (
        <button className="fab" aria-label="Add expense" onClick={() => setSheet({ expense: null })}>+</button>
      )}

      <nav>
        {TABS.map(([id, icon, label]) => (
          <button key={id} className={tab === id ? 'active' : ''} onClick={() => setTab(id)}>
            <span aria-hidden>{icon}</span>{label}
          </button>
        ))}
      </nav>

      {sheet && (
        <ExpenseSheet cats={cats} expense={sheet.expense}
          onClose={() => setSheet(null)}
          onSaved={() => { setSheet(null); changed(); }} />
      )}
    </div>
  );
}