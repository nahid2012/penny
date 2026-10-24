import { useCallback, useEffect, useRef, useState } from "react";
import { App as CapacitorApp } from "@capacitor/app";
import { initDb, listCategories } from "./db";
import Dashboard from "./Dashboard";
import History from "./History";
import Settings from "./Settings";
import ExpenseSheet from "./ExpenseSheet";
import AddChooser from "./AddChooser";
import ReceiptEditor from "./ReceiptEditor";
import ReceiptView from "./ReceiptView";
import "./styles.css";
import "./receipt.css";

import { tap } from "./haptics";

export default function App() {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const [cats, setCats] = useState([]);
  const [tab, setTab] = useState("home");
  // null | { type: "pick" }
  //      | { type: "expense", expense: obj | null }
  //      | { type: "receiptView", id }
  //      | { type: "receiptEdit", id: number | null }
  const [sheet, setSheet] = useState(null);
  const [version, setVersion] = useState(0); // bump to make views reload
  const sheetRef = useRef(sheet);
  const backHandlerRef = useRef(null);

  const [toast, setToast] = useState(null);
  const showToast = (message) => {
    const id = Date.now();
    setToast({ id, message });
    setTimeout(() => setToast((t) => (t?.id === id ? null : t)), 2200);
  };

  const registerBackHandler = useCallback((handler) => {
    backHandlerRef.current = handler;
    return () => {
      if (backHandlerRef.current === handler) backHandlerRef.current = null;
    };
  }, []);

  useEffect(() => {
    sheetRef.current = sheet;
  }, [sheet]);

  const TABS = [
    ["home", "🏠", "Home"],
    ["history", "🧾", "History"],
    ["settings", "⚙️", "Settings"],
  ];

  useEffect(() => {
    (async () => {
      await initDb();
      setCats(await listCategories());
      setReady(true);
    })().catch((e) => setError(e.message));
  }, []);

  useEffect(() => {
    let active = true;
    let listener;
    CapacitorApp.addListener("backButton", () => {
      if (backHandlerRef.current) {
        backHandlerRef.current();
      } else if (sheetRef.current) {
        setSheet(null);
      } else {
        CapacitorApp.exitApp();
      }
    }).then((handle) => {
      if (active) listener = handle;
      else handle.remove();
    });

    return () => {
      active = false;
      listener?.remove();
    };
  }, []);

  if (!ready) return <p className="boot">{error || "Loading…"}</p>;

  // Tapping a row: receipts open their detail view, plain expenses the sheet.
  const openRow = (x) =>
    setSheet(
      x.kind === "receipt"
        ? { type: "receiptView", id: x.id }
        : { type: "expense", expense: x },
    );
  const changed = () => setVersion((v) => v + 1);
  const saved = (msg) => {
    setSheet(null);
    changed();
    showToast(msg);
  };

  return (
    <div className="app">
      <header>
        <h1>Penny</h1>
      </header>
      <main key={tab} className="view">
        {tab === "home" && <Dashboard version={version} onEdit={openRow} />}
        {tab === "history" && (
          <History cats={cats} version={version} onEdit={openRow} />
        )}
        {tab === "settings" && <Settings onChanged={changed} />}
      </main>

      {tab !== "settings" && (
        <button
          className="fab"
          aria-label="Add"
          onClick={() => {
            tap();
            setSheet({ type: "pick" });
          }}
        >
          +
        </button>
      )}

      <nav>
        {TABS.map(([id, icon, label]) => (
          <button
            key={id}
            className={tab === id ? "active" : ""}
            onClick={() => {
              if (tab !== id) tap();
              setTab(id);
            }}
          >
            <span className="pill" aria-hidden>
              {icon}
            </span>
            {label}
          </button>
        ))}
      </nav>

      {toast && (
        <div className="toast" key={toast.id} role="status">
          {toast.message}
        </div>
      )}

      {sheet?.type === "pick" && (
        <AddChooser
          onClose={() => setSheet(null)}
          onPick={(kind) =>
            setSheet(
              kind === "receipt"
                ? { type: "receiptEdit", id: null }
                : { type: "expense", expense: null },
            )
          }
        />
      )}

      {sheet?.type === "expense" && (
        <ExpenseSheet
          cats={cats}
          expense={sheet.expense}
          onClose={() => setSheet(null)}
          onSaved={saved}
        />
      )}

      {sheet?.type === "receiptView" && (
        <ReceiptView
          key={sheet.id}
          id={sheet.id}
          onClose={() => setSheet(null)}
          onEdit={(id) => setSheet({ type: "receiptEdit", id })}
        />
      )}

      {sheet?.type === "receiptEdit" && (
        <ReceiptEditor
          key={sheet.id ?? "new"}
          cats={cats}
          id={sheet.id}
          onRegisterBackHandler={registerBackHandler}
          onClose={() =>
            setSheet(sheet.id ? { type: "receiptView", id: sheet.id } : null)
          }
          onSaved={saved}
        />
      )}
    </div>
  );
}
