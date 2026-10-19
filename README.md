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

## Backup

Settings → Export backup (JSON, shared via Android share sheet).
Settings → Restore from file replaces all expenses.

## Tests

    npm test      # money parsing, month ranges, date validation
