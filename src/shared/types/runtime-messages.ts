/**
 * Base interface for all runtime messages exchanged between extension components.
 * Uses a discriminated union pattern with the type field for type-safe message handling.
 *
 * @template TType - The specific message type string literal
 */
export interface RuntimeMessage<TType extends string = string> {
  type: TType;
}

/**
 * Represents a successful runtime operation response.
 *
 * @template TData - The type of data returned on success
 */
export interface RuntimeSuccessResponse<TData> {
  ok: true;
  data: TData;
}

/**
 * Represents a failed runtime operation response.
 */
export interface RuntimeErrorResponse {
  ok: false;
  error: string;
}

type NormalizedRuntimeSuccessData<TData> = [TData] extends [void]
  ? null
  : undefined extends TData
    ? Exclude<TData, undefined> | null
    : TData;

/**
 * Union type representing either a successful or failed runtime operation response.
 * Uses a discriminated union pattern with the ok field for type-safe error handling.
 *
 * @template TData - The type of data returned on success
 */
export type RuntimeResponse<TData> = RuntimeSuccessResponse<TData> | RuntimeErrorResponse;

/**
 * Creates a successful runtime response envelope.
 *
 * @template TData - The type of data returned on success
 * @param data - The payload to include in the response; defaults to null when omitted
 * @returns A successful runtime response
 */
export function runtimeSuccessResponse(): RuntimeSuccessResponse<null>;
export function runtimeSuccessResponse<TData>(data: TData): RuntimeSuccessResponse<NormalizedRuntimeSuccessData<TData>>;
export function runtimeSuccessResponse<TData>(data?: TData): RuntimeSuccessResponse<NormalizedRuntimeSuccessData<TData>> {
  return {
    ok: true,
    data: data ?? null,
  } as RuntimeSuccessResponse<NormalizedRuntimeSuccessData<TData>>;
}

/**
 * Creates a failed runtime response envelope.
 *
 * @param error - The error message to include in the response
 * @returns A failed runtime response
 */
export function runtimeErrorResponse(error: string): RuntimeErrorResponse {
  return {
    ok: false,
    error,
  };
}

/**
 * Type guard that checks if an unknown value is a RuntimeMessage with a specific type.
 * Provides type-safe narrowing for runtime message validation.
 *
 * @template TType - The expected message type string literal
 * @param message - The value to check
 * @param type - The expected message type to match against
 * @returns True if the message is a RuntimeMessage with the specified type
 */
export function hasRuntimeMessageType<TType extends string>(message: unknown, type: TType): message is RuntimeMessage<TType> {
  return Boolean(message && typeof message === 'object' && 'type' in message && (message as RuntimeMessage<TType>).type === type);
}

/**
 * Extracts data from a RuntimeResponse or throws an error if the response failed.
 * Provides a convenient way to unwrap response data with automatic error handling.
 *
 * @template TData - The type of data contained in the response
 * @param response - The runtime response to extract data from
 * @param fallbackError - Error message to use if response is undefined or has no error message
 * @returns The extracted data from a successful response
 * @throws Error if the response is undefined, failed, or contains an error
 */
export function getRuntimeResponseData<TData>(response: RuntimeResponse<TData> | undefined, fallbackError: string): TData {
  if (!response?.ok) {
    throw new Error(response?.error || fallbackError);
  }

  return response.data;
}

/**
 * Wraps a promise in a RuntimeResponse, converting any thrown errors to error responses.
 * Provides consistent error handling for async operations in the extension.
 *
 * @template TData - The type of data the promise resolves to
 * @param task - The promise to wrap
 * @returns A promise that always resolves to a RuntimeResponse (never rejects)
 */
export async function toRuntimeResponse(task: Promise<void>): Promise<RuntimeResponse<null>>;
export async function toRuntimeResponse<TData>(task: Promise<TData>): Promise<RuntimeResponse<NormalizedRuntimeSuccessData<TData>>>;
export async function toRuntimeResponse<TData>(task: Promise<TData>): Promise<RuntimeResponse<NormalizedRuntimeSuccessData<TData>>> {
  try {
    const data = await task;

    if (data === undefined) {
      return runtimeSuccessResponse() as RuntimeResponse<NormalizedRuntimeSuccessData<TData>>;
    }

    return runtimeSuccessResponse(data) as RuntimeResponse<NormalizedRuntimeSuccessData<TData>>;
  } catch (error) {
    return runtimeErrorResponse(error instanceof Error ? error.message : String(error));
  }
}
