import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { getDb, closeDb, insertDishIfMissing, getAllDishes } from '../src/db.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface SeedDish {
  dishId: string;
  dishName: string;
  imageUrl: string;
  isPublished: boolean;
}

export function runSeed(options: { withFixtures?: boolean; force?: boolean } = {}) {
  const db = getDb();

  const dishesPath = path.resolve(__dirname, 'dishes.json');
  const fixturesPath = path.resolve(__dirname, 'test-fixtures.json');

  if (!fs.existsSync(dishesPath)) {
    throw new Error(`Seed file not found at ${dishesPath}`);
  }

  const baseDishes: SeedDish[] = JSON.parse(fs.readFileSync(dishesPath, 'utf-8'));
  let dishesToSeed: SeedDish[] = [...baseDishes];

  if (options.withFixtures) {
    if (fs.existsSync(fixturesPath)) {
      const fixtures: SeedDish[] = JSON.parse(fs.readFileSync(fixturesPath, 'utf-8'));
      dishesToSeed = [...dishesToSeed, ...fixtures];
      console.log(`Included ${fixtures.length} test fixtures for edge-case validation.`);
    }
  }

  if (options.force) {
    console.log('⚠️  --force flag passed. Clearing existing dishes table...');
    db.prepare('DELETE FROM dishes').run();
  }

  let insertedCount = 0;
  let preservedCount = 0;

  for (const dish of dishesToSeed) {
    const result = insertDishIfMissing(dish, db);
    if (result.inserted) {
      insertedCount++;
      console.log(`✅ [INSERTED] ID: ${dish.dishId} | "${dish.dishName}" (version: 1)`);
    } else {
      preservedCount++;
      console.log(`🛡️  [PRESERVED] ID: ${dish.dishId} | Existing edits and version left untouched.`);
    }
  }

  const all = getAllDishes(db);
  console.log('\n--- Seed Summary ---');
  console.log(`Newly Inserted: ${insertedCount}`);
  console.log(`Preserved/Skipped: ${preservedCount}`);
  console.log(`Total Dishes in Database: ${all.length}`);
  console.log('--------------------\n');

  return { insertedCount, preservedCount, total: all.length };
}

// Execute when invoked directly from CLI
if (process.argv[1] && process.argv[1].endsWith('seed.ts')) {
  const withFixtures = process.argv.includes('--with-fixtures');
  const force = process.argv.includes('--force');

  console.log('🌱 Starting idempotent seed process...');
  try {
    runSeed({ withFixtures, force });
  } catch (err) {
    console.error('❌ Error during seeding:', err);
    process.exit(1);
  } finally {
    closeDb();
  }
}
