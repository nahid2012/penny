import { DatabaseSync } from "node:sqlite";

export const CapacitorSQLite = {};
export class SQLiteConnection {
  async createConnection() {
    const raw = new DatabaseSync(":memory:");
    return {
      async open() {
        if (globalThis.__seed) globalThis.__seed(raw);
      },
      async execute(sql) { raw.exec(sql); },
      async query(sql, params = []) { return { values: raw.prepare(sql).all(...params) }; },
      async run(sql, params = []) {
        const r = raw.prepare(sql).run(...params);
        return { changes: { changes: r.changes, lastId: Number(r.lastInsertRowid) } };
      },
      async executeSet(set) {
        raw.exec("BEGIN");
        try {
          for (const s of set) raw.prepare(s.statement).run(...s.values);
          raw.exec("COMMIT");
        } catch (e) { raw.exec("ROLLBACK"); throw e; }
      },
    };
  }
}
