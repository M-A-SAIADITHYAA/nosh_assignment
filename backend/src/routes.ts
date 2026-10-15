import { Router, Request, Response } from 'express';
import {
  getAllDishes,
  getDishById,
  updateDishAtomically,
} from './db.js';
import { validatePatchDish } from './validation.js';
import { sseHandler, broadcastDishUpdate } from './sse.js';

export const router = Router();

/**
 * Health check endpoint
 */
router.get('/health', (_req: Request, res: Response) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

/**
 * Optional Bonus: Server-Sent Events (SSE) endpoint for real-time dish updates
 */
router.get('/events', sseHandler);

/**
 * GET /dishes
 * Returns all dishes, including current published status and version.
 */
router.get('/dishes', (_req: Request, res: Response) => {
  try {
    const dishes = getAllDishes();
    res.status(200).json(dishes);
  } catch (error) {
    res.status(500).json({
      error: 'Failed to retrieve dishes.',
      details: error instanceof Error ? error.message : String(error),
    });
  }
});

/**
 * GET /dishes/:dishId
 * Fetches a single dish by ID
 */
router.get('/dishes/:dishId', (req: Request, res: Response) => {
  const rawId = req.params.dishId;
  const dishId = Array.isArray(rawId) ? rawId[0] : rawId;
  const dish = getDishById(dishId);

  if (!dish) {
    res.status(404).json({
      error: `Dish with ID '${dishId}' was not found.`,
      dishId,
    });
    return;
  }

  res.status(200).json(dish);
});

/**
 * PATCH /dishes/:dishId
 * Accepts: { dishName, isPublished, expectedVersion }
 *
 * Implements:
 * 1. Field type validation & positive integer version check
 * 2. Business validation (publishing requires non-empty trimmed name and valid HTTP/S image URL)
 * 3. Atomic Optimistic Concurrency Control (OCC)
 * 4. 409 Conflict if expectedVersion differs from current stored version
 * 5. Explicit status updates (never a blind toggle)
 * 6. SSE broadcast on successful save
 */
router.patch('/dishes/:dishId', (req: Request, res: Response) => {
  const rawId = req.params.dishId;
  const dishId = Array.isArray(rawId) ? rawId[0] : rawId;

  // 1. Fetch current dish to verify existence and retrieve imageUrl for validation
  const currentDish = getDishById(dishId);
  if (!currentDish) {
    res.status(404).json({
      error: `Dish with ID '${dishId}' was not found.`,
      dishId,
    });
    return;
  }

  // 2. Validate input and business constraints
  const validation = validatePatchDish(dishId, req.body, currentDish.imageUrl);
  if (!validation.valid) {
    res.status(400).json({
      error: validation.error,
    });
    return;
  }

  const { dishName, isPublished, expectedVersion } = req.body as {
    dishName: string;
    isPublished: boolean;
    expectedVersion: number;
  };

  try {
    // 3. Atomically attempt version-checked update
    const result = updateDishAtomically(
      dishId,
      dishName,
      isPublished,
      expectedVersion
    );

    if (result.type === 'NOT_FOUND') {
      res.status(404).json({
        error: `Dish with ID '${dishId}' was not found.`,
        dishId,
      });
      return;
    }

    if (result.type === 'CONFLICT') {
      res.status(409).json({
        error: 'Conflict: Dish has been modified by another update.',
        message: `Your draft expected version ${expectedVersion}, but the server is currently at version ${result.currentVersion}.`,
        currentDish: result.currentDish,
        currentVersion: result.currentVersion,
        expectedVersion,
      });
      return;
    }

    // 4. Success: broadcast to SSE listeners and return updated dish
    broadcastDishUpdate(result.dish);

    res.status(200).json(result.dish);
  } catch (error) {
    res.status(500).json({
      error: 'An unexpected server error occurred while updating the dish.',
      details: error instanceof Error ? error.message : String(error),
    });
  }
});
