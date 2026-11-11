import { EbbError } from "./errors.js";

/**
 * A value the surrounding parse requires; checked instead of asserted with `!`.
 * @deprecated Import from `@velella/ebb` instead; subpath imports will be removed in 1.0.
 */
export function required<T>(value: T | undefined, what: string): T {
  if (value === undefined) throw new EbbError("internal", `missing ${what}`);
  return value;
}
