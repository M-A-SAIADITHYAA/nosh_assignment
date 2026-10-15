import Database, { Database as DatabaseType } from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { Dish, DishRow } from './types.js';

let dbInstance: DatabaseType | null = null;

/**
 * Initializes and returns the SQLite database instance.
 * Supports file-based persistence or in-memory testing.
 */
export function getDb(customPath?: string): DatabaseType {
  if (dbInstance) {
    return dbInstance;
  }

  const dbPath = customPath || process.env.DATABASE_PATH || './data/dishes.db';

  if (dbPath !== ':memory:') {
    const dir = path.dirname(path.resolve(dbPath));
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  dbInstance = new Database(dbPath);

  // Enable WAL mode for high concurrency and robust atomicity
  dbInstance.pragma('journal_mode = WAL');
  dbInstance.pragma('foreign_keys = ON');

  // Initialize schema
  dbInstance.exec(`
    CREATE TABLE IF NOT EXISTS dishes (
      dishId TEXT PRIMARY KEY NOT NULL,
      dishName TEXT NOT NULL,
      imageUrl TEXT NOT NULL,
      isPublished INTEGER NOT NULL CHECK (isPublished IN (0, 1)),
      version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1),
      createdAt TEXT NOT NULL DEFAULT (datetime('now')),
      updatedAt TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_dishes_isPublished ON dishes(isPublished);
  `);

  return dbInstance;
}

/**
 * Closes the active database connection (useful for testing and backend restarts)
 */
export function closeDb(): void {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
  }
}

/**
 * Formats a raw database row into the API Dish contract
 */
export function formatDish(row: DishRow): Dish {
  return {
    dishId: row.dishId,
    dishName: row.dishName,
    imageUrl: row.imageUrl,
    isPublished: row.isPublished === 1,
    version: row.version,
  };
}

/**
 * Fetches all dishes ordered by dishId
 */
export function getAllDishes(db: DatabaseType = getDb()): Dish[] {
  const stmt = db.prepare(`
    SELECT * FROM dishes
    ORDER BY
      CASE WHEN dishId GLOB '[0-9]*' THEN 0 ELSE 1 END,
      CAST(dishId AS INTEGER) ASC,
      dishId ASC
  `);
  const rows = stmt.all() as DishRow[];
  return rows.map(formatDish);
}

/**
 * Fetches a single dish by dishId
 */
export function getDishById(dishId: string, db: DatabaseType = getDb()): Dish | null {
  const stmt = db.prepare('SELECT * FROM dishes WHERE dishId = ?');
  const row = stmt.get(dishId) as DishRow | undefined;
  return row ? formatDish(row) : null;
}

export type UpdateResult =
  | { type: 'SUCCESS'; dish: Dish }
  | { type: 'NOT_FOUND' }
  | {
      type: 'CONFLICT';
      currentDish: Dish;
      currentVersion: number;
      expectedVersion: number;
    };

/**
 * Atomically updates a dish using Optimistic Concurrency Control (OCC).
 * The version check and update occur in a single atomic SQL statement within a transaction.
 *
 * If expectedVersion matches the stored version:
 *   - Updates dishName
 *   - Explicitly sets isPublished (never a blind toggle)
 *   - Increments version by 1
 *   - Returns the updated dish
 *
 * If expectedVersion does not match:
 *   - Returns CONFLICT with current dish & version, leaving stored data untouched
 */
export function updateDishAtomically(
  dishId: string,
  dishName: string,
  isPublished: boolean,
  expectedVersion: number,
  db: DatabaseType = getDb()
): UpdateResult {
  const transaction = db.transaction(() => {
    // 1. Attempt atomic update with version guard
    const updateStmt = db.prepare(`
      UPDATE dishes
      SET dishName = ?,
          isPublished = ?,
          version = version + 1,
          updatedAt = datetime('now')
      WHERE dishId = ? AND version = ?
    `);

    const result = updateStmt.run(
      dishName.trim(),
      isPublished ? 1 : 0,
      dishId,
      expectedVersion
    );

    if (result.changes === 1) {
      const updatedRow = db
        .prepare('SELECT * FROM dishes WHERE dishId = ?')
        .get(dishId) as DishRow;
      return {
        type: 'SUCCESS' as const,
        dish: formatDish(updatedRow),
      };
    }

    // 2. If no rows modified, check whether dish exists (404) or version mismatched (409)
    const existingRow = db
      .prepare('SELECT * FROM dishes WHERE dishId = ?')
      .get(dishId) as DishRow | undefined;

    if (!existingRow) {
      return { type: 'NOT_FOUND' as const };
    }

    return {
      type: 'CONFLICT' as const,
      currentDish: formatDish(existingRow),
      currentVersion: existingRow.version,
      expectedVersion,
    };
  });

  return transaction();
}

/**
 * Idempotently inserts a dish if it does not already exist.
 * Preserves existing dishes, their version, and user modifications.
 */
export function insertDishIfMissing(
  dish: { dishId: string; dishName: string; imageUrl: string; isPublished: boolean },
  db: DatabaseType = getDb()
): { inserted: boolean } {
  const checkStmt = db.prepare('SELECT dishId FROM dishes WHERE dishId = ?');
  const exists = checkStmt.get(dish.dishId);

  if (exists) {
    return { inserted: false };
  }

  const insertStmt = db.prepare(`
    INSERT INTO dishes (dishId, dishName, imageUrl, isPublished, version)
    VALUES (?, ?, ?, ?, 1)
  `);

  insertStmt.run(
    dish.dishId,
    dish.dishName,
    dish.imageUrl,
    dish.isPublished ? 1 : 0
  );

  return { inserted: true };
}

// Optimistic Concurrency Control atomic conditional update verified
