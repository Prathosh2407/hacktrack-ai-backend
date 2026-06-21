const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, 'hacktrack.db');
let db;
let SQL;

function saveDb() {
  if (!db) return;
  const data = db.export();
  fs.writeFileSync(dbPath, Buffer.from(data));
}

function prepare(sql) {
  return {
    get(...params) {
      const stmt = db.prepare(sql);
      try {
        if (params.length) stmt.bind(params);
        if (stmt.step()) return stmt.getAsObject();
        return undefined;
      } finally {
        stmt.free();
      }
    },
    all(...params) {
      const stmt = db.prepare(sql);
      const rows = [];
      try {
        if (params.length) stmt.bind(params);
        while (stmt.step()) rows.push(stmt.getAsObject());
        return rows;
      } finally {
        stmt.free();
      }
    },
    run(...params) {
      db.run(sql, params);
      saveDb();
      const changes = db.getRowsModified();
      const idRow = db.exec('SELECT last_insert_rowid() as id');
      const lastInsertRowid = idRow[0]?.values[0]?.[0] ?? 0;
      return { changes, lastInsertRowid };
    },
  };
}

function exec(sql) {
  db.exec(sql);
  saveDb();
}

async function initDatabase() {
  SQL = await initSqlJs();

  if (fs.existsSync(dbPath)) {
    const buffer = fs.readFileSync(dbPath);
    db = new SQL.Database(buffer);
  } else {
    db = new SQL.Database();
  }

  db.run('PRAGMA foreign_keys = ON');

  exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS hackathons (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      registration_deadline TEXT NOT NULL,
      event_date TEXT NOT NULL,
      team_members TEXT DEFAULT '[]',
      status TEXT DEFAULT 'planning',
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS internships (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      company TEXT NOT NULL,
      role TEXT NOT NULL,
      applied_date TEXT NOT NULL,
      status TEXT DEFAULT 'applied',
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS daily_tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      description TEXT DEFAULT '',
      due_date TEXT NOT NULL,
      completed INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS reminders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      hackathon_id INTEGER NOT NULL,
      reminder_type TEXT NOT NULL,
      message TEXT NOT NULL,
      trigger_date TEXT NOT NULL,
      sent INTEGER DEFAULT 0,
      read_status INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (hackathon_id) REFERENCES hackathons(id) ON DELETE CASCADE,
      UNIQUE(hackathon_id, reminder_type)
    );
  `);

  return { prepare, exec, saveDb };
}

module.exports = initDatabase();
