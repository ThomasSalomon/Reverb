import { NextResponse } from "next/server";
import { AppError } from "@/utils/errors";

type RouteErrorOptions = Readonly<{
  operation: string;
  fallbackMessage: string;
}>;

/** HTTP-boundary translation. Application code throws AppError, never NextResponse. */
export function routeErrorResponse(
  error: unknown,
  options: RouteErrorOptions,
): NextResponse {
  if (error instanceof AppError && error.isOperational) {
    return NextResponse.json(
      { error: error.message, code: error.code },
      { status: error.statusCode },
    );
  }

  console.error(options.operation, error);
  return NextResponse.json(
    { error: options.fallbackMessage, code: "INTERNAL_ERROR" },
    { status: 500 },
  );
}
