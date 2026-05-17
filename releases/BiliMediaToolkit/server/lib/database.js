import Database from 'better-sqlite3';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync, mkdirSync } from 'node:fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_DIR = resolve(__dirname, '../../data');
const DB_PATH = resolve(DB_DIR, 'downloads.db');

let db = null;

export function initDB() {
  if (db) return db;

  if (!existsSync(DB_DIR)) {
    mkdirSync(DB_DIR, { recursive: true });
  }

  db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');

  db.exec(`
    CREATE TABLE IF NOT EXISTS downloads (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      url TEXT,
      type TEXT,
      quality TEXT,
      format TEXT,
      filePath TEXT,
      fileSize INTEGER DEFAULT 0,
      status TEXT DEFAULT 'completed',
      createdAt TEXT DEFAULT (datetime('now', 'localtime'))
    )
  `);

  return db;
}

export function addRecord(record) {
  const database = initDB();
  const stmt = database.prepare(`
    INSERT INTO downloads (title, url, type, quality, format, filePath, fileSize, status)
    VALUES (@title, @url, @type, @quality, @format, @filePath, @fileSize, @status)
  `);
  const result = stmt.run({
    title: record.title || '',
    url: record.url || '',
    type: record.type || 'video',
    quality: record.quality || '',
    format: record.format || 'mp4',
    filePath: record.filePath || '',
    fileSize: record.fileSize || 0,
    status: record.status || 'completed'
  });
  return result.lastInsertRowid;
}

export function getRecords(page = 1, limit = 20) {
  const database = initDB();
  const offset = (page - 1) * limit;

  const countStmt = database.prepare('SELECT COUNT(*) as total FROM downloads');
  const { total } = countStmt.get();

  const stmt = database.prepare('SELECT * FROM downloads ORDER BY createdAt DESC LIMIT ? OFFSET ?');
  const records = stmt.all(limit, offset);

  return {
    records,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit)
  };
}

export function deleteRecord(id) {
  const database = initDB();
  const stmt = database.prepare('DELETE FROM downloads WHERE id = ?');
  const result = stmt.run(id);
  return result.changes > 0;
}

export function clearRecords() {
  const database = initDB();
  const stmt = database.prepare('DELETE FROM downloads');
  stmt.run();
  return true;
}
