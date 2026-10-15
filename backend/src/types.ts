export interface Dish {
  dishId: string;
  dishName: string;
  imageUrl: string;
  isPublished: boolean;
  version: number;
}

export interface DishRow {
  dishId: string;
  dishName: string;
  imageUrl: string;
  isPublished: number; // 0 or 1 in SQLite
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface PatchDishInput {
  dishName?: unknown;
  isPublished?: unknown;
  expectedVersion?: unknown;
}

export interface ValidationResult {
  valid: boolean;
  error?: string;
  details?: Record<string, string>;
}
