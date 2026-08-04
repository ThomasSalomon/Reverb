import { NextResponse } from "next/server";
import { prisma } from "@/services/db";
import {
  DiaryService,
  parseCreateDiaryEvent,
} from "@/services/diary";
import { resolveAuthUser } from "@/utils/auth";
import { diaryErrorResponse, readDiaryBody } from "./request";
import { diaryCursor, getPageLimit, PaginationError } from "@/utils/cursor-pagination";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const auth = await resolveAuthUser(request);
  if (!auth.ok) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  try {
    const input = parseCreateDiaryEvent(await readDiaryBody(request));
    const event = await DiaryService.createEvent(auth.user.userId, input);
    return NextResponse.json(event, { status: 201 });
  } catch (error) {
    return diaryErrorResponse(
      error,
      "POST diary event failed",
      "Error al registrar en el diario",
    );
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = getPageLimit(searchParams);
    const cursor = diaryCursor(searchParams);
    const username = searchParams.get("username")?.trim();
    const auth = await resolveAuthUser(request);

    let targetUserId = auth.ok ? auth.user.userId : undefined;
    if (username) {
      const user = await prisma.user.findUnique({
        where: { username },
        select: { id: true },
      });
      if (!user) {
        return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
      }
      targetUserId = user.id;
    }

    if (!targetUserId) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    return NextResponse.json(await DiaryService.listEvents(targetUserId, limit, cursor));
  } catch (error) {
    if (error instanceof PaginationError) return NextResponse.json({ error: error.message }, { status: 400 });
    return diaryErrorResponse(
      error,
      "GET diary events failed",
      "Error al obtener el diario",
    );
  }
}
