import { AppError } from "@/utils/errors";

export class RequestBodyError extends AppError {
  constructor(message: string) {
    super(message, 400, "INVALID_REQUEST_BODY");
  }
}

export type JsonObject = Record<string, unknown>;

export function isJsonObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export async function readJsonObject(request: Request): Promise<JsonObject> {
  let value: unknown;
  try {
    value = await request.json();
  } catch {
    throw new RequestBodyError("El cuerpo debe contener JSON válido");
  }

  if (!isJsonObject(value)) {
    throw new RequestBodyError("El cuerpo debe ser un objeto JSON");
  }

  return value;
}

export function rejectUnknownFields(
  body: JsonObject,
  fields: readonly string[],
): void {
  const allowed = new Set(fields);
  const unknown = Object.keys(body).filter((field) => !allowed.has(field));
  if (unknown.length > 0) {
    throw new RequestBodyError(`Campos no permitidos: ${unknown.join(", ")}`);
  }
}

export function requestBodyErrorResponse(error: unknown): { error: string; status: 400 } | null {
  if (error instanceof RequestBodyError) {
    return { error: error.message, status: 400 };
  }
  return null;
}
