import { NextResponse } from "next/server";
import { DiaryError } from "@/services/diary";

const MAX_DIARY_PAYLOAD_BYTES = 16 * 1024;

export async function readDiaryBody(request: Request): Promise<unknown> {
  const declaredLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_DIARY_PAYLOAD_BYTES) {
    throw new Response("Payload demasiado grande", { status: 413 });
  }

  const text = await request.text();
  if (new TextEncoder().encode(text).byteLength > MAX_DIARY_PAYLOAD_BYTES) {
    throw new Response("Payload demasiado grande", { status: 413 });
  }

  try {
    return JSON.parse(text);
  } catch {
    throw new DiaryError("El payload debe ser JSON válido", 400);
  }
}

export function diaryErrorResponse(
  error: unknown,
  operation: string,
  fallbackMessage: string,
): NextResponse {
  if (error instanceof DiaryError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  if (error instanceof Response && error.status === 413) {
    return NextResponse.json({ error: "Payload demasiado grande" }, { status: 413 });
  }

  console.error(operation, error);
  return NextResponse.json({ error: fallbackMessage }, { status: 500 });
}
