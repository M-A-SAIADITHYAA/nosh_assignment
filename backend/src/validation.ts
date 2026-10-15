import { ValidationResult } from './types.js';

/**
 * Validates that a string is a well-formed HTTP or HTTPS URL.
 * Does not perform reachability or network calls as per specification.
 */
export function isValidHttpUrl(urlStr: unknown): boolean {
  if (typeof urlStr !== 'string' || !urlStr.trim()) {
    return false;
  }
  try {
    const parsed = new URL(urlStr);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Validates the PATCH /dishes/:dishId payload and checks business rules:
 * - dishId must be valid non-empty string
 * - expectedVersion must be positive integer
 * - dishName must be a string
 * - isPublished must be boolean
 * - If isPublished is true:
 *   - dishName must be non-empty after trimming
 *   - imageUrl must be a valid HTTP/HTTPS URL
 */
export function validatePatchDish(
  dishId: unknown,
  body: unknown,
  currentImageUrl?: string
): ValidationResult {
  if (typeof dishId !== 'string' || !dishId.trim()) {
    return {
      valid: false,
      error: 'Invalid or missing dishId identifier in URL parameter.',
    };
  }

  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    return {
      valid: false,
      error: 'Request body must be a valid JSON object.',
    };
  }

  const payload = body as Record<string, unknown>;

  // 1. Validate expectedVersion
  if (payload.expectedVersion === undefined || payload.expectedVersion === null) {
    return {
      valid: false,
      error: 'Missing required field: expectedVersion.',
    };
  }

  if (
    typeof payload.expectedVersion !== 'number' ||
    !Number.isInteger(payload.expectedVersion) ||
    payload.expectedVersion < 1
  ) {
    return {
      valid: false,
      error: 'expectedVersion must be a positive integer greater than or equal to 1.',
    };
  }

  // 2. Validate dishName
  if (payload.dishName === undefined || payload.dishName === null) {
    return {
      valid: false,
      error: 'Missing required field: dishName.',
    };
  }

  if (typeof payload.dishName !== 'string') {
    return {
      valid: false,
      error: 'dishName must be a string.',
    };
  }

  // 3. Validate isPublished
  if (payload.isPublished === undefined || payload.isPublished === null) {
    return {
      valid: false,
      error: 'Missing required field: isPublished.',
    };
  }

  if (typeof payload.isPublished !== 'boolean') {
    return {
      valid: false,
      error: 'isPublished must be a boolean (true or false).',
    };
  }

  // 4. Validate publishing requirements
  if (payload.isPublished === true) {
    if (payload.dishName.trim().length === 0) {
      return {
        valid: false,
        error: 'A published dish must have a non-empty name after trimming.',
      };
    }

    const imageUrlToCheck = (typeof payload.imageUrl === 'string' ? payload.imageUrl : currentImageUrl) || '';
    if (!isValidHttpUrl(imageUrlToCheck)) {
      return {
        valid: false,
        error: 'A published dish must have a valid HTTP or HTTPS image URL.',
      };
    }
  }

  return { valid: true };
}
