import { CapacitorSQLite, SQLiteConnection } from "@capacitor-community/sqlite";
import { CURRENCY, CATEGORIES } from "./config";
import { monthRange, isRealDate } from "./money";

const sqlite = new SQLiteConnection(CapacitorSQLite);
let db;

// Append new migrations; never edit old ones.
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
   CREATE INDEX idx_expenses_date ON expenses(expense_date);`,
];

export async function initDb() {
  if (db) return;
  db = await sqlite.createConnection("penny", false, "no-encryption", 1, false);
  await db.open();
  await db.execute("PRAGMA foreign_keys = ON;");

  const res = await db.query("PRAGMA user_version;");
  const current = res.values?.[0]?.user_version ?? 0;
  for (let v = current; v < MIGRATIONS.length; v++) {
    await db.execute(MIGRATIONS[v]);
    await db.execute(`PRAGMA user_version = ${v + 1};`);
  }

  for (const name of CATEGORIES) {
    await db.run("INSERT OR IGNORE INTO categories (name) VALUES (?)", [name]);
  }
}

function validate({ description, amountMinor, categoryId, date }) {
  if (!description?.trim()) throw new Error("Description is required.");
  if (!Number.isInteger(amountMinor) || amountMinor <= 0)
    throw new Error("Amount must be greater than zero.");
  if (!Number.isInteger(categoryId)) throw new Error("Choose a category.");
  if (!isRealDate(date)) throw new Error("Date is invalid.");
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
       expense_date = ?, updated_at = datetime('now') WHERE id = ?`,
    [e.description.trim(), e.amountMinor, e.categoryId, e.date, id],
  );
  if (!r.changes?.changes) throw new Error("Expense not found.");
}

export async function deleteExpense(id) {
  await db.run("DELETE FROM expenses WHERE id = ?", [id]);
}

// All filters optional and combined with AND. `to` is exclusive.
export async function listExpenses({
  from,
  to,
  categoryId,
  search,
  limit,
} = {}) {
  const where = [];
  const args = [];
  if (from) {
    where.push("e.expense_date >= ?");
    args.push(from);
  }
  if (to) {
    where.push("e.expense_date < ?");
    args.push(to);
  }
  if (categoryId) {
    where.push("e.category_id = ?");
    args.push(categoryId);
  }
  if (search?.trim()) {
    const escaped = search.trim().replace(/[\\%_]/g, "\\$&");
    where.push("e.description LIKE ? ESCAPE '\\'");
    args.push(`%${escaped}%`);
  }
  let sql = `SELECT e.id, e.description, e.amount_minor AS amountMinor,
               e.category_id AS categoryId, c.name AS category,
               e.expense_date AS date
             FROM expenses e JOIN categories c ON c.id = e.category_id`;
  if (where.length) sql += " WHERE " + where.join(" AND ");
  sql += " ORDER BY e.expense_date DESC, e.id DESC";
  if (limit) {
    sql += " LIMIT ?";
    args.push(limit);
  }
  return (await db.query(sql, args)).values;
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
  const byCategory = (
    await db.query(
      `SELECT c.name AS category, SUM(e.amount_minor) AS total
     FROM expenses e JOIN categories c ON c.id = e.category_id
     WHERE e.expense_date >= ? AND e.expense_date < ?
     GROUP BY c.id ORDER BY total DESC`,
      [from, to],
    )
  ).values;
  return { total: total.total, count: total.count, byCategory };
}

export async function exportAll() {
  const rows = (
    await db.query(
      `SELECT e.description, e.amount_minor AS amountMinor, c.name AS category,
            e.expense_date AS date, e.created_at AS createdAt
     FROM expenses e JOIN categories c ON c.id = e.category_id ORDER BY e.id`,
    )
  ).values;
  return {
    app: "penny",
    version: 1,
    currency: CURRENCY.code,
    exportedAt: new Date().toISOString(),
    expenses: rows,
  };
}

// Replaces all expenses. Everything is validated BEFORE anything is deleted,
// and the writes run in one transaction, so a bad file changes nothing.
export async function importAll(data) {
  if (data?.app !== "penny" || !Array.isArray(data.expenses))
    throw new Error("This is not a Penny backup file.");
  const byName = new Map((await listCategories()).map((c) => [c.name, c.id]));
  const set = [{ statement: "DELETE FROM expenses", values: [] }];
  for (const [i, x] of data.expenses.entries()) {
    const categoryId = byName.get(x.category);
    try {
      validate({
        description: x.description,
        amountMinor: x.amountMinor,
        categoryId,
        date: x.date,
      });
    } catch (e) {
      throw new Error(`Row ${i + 1}: ${e.message}`);
    }
    set.push({
      statement: `INSERT INTO expenses
        (description, amount_minor, category_id, expense_date, created_at)
        VALUES (?, ?, ?, ?, ?)`,
      values: [
        x.description.trim(),
        x.amountMinor,
        categoryId,
        x.date,
        x.createdAt ?? new Date().toISOString().slice(0, 19).replace("T", " "),
      ],
    });
  }
  await db.executeSet(set, true);
  return data.expenses.length;
}
