/**
 * Read a required string argument from a tool invocation payload.
 */
export function readRequiredString(argumentsObject: Record<string, unknown>, key: string): string {
  const value = argumentsObject[key];

  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`INVALID_TOOL_ARGUMENT: ${key}`);
  }

  return value.trim();
}

/**
 * Read an optional string argument from a tool invocation payload.
 */
export function readOptionalString(argumentsObject: Record<string, unknown>, key: string): string | undefined {
  const value = argumentsObject[key];
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

/**
 * Read a required non-empty string without trimming its returned value.
 */
export function readRequiredRawString(argumentsObject: Record<string, unknown>, key: string): string {
  const value = argumentsObject[key];

  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`TOOL_ARGUMENT_INVALID:${key}`);
  }

  return value;
}

/**
 * Read an optional non-empty string without trimming its returned value.
 */
export function readOptionalRawString(argumentsObject: Record<string, unknown>, key: string): string | undefined {
  const value = argumentsObject[key];

  if (value === undefined) return undefined;
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`TOOL_ARGUMENT_INVALID:${key}`);
  }

  return value;
}

/**
 * Read an optional boolean argument.
 */
export function readOptionalBoolean(argumentsObject: Record<string, unknown>, key: string): boolean | undefined {
  const value = argumentsObject[key];

  if (value === undefined) return undefined;
  if (typeof value !== 'boolean') {
    throw new Error(`TOOL_ARGUMENT_INVALID:${key}`);
  }

  return value;
}

/**
 * Read an optional positive finite number argument.
 */
export function readOptionalPositiveNumber(argumentsObject: Record<string, unknown>, key: string): number | undefined {
  const value = argumentsObject[key];

  if (value === undefined) return undefined;
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    throw new Error(`TOOL_ARGUMENT_INVALID:${key}`);
  }

  return value;
}

/**
 * Read an optional string-array argument from a tool invocation payload.
 */
export function readOptionalStringArray(argumentsObject: Record<string, unknown>, key: string): string[] | undefined {
  const value = argumentsObject[key];

  if (!Array.isArray(value)) {
    return undefined;
  }

  const strings = value
    .filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
    .map((item) => item.trim());

  return strings.length ? strings : undefined;
}

/**
 * Read an optional enum argument and validate it against the allowed values.
 */
export function readOptionalEnum<T extends string>(
  argumentsObject: Record<string, unknown>,
  key: string,
  allowedValues: readonly T[],
): T | undefined {
  const value = argumentsObject[key];
  return typeof value === 'string' && allowedValues.includes(value as T) ? (value as T) : undefined;
}

/**
 * Read an optional integer argument and clamp it into the provided range.
 */
export function readOptionalInteger(
  argumentsObject: Record<string, unknown>,
  key: string,
  minimum: number,
  maximum: number,
): number | undefined {
  const value = argumentsObject[key];

  if (typeof value !== 'number' || !Number.isInteger(value)) {
    return undefined;
  }

  return Math.min(Math.max(value, minimum), maximum);
}
