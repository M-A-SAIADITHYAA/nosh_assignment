import test, { describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import fs from 'fs';
import path from 'path';
import { createApp } from '../src/app.js';
import { getDb, closeDb } from '../src/db.js';
import { runSeed } from '../seed/seed.js';

const TEST_DB_PATH = path.resolve('./data/test-dishes.db');

describe('Nosh Dish Dashboard Backend API Test Suite', () => {
  let app: ReturnType<typeof createApp>;

  beforeEach(() => {
    // Ensure clean test database file
    closeDb();
    if (fs.existsSync(TEST_DB_PATH)) {
      fs.unlinkSync(TEST_DB_PATH);
    }
    process.env.DATABASE_PATH = TEST_DB_PATH;
    app = createApp(TEST_DB_PATH);
    // Seed base dishes + test fixtures
    runSeed({ withFixtures: true });
  });

  afterEach(() => {
    closeDb();
    if (fs.existsSync(TEST_DB_PATH)) {
      try {
        fs.unlinkSync(TEST_DB_PATH);
      } catch {
        // ignore
      }
    }
  });

  // 1. Database & Seed Idempotency
  test('A. Idempotent seed: rerunning does not create duplicates or overwrite existing edits', () => {
    const db = getDb();
    // 1. Initial count
    const initialCount = db.prepare('SELECT COUNT(*) as count FROM dishes').get() as { count: number };
    assert.strictEqual(initialCount.count, 8); // 5 base + 3 fixtures

    // 2. Modify dish '1'
    db.prepare('UPDATE dishes SET dishName = ?, version = 5 WHERE dishId = ?').run(
      'Custom Modified Jeera Rice',
      '1'
    );

    // 3. Rerun seed
    const seedResult = runSeed({ withFixtures: true });
    assert.strictEqual(seedResult.insertedCount, 0, 'No dishes should be re-inserted');
    assert.strictEqual(seedResult.preservedCount, 8, 'All existing dishes should be preserved');

    // 4. Verify modified dish '1' was NOT overwritten
    const dish1 = db.prepare('SELECT * FROM dishes WHERE dishId = ?').get('1') as any;
    assert.strictEqual(dish1.dishName, 'Custom Modified Jeera Rice');
    assert.strictEqual(dish1.version, 5);
  });

  // 2. GET /dishes
  test('B. GET /dishes returns all dishes with version and boolean published status', async () => {
    const res = await request(app).get('/dishes');
    assert.strictEqual(res.status, 200);
    assert.ok(Array.isArray(res.body));
    assert.ok(res.body.length >= 5);

    const first = res.body[0];
    assert.ok(first.dishId);
    assert.ok(first.dishName);
    assert.ok(first.imageUrl);
    assert.strictEqual(typeof first.isPublished, 'boolean');
    assert.strictEqual(typeof first.version, 'number');
  });

  // 3. GET /dishes/:dishId
  test('C. GET /dishes/:dishId returns single dish or 404 for unknown ID', async () => {
    const okRes = await request(app).get('/dishes/1');
    assert.strictEqual(okRes.status, 200);
    assert.strictEqual(okRes.body.dishId, '1');

    const notFoundRes = await request(app).get('/dishes/unknown-999');
    assert.strictEqual(notFoundRes.status, 404);
    assert.ok(notFoundRes.body.error);
  });

  // 4. PATCH /dishes/:dishId - Happy path
  test('D. PATCH /dishes/:dishId atomically updates name & status, incrementing version', async () => {
    const payload = {
      dishName: 'Paneer Curry Special',
      isPublished: true,
      expectedVersion: 1,
    };

    const res = await request(app).patch('/dishes/2').send(payload);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.dishName, 'Paneer Curry Special');
    assert.strictEqual(res.body.isPublished, true);
    assert.strictEqual(res.body.version, 2);

    // Verify persisted in DB
    const db = getDb();
    const stored = db.prepare('SELECT * FROM dishes WHERE dishId = ?').get('2') as any;
    assert.strictEqual(stored.dishName, 'Paneer Curry Special');
    assert.strictEqual(stored.isPublished, 1);
    assert.strictEqual(stored.version, 2);
  });

  // 5. PATCH /dishes/:dishId - Explicit status, not a blind toggle
  test('E. PATCH does not implement status update as a blind toggle', async () => {
    // Dish 1 starts published: true, version 1
    // Update it with isPublished: true again
    const res = await request(app).patch('/dishes/1').send({
      dishName: 'Jeera Rice Fresh',
      isPublished: true,
      expectedVersion: 1,
    });

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.isPublished, true, 'Status must remain true, not toggled to false');
    assert.strictEqual(res.body.version, 2);
  });

  // 6. PATCH /dishes/:dishId - Optimistic Concurrency Control (409 Conflict)
  test('F. PATCH with outdated expectedVersion returns 409 Conflict without modifying database', async () => {
    // 1. Advance version of dish 1 to version 2
    await request(app).patch('/dishes/1').send({
      dishName: 'First Valid Update',
      isPublished: true,
      expectedVersion: 1,
    });

    // 2. Attempt stale update with expectedVersion: 1
    const conflictRes = await request(app).patch('/dishes/1').send({
      dishName: 'Stale Attempt from Tab B',
      isPublished: false,
      expectedVersion: 1,
    });

    assert.strictEqual(conflictRes.status, 409);
    assert.ok(conflictRes.body.error);
    assert.strictEqual(conflictRes.body.currentVersion, 2);
    assert.strictEqual(conflictRes.body.currentDish.dishName, 'First Valid Update');

    // 3. Confirm database was left intact
    const db = getDb();
    const stored = db.prepare('SELECT * FROM dishes WHERE dishId = ?').get('1') as any;
    assert.strictEqual(stored.dishName, 'First Valid Update');
    assert.strictEqual(stored.version, 2);
  });

  // 7. Atomic Concurrency under parallel requests
  test('G. Concurrent PATCH requests: exactly one succeeds, others receive 409 Conflict', async () => {
    const numRequests = 5;
    const promises = Array.from({ length: numRequests }, (_, i) =>
      request(app)
        .patch('/dishes/3')
        .send({
          dishName: `Concurrent Update #${i}`,
          isPublished: true,
          expectedVersion: 1,
        })
    );

    const responses = await Promise.all(promises);
    const successResponses = responses.filter((r) => r.status === 200);
    const conflictResponses = responses.filter((r) => r.status === 409);

    assert.strictEqual(successResponses.length, 1, 'Exactly one concurrent request must succeed');
    assert.strictEqual(
      conflictResponses.length,
      numRequests - 1,
      'Remaining concurrent requests must return 409'
    );

    // Stored version must be exactly 2
    const db = getDb();
    const stored = db.prepare('SELECT version FROM dishes WHERE dishId = ?').get('3') as any;
    assert.strictEqual(stored.version, 2);
  });

  // 8. Backend Validation: Empty name on publish
  test('H. Publishing dish with empty name (or whitespace) is rejected with 400', async () => {
    const res = await request(app).patch('/dishes/1').send({
      dishName: '     ',
      isPublished: true,
      expectedVersion: 1,
    });

    assert.strictEqual(res.status, 400);
    assert.match(res.body.error, /non-empty name/i);

    // Stored values remain unchanged
    const db = getDb();
    const stored = db.prepare('SELECT * FROM dishes WHERE dishId = ?').get('1') as any;
    assert.strictEqual(stored.dishName, 'Jeera Rice');
    assert.strictEqual(stored.version, 1);
  });

  // 9. Backend Validation: Invalid image URL on publish (using test fixture)
  test('I. Publishing dish with invalid image URL is rejected with 400 (verified with test data)', async () => {
    // "test-invalid-url" has imageUrl: "not-a-valid-url" and isPublished: false
    const res = await request(app).patch('/dishes/test-invalid-url').send({
      dishName: 'Valid Name But Invalid Image URL',
      isPublished: true,
      expectedVersion: 1,
    });

    assert.strictEqual(res.status, 400);
    assert.match(res.body.error, /valid HTTP or HTTPS image URL/i);

    // Stored dish remains unpublished with version 1
    const db = getDb();
    const stored = db.prepare('SELECT * FROM dishes WHERE dishId = ?').get('test-invalid-url') as any;
    assert.strictEqual(stored.isPublished, 0);
    assert.strictEqual(stored.version, 1);
  });

  // 10. Backend Validation: Type checking and invalid payloads
  test('J. Invalid payload types return 400 Bad Request', async () => {
    // Missing expectedVersion
    const missingVer = await request(app).patch('/dishes/1').send({
      dishName: 'Rice',
      isPublished: true,
    });
    assert.strictEqual(missingVer.status, 400);

    // Float expectedVersion
    const floatVer = await request(app).patch('/dishes/1').send({
      dishName: 'Rice',
      isPublished: true,
      expectedVersion: 1.5,
    });
    assert.strictEqual(floatVer.status, 400);

    // String expectedVersion
    const stringVer = await request(app).patch('/dishes/1').send({
      dishName: 'Rice',
      isPublished: true,
      expectedVersion: '1',
    });
    assert.strictEqual(stringVer.status, 400);

    // Non-boolean isPublished
    const stringPublished = await request(app).patch('/dishes/1').send({
      dishName: 'Rice',
      isPublished: 'true',
      expectedVersion: 1,
    });
    assert.strictEqual(stringPublished.status, 400);
  });

  // 11. Persistence Across Restart
  test('K. Changes survive backend restart', async () => {
    // 1. Save an update
    await request(app).patch('/dishes/4').send({
      dishName: 'Persistent Biryani',
      isPublished: true,
      expectedVersion: 1,
    });

    // 2. Simulate complete restart: close DB, recreate app instance
    closeDb();
    const restartedApp = createApp(TEST_DB_PATH);

    // 3. Verify values retrieved from fresh connection
    const res = await request(restartedApp).get('/dishes/4');
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.dishName, 'Persistent Biryani');
    assert.strictEqual(res.body.version, 2);
  });
});
