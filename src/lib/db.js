import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

// Ensure database directory exists
const dbDir = path.join(process.cwd(), 'database');
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const dbPath = path.join(dbDir, 'service-parts.db');

let db = null;

export function getDb() {
  if (!db) {
    db = new Database(dbPath);
    db.pragma('foreign_keys = ON');
    initializeTables(db);
  }
  return db;
}

function initializeTables(database) {
  // Create Users table for authentication
  database.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      is_admin INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    )
  `);

  // Add is_admin column if it doesn't exist (migration)
  try {
    database.exec(`ALTER TABLE users ADD COLUMN is_admin INTEGER DEFAULT 0`);
  } catch (e) { /* Column already exists */ }

  // Insert default admin user if table is empty (demo:demo)
  const userCount = database.prepare('SELECT COUNT(*) as count FROM users').get();
  if (userCount.count === 0) {
    // Default password: demo (bcrypt hash) - first user is admin
    const bcrypt = require('bcryptjs');
    const defaultHash = bcrypt.hashSync('demo', 10);
    database.prepare('INSERT INTO users (username, password_hash, is_admin) VALUES (?, ?, 1)').run('demo', defaultHash);
  }

  // Ensure at least one admin exists (make first user admin if none)
  const adminCount = database.prepare('SELECT COUNT(*) as count FROM users WHERE is_admin = 1').get();
  if (adminCount.count === 0) {
    const firstUser = database.prepare('SELECT id FROM users ORDER BY id ASC LIMIT 1').get();
    if (firstUser) {
      database.prepare('UPDATE users SET is_admin = 1 WHERE id = ?').run(firstUser.id);
    }
  }

  // Create Categories table for user-defined categories
  database.exec(`
    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `);

  // Insert default categories if table is empty
  const categoryCount = database.prepare('SELECT COUNT(*) as count FROM categories').get();
  if (categoryCount.count === 0) {
    const defaultCategories = [
      'TV Parts', 'Refrigerator Parts', 'Washing Machine Parts',
      'Air Conditioning Parts', 'Dishwasher Parts', 'Microwave Parts',
      'Small Appliances', 'Other'
    ];
    const insertCat = database.prepare('INSERT OR IGNORE INTO categories (name) VALUES (?)');
    defaultCategories.forEach(cat => insertCat.run(cat));
  }

  // Create Locations table
  database.exec(`
    CREATE TABLE IF NOT EXISTS locations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      description TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `);

  // Create Parts table with serial_number field
  database.exec(`
    CREATE TABLE IF NOT EXISTS parts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      part_name TEXT NOT NULL,
      category TEXT NOT NULL,
      location TEXT,
      serial_number TEXT,
      description TEXT,
      purchase_price REAL DEFAULT 0,
      selling_price REAL DEFAULT 0,
      quantity_in_stock INTEGER DEFAULT 0,
      min_stock_level INTEGER DEFAULT 5,
      supplier TEXT,
      guarantee_available INTEGER DEFAULT 0,
      notes TEXT,
      date_added TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    )
  `);

  // Add serial_number column if it doesn't exist (migration)
  try {
    database.exec(`ALTER TABLE parts ADD COLUMN serial_number TEXT`);
  } catch (e) { /* Column already exists */ }

  // Add location column if it doesn't exist (migration)
  try {
    database.exec(`ALTER TABLE parts ADD COLUMN location TEXT`);
  } catch (e) { /* Column already exists */ }

  // Add notes column if it doesn't exist (migration)
  try {
    database.exec(`ALTER TABLE parts ADD COLUMN notes TEXT`);
  } catch (e) { /* Column already exists */ }

  // Add image_path column if it doesn't exist (migration)
  try {
    database.exec(`ALTER TABLE parts ADD COLUMN image_path TEXT`);
  } catch (e) { /* Column already exists */ }

  // Create Customers table
  database.exec(`
    CREATE TABLE IF NOT EXISTS customers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      surname TEXT NOT NULL,
      phone TEXT,
      email TEXT,
      address TEXT,
      notes TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    )
  `);

  // Create Service Records table
  database.exec(`
    CREATE TABLE IF NOT EXISTS service_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_id INTEGER NOT NULL,
      product_type TEXT NOT NULL,
      product_model TEXT,
      serial_number TEXT,
      issue_description TEXT,
      service_date TEXT DEFAULT (datetime('now')),
      status TEXT DEFAULT 'pending',
      notes TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
    )
  `);

  // Create Sales table with labour_cost
  database.exec(`
    CREATE TABLE IF NOT EXISTS sales (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      part_id INTEGER NOT NULL,
      customer_id INTEGER,
      service_record_id INTEGER,
      quantity INTEGER NOT NULL DEFAULT 1,
      unit_price REAL NOT NULL,
      labour_cost REAL DEFAULT 0,
      total_price REAL NOT NULL,
      guarantee_included INTEGER DEFAULT 0,
      sale_date TEXT DEFAULT (datetime('now')),
      notes TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (part_id) REFERENCES parts(id) ON DELETE RESTRICT,
      FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL,
      FOREIGN KEY (service_record_id) REFERENCES service_records(id) ON DELETE SET NULL
    )
  `);

  // Add labour_cost column if it doesn't exist (migration)
  try {
    database.exec(`ALTER TABLE sales ADD COLUMN labour_cost REAL DEFAULT 0`);
  } catch (e) { /* Column already exists */ }

  // Create Purchases table
  database.exec(`
    CREATE TABLE IF NOT EXISTS purchases (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      part_id INTEGER NOT NULL,
      quantity INTEGER NOT NULL,
      unit_cost REAL NOT NULL,
      total_cost REAL NOT NULL,
      supplier TEXT,
      purchase_date TEXT DEFAULT (datetime('now')),
      notes TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (part_id) REFERENCES parts(id) ON DELETE RESTRICT
    )
  `);

  // Create indexes
  database.exec(`
    CREATE INDEX IF NOT EXISTS idx_parts_category ON parts(category);
    CREATE INDEX IF NOT EXISTS idx_parts_name ON parts(part_name);
    CREATE INDEX IF NOT EXISTS idx_parts_serial ON parts(serial_number);
    CREATE INDEX IF NOT EXISTS idx_customers_name ON customers(name, surname);
    CREATE INDEX IF NOT EXISTS idx_sales_date ON sales(sale_date);
    CREATE INDEX IF NOT EXISTS idx_purchases_date ON purchases(purchase_date);
    CREATE INDEX IF NOT EXISTS idx_service_records_customer ON service_records(customer_id);
  `);
}

export default getDb;
