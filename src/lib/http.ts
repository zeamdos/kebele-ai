import { NextResponse } from "next/server";
import { AppError } from "@/lib/errors";
import { ZodError } from "zod";

export function jsonOk<T>(data: T, init?: ResponseInit): NextResponse {
  return NextResponse.json({ ok: true, data }, init);
}

export function jsonError(error: unknown, fallbackStatus = 500): NextResponse {
  if (error instanceof AppError) {
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: error.code,
          message: error.message,
          messageAm: error.messageAm,
          details: error.details,
        },
      },
      { status: error.status },
    );
  }

  if (error instanceof ZodError) {
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: "bad_request",
          message: "Invalid request",
          details: error.flatten(),
        },
      },
      { status: 400 },
    );
  }

  console.error("[kebele-navigator]", error);
  return NextResponse.json(
    {
      ok: false,
      error: {
        code: "internal",
        message: error instanceof Error ? error.message : "Unexpected error",
      },
    },
    { status: fallbackStatus },
  );
}

export async function readJson<T>(request: Request): Promise<T> {
  try {
    return (await request.json()) as T;
  } catch {
    throw new AppError("bad_request", "Request body must be JSON");
  }
}
