import { CapacitorSQLite, SQLiteConnection } from "@capacitor-community/sqlite";
import { CURRENCY, CATEGORIES } from "./config";
import {
  monthRange,
  isRealDate,
  lineTotal,
  MAX_AMOUNT_MINOR,
} from "./money";
import { primaryCategoryId } from "./receipt";

const sqlite = new SQLiteConnection(CapacitorSQLite);
let db;

// Append new migrations; never edit old ones.
//
// Money model (migration 2):
//  - Every purchase is ONE row in `expenses`. `amount_minor` is always the
//    amount that counts toward totals.
//  - kind = 'simple'  -> a plain expense (rent, a payment, one lunch...).
//  - kind = 'receipt' -> an itemised shopping list. Its `amount_minor` is the
//    sum of its rows in `expense_items`, written in the same transaction.
//  - Totals (month, history) only ever sum `expenses.amount_minor`.
//  - Per-category numbers read the `expense_lines` view, which yields one line
//    per simple expense and one per receipt item (never the receipt row), so
//    a receipt can't be counted twice and category sums always add up to the
//    total.
const MIGRATIONS = [
  `CREATE TABLE categories (
     id INTEGER PRIMARY KEY AUTOINCREMENT,
     name TEXT NOT NULL UNIQUE
   );
   CREATE TABLE expenses (
     id INTEGER PRIMARY KEY AUTOINCREMENT,
     description TEXT NOT NULL CHECK (length(trim(description)) > 0),
     amount_minor INTEGER NOT NULL CHECK (amount_minor > 0),
     category_id INTEGER NOT NULL REFERENCES categories(id),
     expense_date TEXT NOT NULL,
     created_at TEXT NOT NULL DEFAULT (datetime('now')),
     updated_at TEXT NOT NULL DEFAULT (datetime('now'))
   );
   CREATE INDEX idx_expenses_date ON expenses(expense_date);
   PRAGMA user_version = 1;`,

  `ALTER TABLE expenses ADD COLUMN kind TEXT NOT NULL DEFAULT 'simple'
     CHECK (kind IN ('simple', 'receipt'));
   ALTER TABLE expenses ADD COLUMN notes TEXT;
   CREATE TABLE expense_items (
     id INTEGER PRIMARY KEY AUTOINCREMENT,
     expense_id INTEGER NOT NULL REFERENCES expenses(id) ON DELETE CASCADE,
     position INTEGER NOT NULL,
     name TEXT NOT NULL CHECK (length(trim(name)) > 0),
     category_id INTEGER NOT NULL REFERENCES categories(id),
     unit_price_minor INTEGER NOT NULL CHECK (unit_price_minor > 0),
     quantity_milli INTEGER NOT NULL CHECK (quantity_milli > 0),
     line_total_minor INTEGER NOT NULL CHECK (line_total_minor > 0)
   );
   CREATE INDEX idx_items_expense ON expense_items(expense_id);
   CREATE INDEX idx_items_category ON expense_items(category_id);
   CREATE VIEW expense_lines AS
     SELECT e.id AS expense_id, e.expense_date AS expense_date,
            e.category_id AS category_id, e.amount_minor AS amount_minor
       FROM expenses e WHERE e.kind = 'simple'
     UNION ALL
     SELECT i.expense_id, e.expense_date, i.category_id, i.line_total_minor
       FROM expense_items i JOIN expenses e ON e.id = i.expense_id;
   PRAGMA user_version = 2;`,
];

let initPromise;

export async function initDb() {
  if (db) return;
  if (!initPromise) {
    initPromise = initializeDb().catch((error) => {
      initPromise = null;
      throw error;
    });
  }
  await initPromise;
}

async function initializeDb() {
  let connection;
  try {
    connection = await sqlite.retrieveConnection("penny", false);
  } catch {
    connection = await sqlite.createConnection(
      "penny",
      false,
      "no-encryption",
      1,
      false,
    );
  }

  if (typeof connection.isDBOpen === "function") {
    const open = await connection.isDBOpen();
    if (!open.result) await connection.open();
  } else {
    await connection.open();
  }
  await connection.execute("PRAGMA foreign_keys = ON;");

  const res = await connection.query("PRAGMA user_version;");
  const current = res.values?.[0]?.user_version ?? 0;
  for (let v = current; v < MIGRATIONS.length; v++) {
    await connection.execute(MIGRATIONS[v]);
  }

  for (const name of CATEGORIES) {
    await connection.run("INSERT OR IGNORE INTO categories (name) VALUES (?)", [
      name,
    ]);
  }
  db = connection;
}

function validate({ description, amountMinor, categoryId, date }) {
  if (!description?.trim()) throw new Error("Description is required.");
  if (
    !Number.isSafeInteger(amountMinor) ||
    amountMinor <= 0 ||
    amountMinor > MAX_AMOUNT_MINOR
  )
    throw new Error("Amount must be greater than zero.");
  if (!Number.isInteger(categoryId)) throw new Error("Choose a category.");
  if (!isRealDate(date)) throw new Error("Date is invalid.");
}

// A receipt is { title, date, notes, items: [{ name, categoryId,
// unitPriceMinor, quantityMilli }] }. Line totals and the grand total are
// always recomputed here, so a caller can't store numbers that disagree.
function buildReceipt({ title, date, items }) {
  if (!title?.trim()) throw new Error("Title is required.");
  if (!isRealDate(date)) throw new Error("Date is invalid.");
  if (!Array.isArray(items) || items.length === 0)
    throw new Error("Add at least one item.");

  const lines = items.map((it, i) => {
    const at = `Item ${i + 1}`;
    if (!it.name?.trim()) throw new Error(`${at}: name is required.`);
    if (!Number.isInteger(it.categoryId))
      throw new Error(`${at}: choose a category.`);
    if (
      !Number.isSafeInteger(it.unitPriceMinor) ||
      it.unitPriceMinor <= 0 ||
      it.unitPriceMinor > MAX_AMOUNT_MINOR
    )
      throw new Error(`${at}: price must be greater than zero.`);
    if (!Number.isInteger(it.quantityMilli) || it.quantityMilli <= 0)
      throw new Error(`${at}: quantity must be greater than zero.`);
    const lineTotalMinor = lineTotal(it.unitPriceMinor, it.quantityMilli);
    if (!lineTotalMinor || lineTotalMinor <= 0)
      throw new Error(`${at}: total is too small.`);
    return {
      name: it.name.trim(),
      categoryId: it.categoryId,
      unitPriceMinor: it.unitPriceMinor,
      quantityMilli: it.quantityMilli,
      lineTotalMinor,
    };
  });
  const total = lines.reduce((s, l) => s + l.lineTotalMinor, 0);
  if (!Number.isSafeInteger(total) || total > MAX_AMOUNT_MINOR)
    throw new Error("Receipt total is too large.");
  return { lines, total, headerCategoryId: primaryCategoryId(lines) };
}

// expenseId === null means "the expense inserted just before in this set":
// ids only grow (AUTOINCREMENT), so after the header insert it is MAX(id).
function itemInserts(lines, expenseId) {
  const idSql = expenseId === null ? "(SELECT MAX(id) FROM expenses)" : "?";
  return lines.map((l, i) => ({
    statement: `INSERT INTO expense_items
      (expense_id, position, name, category_id, unit_price_minor,
       quantity_milli, line_total_minor)
      VALUES (${idSql}, ?, ?, ?, ?, ?, ?)`,
    values: [
      ...(expenseId === null ? [] : [expenseId]),
      i,
      l.name,
      l.categoryId,
      l.unitPriceMinor,
      l.quantityMilli,
      l.lineTotalMinor,
    ],
  }));
}

export async function listCategories() {
  return (await db.query("SELECT id, name FROM categories ORDER BY id")).values;
}

export async function addExpense(e) {
  validate(e);
  await db.run(
    `INSERT INTO expenses (description, amount_minor, category_id, expense_date)
     VALUES (?, ?, ?, ?)`,
    [e.description.trim(), e.amountMinor, e.categoryId, e.date],
  );
}

export async function updateExpense(id, e) {
  validate(e);
  const r = await db.run(
    `UPDATE expenses SET description = ?, amount_minor = ?, category_id = ?,
       expense_date = ?, updated_at = datetime('now')
     WHERE id = ? AND kind = 'simple'`,
    [e.description.trim(), e.amountMinor, e.categoryId, e.date, id],
  );
  if (!r.changes?.changes) throw new Error("Expense not found.");
}

// Works for both kinds. Items are removed explicitly (not only via CASCADE)
// and in the same transaction, so nothing can be left behind.
export async function deleteExpense(id) {
  await db.executeSet(
    [
      {
        statement: "DELETE FROM expense_items WHERE expense_id = ?",
        values: [id],
      },
      { statement: "DELETE FROM expenses WHERE id = ?", values: [id] },
    ],
    true,
  );
}

export async function addReceipt(r) {
  const { lines, total, headerCategoryId } = buildReceipt(r);
  await db.executeSet(
    [
      {
        statement: `INSERT INTO expenses
          (description, amount_minor, category_id, expense_date, kind, notes)
          VALUES (?, ?, ?, ?, 'receipt', ?)`,
        values: [
          r.title.trim(),
          total,
          headerCategoryId,
          r.date,
          r.notes?.trim() || null,
        ],
      },
      ...itemInserts(lines, null),
    ],
    true,
  );
}

export async function updateReceipt(id, r) {
  const { lines, total, headerCategoryId } = buildReceipt(r);
  const exists = (
    await db.query(
      "SELECT 1 AS ok FROM expenses WHERE id = ? AND kind = 'receipt'",
      [id],
    )
  ).values;
  if (!exists?.length) throw new Error("Receipt not found.");
  await db.executeSet(
    [
      {
        statement: `UPDATE expenses SET description = ?, amount_minor = ?,
          category_id = ?, expense_date = ?, notes = ?,
          updated_at = datetime('now') WHERE id = ?`,
        values: [
          r.title.trim(),
          total,
          headerCategoryId,
          r.date,
          r.notes?.trim() || null,
          id,
        ],
      },
      {
        statement: "DELETE FROM expense_items WHERE expense_id = ?",
        values: [id],
      },
      ...itemInserts(lines, id),
    ],
    true,
  );
}

export async function getReceipt(id) {
  const head = (
    await db.query(
      `SELECT id, description AS title, amount_minor AS amountMinor,
              expense_date AS date, notes
       FROM expenses WHERE id = ? AND kind = 'receipt'`,
      [id],
    )
  ).values?.[0];
  if (!head) return null;
  const items = (
    await db.query(
      `SELECT i.id, i.name, i.category_id AS categoryId, c.name AS category,
              i.unit_price_minor AS unitPriceMinor,
              i.quantity_milli AS quantityMilli,
              i.line_total_minor AS lineTotalMinor
       FROM expense_items i JOIN categories c ON c.id = i.category_id
       WHERE i.expense_id = ? ORDER BY i.position`,
      [id],
    )
  ).values;
  return { ...head, items };
}

const like = (s) => `%${s.trim().replace(/[\\%_]/g, "\\$&")}%`;

// All filters optional and combined with AND. `to` is exclusive.
// Each row has `amountMinor` (the whole expense) and `shareMinor` (the part
// that matches the category filter: whole amount for simple expenses, only
// the matching items for a receipt). Sum `shareMinor` for filtered totals.
export async function listExpenses({
  from,
  to,
  categoryId,
  search,
  limit,
} = {}) {
  const where = [];
  const args = [];
  const selectArgs = [];

  let share = "e.amount_minor";
  if (categoryId) {
    share = `CASE WHEN e.kind = 'simple' THEN e.amount_minor
      ELSE (SELECT COALESCE(SUM(i.line_total_minor), 0) FROM expense_items i
            WHERE i.expense_id = e.id AND i.category_id = ?) END`;
    selectArgs.push(categoryId);
    where.push(`(CASE WHEN e.kind = 'simple' THEN e.category_id = ?
      ELSE EXISTS (SELECT 1 FROM expense_items i
                   WHERE i.expense_id = e.id AND i.category_id = ?) END)`);
    args.push(categoryId, categoryId);
  }
  if (from) {
    where.push("e.expense_date >= ?");
    args.push(from);
  }
  if (to) {
    where.push("e.expense_date < ?");
    args.push(to);
  }
  if (search?.trim()) {
    const q = like(search);
    where.push(`(e.description LIKE ? ESCAPE '\\'
      OR e.notes LIKE ? ESCAPE '\\'
      OR EXISTS (SELECT 1 FROM expense_items i
                 WHERE i.expense_id = e.id AND i.name LIKE ? ESCAPE '\\'))`);
    args.push(q, q, q);
  }

  let sql = `SELECT e.id, e.description, e.amount_minor AS amountMinor,
               ${share} AS shareMinor,
               e.category_id AS categoryId, c.name AS category,
               e.expense_date AS date, e.kind,
               (SELECT COUNT(*) FROM expense_items i
                 WHERE i.expense_id = e.id) AS itemCount,
               (SELECT COUNT(DISTINCT i.category_id) FROM expense_items i
                 WHERE i.expense_id = e.id) AS categoryCount
             FROM expenses e JOIN categories c ON c.id = e.category_id`;
  if (where.length) sql += " WHERE " + where.join(" AND ");
  sql += " ORDER BY e.expense_date DESC, e.id DESC";
  const all = [...selectArgs, ...args];
  if (limit) {
    sql += " LIMIT ?";
    all.push(limit);
  }
  return (await db.query(sql, all)).values;
}

export async function monthSummary(ym) {
  const { from, to } = monthRange(ym);
  const total = (
    await db.query(
      `SELECT COALESCE(SUM(amount_minor), 0) AS total, COUNT(*) AS count
     FROM expenses WHERE expense_date >= ? AND expense_date < ?`,
      [from, to],
    )
  ).values[0];
  // Lines, not expense rows: receipts contribute their items per category.
  const byCategory = (
    await db.query(
      `SELECT c.name AS category, SUM(l.amount_minor) AS total
     FROM expense_lines l JOIN categories c ON c.id = l.category_id
     WHERE l.expense_date >= ? AND l.expense_date < ?
     GROUP BY c.id ORDER BY total DESC`,
      [from, to],
    )
  ).values;
  return { total: total.total, count: total.count, byCategory };
}

export async function exportAll() {
  const rows = (
    await db.query(
      `SELECT e.id AS id, e.kind, e.description, e.amount_minor AS amountMinor,
              c.name AS category, e.expense_date AS date, e.notes,
              e.created_at AS createdAt
     FROM expenses e JOIN categories c ON c.id = e.category_id ORDER BY e.id`,
    )
  ).values;
  const items = (
    await db.query(
      `SELECT i.expense_id AS expenseId, i.name, c.name AS category,
              i.unit_price_minor AS unitPriceMinor,
              i.quantity_milli AS quantityMilli,
              i.line_total_minor AS lineTotalMinor
     FROM expense_items i JOIN categories c ON c.id = i.category_id
     ORDER BY i.expense_id, i.position`,
    )
  ).values;
  const byExpense = new Map();
  for (const { expenseId, ...it } of items) {
    if (!byExpense.has(expenseId)) byExpense.set(expenseId, []);
    byExpense.get(expenseId).push(it);
  }
  return {
    app: "penny",
    version: 2,
    currency: CURRENCY.code,
    exportedAt: new Date().toISOString(),
    expenses: rows.map(({ id, ...x }) =>
      x.kind === "receipt" ? { ...x, items: byExpense.get(id) ?? [] } : x,
    ),
  };
}

// Replaces all expenses. Everything is validated BEFORE anything is deleted,
// and the writes run in one transaction, so a bad file changes nothing.
// Accepts version 1 (plain expenses only) and version 2 (with receipts).
export async function importAll(data) {
  if (data?.app !== "penny" || !Array.isArray(data.expenses))
    throw new Error("This is not a Penny backup file.");
  if ((data.version ?? 1) > 2)
    throw new Error("This backup was made by a newer version of Penny.");

  const byName = new Map((await listCategories()).map((c) => [c.name, c.id]));
  const set = [
    { statement: "DELETE FROM expense_items", values: [] },
    { statement: "DELETE FROM expenses", values: [] },
  ];

  for (const [i, x] of data.expenses.entries()) {
    const id = i + 1; // explicit ids so items can point at their receipt
    const createdAt =
      x.createdAt ?? new Date().toISOString().slice(0, 19).replace("T", " ");
    try {
      if ((x.kind ?? "simple") === "receipt") {
        const { lines, total, headerCategoryId } = buildReceipt({
          title: x.description,
          date: x.date,
          items: (x.items ?? []).map((it) => ({
            name: it.name,
            categoryId: byName.get(it.category),
            unitPriceMinor: it.unitPriceMinor,
            quantityMilli: it.quantityMilli,
          })),
        });
        if (total !== x.amountMinor)
          throw new Error("total does not match its items.");
        set.push({
          statement: `INSERT INTO expenses
            (id, description, amount_minor, category_id, expense_date, kind, notes, created_at)
            VALUES (?, ?, ?, ?, ?, 'receipt', ?, ?)`,
          values: [
            id,
            x.description.trim(),
            total,
            headerCategoryId,
            x.date,
            x.notes?.trim() || null,
            createdAt,
          ],
        });
        set.push(...itemInserts(lines, id));
      } else {
        const categoryId = byName.get(x.category);
        validate({
          description: x.description,
          amountMinor: x.amountMinor,
          categoryId,
          date: x.date,
        });
        set.push({
          statement: `INSERT INTO expenses
            (id, description, amount_minor, category_id, expense_date, kind, notes, created_at)
            VALUES (?, ?, ?, ?, ?, 'simple', ?, ?)`,
          values: [
            id,
            x.description.trim(),
            x.amountMinor,
            categoryId,
            x.date,
            x.notes?.trim() || null,
            createdAt,
          ],
        });
      }
    } catch (e) {
      throw new Error(`Row ${i + 1}: ${e.message}`);
    }
  }
  await db.executeSet(set, true);
  return data.expenses.length;
}
