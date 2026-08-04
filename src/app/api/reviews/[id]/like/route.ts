import { NextResponse } from "next/server";
import {
  SocialActionError,
  SocialActionService,
} from "@/services/social-actions";
import { resolveAuthUser } from "@/utils/auth";

export const dynamic = "force-dynamic";

function socialErrorResponse(error: SocialActionError) {
  return NextResponse.json(
    { error: error.message, code: error.code },
    { status: error.status },
  );
}
export async function POST(
  req: Request,
  { params }: { params: { id: string } },
) {
  try {
    const auth = await resolveAuthUser(req);
    if (!auth.ok) {
      return NextResponse.json(
        { error: "No autenticado", code: "UNAUTHENTICATED" },
        { status: 401 },
      );
    }

    const result = await SocialActionService.like(auth.user, params.id);
    return NextResponse.json(
      { message: "Reseña gustada con éxito", ...result },
      { status: result.changed ? 201 : 200 },
    );
  } catch (error) {
    if (error instanceof SocialActionError) return socialErrorResponse(error);
    console.error("POST like error:", error);
    return NextResponse.json(
      { error: "Error al registrar like", code: "LIKE_FAILED" },
      { status: 500 },
    );
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: { id: string } },
) {
  try {
    const auth = await resolveAuthUser(req);
    if (!auth.ok) {
      return NextResponse.json(
        { error: "No autenticado", code: "UNAUTHENTICATED" },
        { status: 401 },
      );
    }

    const result = await SocialActionService.unlike(auth.user.userId, params.id);
    return NextResponse.json({ message: "Like removido con éxito", ...result });
  } catch (error) {
    if (error instanceof SocialActionError) return socialErrorResponse(error);
    console.error("DELETE like error:", error);
    return NextResponse.json(
      { error: "Error al remover like", code: "UNLIKE_FAILED" },
      { status: 500 },
    );
  }
}
