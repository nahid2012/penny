# Penny

Personal expense tracker. Single user, fully offline, Android (React + Capacitor + SQLite). Currency: BDT (`src/config.js`).

## Setup

    npm install
    npm run build
    npx cap sync
    npx cap open android   # run on a device from Android Studio

## Data

SQLite database `penny` is created on first launch. Schema changes are
append-only migrations in `src/db.js` (tracked with `PRAGMA user_version`).
All SQL lives in `src/db.js`.

### Expenses and receipts

Every purchase is exactly one row in `expenses`, and `expenses.amount_minor`
is the only amount that counts toward totals.

- `kind = 'simple'`: a plain expense (rent, a payment, one purchase).
- `kind = 'receipt'`: an itemised shopping list. Its amount is the sum of its
  rows in `expense_items` (name, category, unit price, quantity, line total),
  written in the same transaction as the items.

Per-category numbers read the `expense_lines` view: one line per simple
expense and one per receipt item, never the receipt row itself. That is what
keeps a receipt from being counted twice, and makes category sums equal the
month total. Quantities are stored as integer thousandths (1.5 kg = 1500).

## Backup

Settings → Export backup (JSON, shared via Android share sheet). Backup
format is version 2 (includes receipts); version 1 files still restore.
Settings → Restore from file replaces all expenses.

## Tests

    npm test      # money/quantity maths, receipt validation and totals
