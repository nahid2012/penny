import { useRef, useState } from 'react';
import { shareBackup, restoreFromFile } from './backup';
import { CURRENCY } from './config';

export default function Settings({ onChanged }) {
  const fileRef = useRef();
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');

  async function run(fn) {
    setMsg(''); setErr('');
    try { await fn(); } catch (e) { setErr(e.message); }
  }

  const backup = () => run(async () => setMsg(`Backed up ${await shareBackup()} expenses.`));

  const restore = (e) => run(async () => {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    if (!window.confirm('Restoring replaces ALL current expenses with the backup. Continue?')) return;
    setMsg(`Restored ${await restoreFromFile(file)} expenses.`);
    onChanged();
  });

  return (
    <>
      <section className="card">
        <h3>Backup</h3>
        <p className="muted">Your data lives only on this phone. Back up regularly and keep a copy somewhere else (Drive, email, another device).</p>
        <button className="btn primary" onClick={backup}>Export backup</button>
        <button className="btn ghost" onClick={() => fileRef.current.click()}>Restore from file</button>
        <input ref={fileRef} type="file" accept=".json,application/json" hidden onChange={restore} />
        {msg && <p className="ok">{msg}</p>}
        {err && <p className="error" role="alert">{err}</p>}
      </section>
      <section className="card">
        <h3>About</h3>
        <p className="muted">Currency: {CURRENCY.code} ({CURRENCY.symbol}). Penny works fully offline.</p>
      </section>
    </>
  );
}