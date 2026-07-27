export type AppErrorCode =
  | "bad_request"
  | "unauthorized"
  | "forbidden"
  | "not_found"
  | "conflict"
  | "payment_required"
  | "upstream_error"
  | "internal";

const STATUS_BY_CODE: Record<AppErrorCode, number> = {
  bad_request: 400,
  unauthorized: 401,
  forbidden: 403,
  not_found: 404,
  conflict: 409,
  payment_required: 402,
  upstream_error: 502,
  internal: 500,
};

export class AppError extends Error {
  readonly code: AppErrorCode;
  readonly status: number;
  readonly details?: unknown;
  /** Amharic message safe to surface directly in the UI. */
  readonly messageAm?: string;

  constructor(
    code: AppErrorCode,
    message: string,
    options: { details?: unknown; messageAm?: string; cause?: unknown } = {},
  ) {
    super(message, { cause: options.cause });
    this.name = "AppError";
    this.code = code;
    this.status = STATUS_BY_CODE[code];
    this.details = options.details;
    this.messageAm = options.messageAm;
  }
}

export function badRequest(message: string, details?: unknown): AppError {
  return new AppError("bad_request", message, { details });
}

export function notFound(message: string): AppError {
  return new AppError("not_found", message);
}

export function unauthorized(message = "Sign in required"): AppError {
  return new AppError("unauthorized", message, {
    messageAm: "እባክዎ መጀመሪያ ይግቡ።",
  });
}

export function forbidden(message = "Not allowed"): AppError {
  return new AppError("forbidden", message);
}

export function paymentRequired(message: string): AppError {
  return new AppError("payment_required", message, {
    messageAm: "ይህን ለማግኘት ክፍያ ያስፈልጋል።",
  });
}

export function upstreamError(message: string, cause?: unknown): AppError {
  return new AppError("upstream_error", message, { cause });
}
