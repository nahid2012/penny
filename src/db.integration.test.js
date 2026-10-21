import { describe, it, expect, beforeAll } from "vitest";

// Pre-existing v1 database (migration 1 applied + data) to prove the upgrade.
globalThis.__seed = (raw) => {
  raw.exec(`
    CREATE TABLE categories (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL UNIQUE);
    CREATE TABLE expenses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      description TEXT NOT NULL CHECK (length(trim(description)) > 0),
      amount_minor INTEGER NOT NULL CHECK (amount_minor > 0),
      category_id INTEGER NOT NULL REFERENCES categories(id),
      expense_date TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')));
    CREATE INDEX idx_expenses_date ON expenses(expense_date);
    PRAGMA user_version = 1;
    INSERT INTO categories (name) VALUES ('Food'),('Transport'),('Education'),('Shopping');
    INSERT INTO expenses (description, amount_minor, category_id, expense_date)
      VALUES ('Rent', 1000000, 4, '2026-10-01'), ('Rickshaw', 5000, 2, '2026-10-03');
  `);
};

const db = await import("../src/db.js");
const ym = "2026-10";
const cats = {};

beforeAll(async () => {
  await db.initDb();
  for (const c of await db.listCategories()) cats[c.name] = c.id;
});

const receipt = (over = {}) => ({
  title: "Bazar",
  date: "2026-10-10",
  notes: "weekly",
  items: [
    {
      name: "Rice 5kg",
      categoryId: cats.Food,
      unitPriceMinor: 36000,
      quantityMilli: 1000,
    },
    {
      name: "Onion",
      categoryId: cats.Food,
      unitPriceMinor: 6000,
      quantityMilli: 1500,
    },
    {
      name: "Notebook",
      categoryId: cats.Education,
      unitPriceMinor: 4500,
      quantityMilli: 3000,
    },
  ],
  ...over,
});

describe("receipts", () => {
  it("keeps old expenses after the upgrade", async () => {
    const rows = await db.listExpenses();
    expect(rows).toHaveLength(2);
    expect(rows.every((r) => r.kind === "simple" && r.itemCount === 0)).toBe(
      true,
    );
  });

  it("stores a receipt as ONE expense equal to the sum of its items", async () => {
    await db.addReceipt(receipt());
    const rows = await db.listExpenses();
    const r = rows.find((x) => x.kind === "receipt");
    expect(r.amountMinor).toBe(36000 + 9000 + 13500);
    expect(r.itemCount).toBe(3);
    expect(r.categoryCount).toBe(2);
    expect(r.category).toBe("Food");
    const full = await db.getReceipt(r.id);
    expect(full.items.map((i) => i.name)).toEqual([
      "Rice 5kg",
      "Onion",
      "Notebook",
    ]);
    expect(full.notes).toBe("weekly");
  });

  it("never double counts: month total = simple + receipts = sum of categories", async () => {
    const s = await db.monthSummary(ym);
    expect(s.count).toBe(3);
    expect(s.total).toBe(1000000 + 5000 + 58500);
    expect(s.byCategory.reduce((a, c) => a + c.total, 0)).toBe(s.total);
    const food = s.byCategory.find((c) => c.category === "Food").total;
    expect(food).toBe(36000 + 9000);
    expect(s.byCategory.find((c) => c.category === "Education").total).toBe(
      13500,
    );
  });

  it("category filter returns receipts with a matching item and only their share", async () => {
    const rows = await db.listExpenses({ categoryId: cats.Education });
    expect(rows).toHaveLength(1);
    expect(rows[0].amountMinor).toBe(58500);
    expect(rows[0].shareMinor).toBe(13500);
    const food = await db.listExpenses({ categoryId: cats.Food });
    expect(food.reduce((s, x) => s + x.shareMinor, 0)).toBe(45000);
    const transport = await db.listExpenses({ categoryId: cats.Transport });
    expect(transport.map((x) => x.description)).toEqual(["Rickshaw"]);
  });

  it("search matches item names, notes and titles; combines with filters", async () => {
    expect(
      (await db.listExpenses({ search: "onion" })).map((x) => x.description),
    ).toEqual(["Bazar"]);
    expect(await db.listExpenses({ search: "weekly" })).toHaveLength(1);
    expect(
      await db.listExpenses({ search: "onion", categoryId: cats.Education }),
    ).toHaveLength(1);
    expect(await db.listExpenses({ search: "100%" })).toHaveLength(0);
    expect(
      await db.listExpenses({
        search: "onion",
        limit: 1,
        from: "2026-10-01",
        to: "2026-11-01",
      }),
    ).toHaveLength(1);
  });

  it("editing replaces items and recomputes the total atomically", async () => {
    const id = (await db.listExpenses()).find((x) => x.kind === "receipt").id;
    await db.updateReceipt(
      id,
      receipt({
        items: [
          {
            name: "Milk",
            categoryId: cats.Food,
            unitPriceMinor: 9000,
            quantityMilli: 2000,
          },
        ],
      }),
    );
    const s = await db.monthSummary(ym);
    expect(s.total).toBe(1000000 + 5000 + 18000);
    expect(s.byCategory.reduce((a, c) => a + c.total, 0)).toBe(s.total);
    expect((await db.getReceipt(id)).items).toHaveLength(1);
  });

  it("rejects invalid receipts without writing anything", async () => {
    const before = (await db.listExpenses()).length;
    await expect(db.addReceipt(receipt({ items: [] }))).rejects.toThrow(
      /at least one/,
    );
    await expect(db.addReceipt(receipt({ title: " " }))).rejects.toThrow(
      /Title/,
    );
    await expect(
      db.addReceipt(
        receipt({
          items: [
            {
              name: "x",
              categoryId: cats.Food,
              unitPriceMinor: 0,
              quantityMilli: 1000,
            },
          ],
        }),
      ),
    ).rejects.toThrow(/Item 1/);
    expect((await db.listExpenses()).length).toBe(before);
  });

  it("plain-expense update cannot touch a receipt", async () => {
    const id = (await db.listExpenses()).find((x) => x.kind === "receipt").id;
    await expect(
      db.updateExpense(id, {
        description: "x",
        amountMinor: 1,
        categoryId: cats.Food,
        date: "2026-10-01",
      }),
    ).rejects.toThrow(/not found/);
  });

  it("backup round-trips receipts and still reads v1 files", async () => {
    await db.addReceipt(receipt());
    const before = await db.monthSummary(ym);
    const dump = JSON.parse(JSON.stringify(await db.exportAll()));
    expect(dump.version).toBe(2);
    await db.importAll(dump);
    expect(await db.monthSummary(ym)).toEqual(before);
    const rec = (await db.listExpenses()).find((x) => x.kind === "receipt");
    expect((await db.getReceipt(rec.id)).items.length).toBeGreaterThan(0);

    await db.importAll({
      app: "penny",
      version: 1,
      expenses: [
        {
          description: "Old",
          amountMinor: 1234,
          category: "Food",
          date: "2026-10-05",
        },
      ],
    });
    expect((await db.monthSummary(ym)).total).toBe(1234);

    await expect(
      db.importAll({
        ...dump,
        expenses: dump.expenses.map((x) =>
          x.kind === "receipt" ? { ...x, amountMinor: x.amountMinor + 1 } : x,
        ),
      }),
    ).rejects.toThrow(/does not match/);
    expect((await db.monthSummary(ym)).total).toBe(1234); // bad file changed nothing
  });

  it("deleting a receipt removes its items and its spending", async () => {
    await db.addReceipt(receipt());
    const id = (await db.listExpenses()).find((x) => x.kind === "receipt").id;
    await db.deleteExpense(id);
    expect(await db.getReceipt(id)).toBeNull();
    const s = await db.monthSummary(ym);
    expect(s.total).toBe(1234);
    expect(s.byCategory.reduce((a, c) => a + c.total, 0)).toBe(1234);
  });
});
