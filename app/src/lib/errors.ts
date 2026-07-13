import { NextResponse } from "next/server";
import type { ZodError } from "zod";
import type { ErrorCode, ErrorResponse } from "./types";

const STATUS_BY_CODE: Record<ErrorCode, number> = {
  validation_error: 400,
  not_found: 404,
  invalid_state: 409,
  internal_error: 500,
};

export class ApiError extends Error {
  code: ErrorCode;
  details?: unknown;

  constructor(code: ErrorCode, message: string, details?: unknown) {
    super(message);
    this.code = code;
    this.details = details;
  }
}

export function errorResponse(code: ErrorCode, message: string, details?: unknown) {
  const body: ErrorResponse = { error: { code, message, ...(details !== undefined ? { details } : {}) } };
  return NextResponse.json(body, { status: STATUS_BY_CODE[code] });
}

export function zodErrorResponse(err: ZodError) {
  return errorResponse("validation_error", "Request failed validation", err.flatten());
}

/**
 * Wraps a route handler, converting thrown ApiError into the standard
 * error envelope and any other thrown error into a masked 500. Never
 * leaks internals (stack traces) to the client; logs server-side.
 */
export function withErrorHandling<Args extends unknown[]>(
  handler: (...args: Args) => Promise<Response>
): (...args: Args) => Promise<Response> {
  return async (...args: Args) => {
    try {
      return await handler(...args);
    } catch (err) {
      if (err instanceof ApiError) {
        return errorResponse(err.code, err.message, err.details);
      }
      console.error("Unhandled error in route handler:", err);
      return errorResponse("internal_error", "An unexpected error occurred");
    }
  };
}
