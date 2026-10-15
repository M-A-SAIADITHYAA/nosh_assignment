import { Dish, DishDraft } from './types.js';

const API_BASE = import.meta.env.VITE_API_BASE_URL || '';

export class ConflictError extends Error {
  currentDish: Dish;
  currentVersion: number;
  expectedVersion: number;

  constructor(
    message: string,
    currentDish: Dish,
    currentVersion: number,
    expectedVersion: number
  ) {
    super(message);
    this.name = 'ConflictError';
    this.currentDish = currentDish;
    this.currentVersion = currentVersion;
    this.expectedVersion = expectedVersion;
  }
}

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

export class NotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NotFoundError';
  }
}

export class NetworkError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NetworkError';
  }
}

/**
 * Fetches all dishes from backend
 */
export async function getDishes(): Promise<Dish[]> {
  try {
    const res = await fetch(`${API_BASE}/dishes`, {
      headers: {
        Accept: 'application/json',
      },
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error || `Failed to fetch dishes (HTTP ${res.status})`);
    }

    return await res.json();
  } catch (err) {
    if (err instanceof TypeError || (err as Error).name === 'TypeError') {
      throw new NetworkError('Unable to reach backend service. Please check your connection or server status.');
    }
    throw err;
  }
}

/**
 * Saves a dish draft with its expectedVersion
 */
export async function patchDish(
  dishId: string,
  draft: DishDraft,
  expectedVersion: number
): Promise<Dish> {
  let res: Response;

  try {
    res = await fetch(`${API_BASE}/dishes/${encodeURIComponent(dishId)}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        dishName: draft.dishName,
        isPublished: draft.isPublished,
        expectedVersion,
      }),
    });
  } catch {
    throw new NetworkError(
      'Network failure or backend unreachable. Your draft has been kept safe—you can retry saving when the connection recovers.'
    );
  }

  const data = await res.json().catch(() => ({}));

  if (res.status === 200) {
    return data as Dish;
  }

  if (res.status === 409) {
    throw new ConflictError(
      data.error || 'Another user or process has updated this dish on the server.',
      data.currentDish,
      data.currentVersion,
      data.expectedVersion
    );
  }

  if (res.status === 400) {
    throw new ValidationError(data.error || 'Invalid dish information.');
  }

  if (res.status === 404) {
    throw new NotFoundError(data.error || 'This dish was not found in the database.');
  }

  throw new Error(data.error || `Unexpected server error (HTTP ${res.status}).`);
}
