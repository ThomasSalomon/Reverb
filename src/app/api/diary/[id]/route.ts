import { NextResponse } from "next/server";
import {
  DiaryService,
  parseUpdateDiaryEvent,
} from "@/services/diary";
import { resolveAuthUser } from "@/utils/auth";
import { diaryErrorResponse, readDiaryBody } from "../request";

function validId(id: string): boolean {
  return id.trim().length > 0 && id.length <= 200;
}

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } },
) {
  const auth = await resolveAuthUser(request);
  if (!auth.ok) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }
  if (!validId(params.id)) {
    return NextResponse.json({ error: "Entrada no encontrada" }, { status: 404 });
  }

  try {
    const input = parseUpdateDiaryEvent(await readDiaryBody(request));
    const event = await DiaryService.updateEvent(params.id, auth.user.userId, input);
    if (!event) {
      return NextResponse.json({ error: "Entrada no encontrada" }, { status: 404 });
    }
    return NextResponse.json(event);
  } catch (error) {
    return diaryErrorResponse(
      error,
      "PATCH diary event failed",
      "Error al actualizar la entrada del diario",
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } },
) {
  const auth = await resolveAuthUser(request);
  if (!auth.ok) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }
  if (!validId(params.id)) {
    return NextResponse.json({ error: "Entrada no encontrada" }, { status: 404 });
  }

  try {
    const deleted = await DiaryService.deleteEvent(params.id, auth.user.userId);
    if (!deleted) {
      return NextResponse.json({ error: "Entrada no encontrada" }, { status: 404 });
    }
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return diaryErrorResponse(
      error,
      "DELETE diary event failed",
      "Error al eliminar la entrada del diario",
    );
  }
}
