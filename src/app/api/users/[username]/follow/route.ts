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
  { params }: { params: { username: string } },
) {
  try {
    const auth = await resolveAuthUser(req);
    if (!auth.ok) {
      return NextResponse.json(
        { error: "No autenticado", code: "UNAUTHENTICATED" },
        { status: 401 },
      );
    }

    const result = await SocialActionService.follow(auth.user, params.username);
    return NextResponse.json(
      { message: `Ahora sigues a ${params.username}`, ...result },
      { status: result.changed ? 201 : 200 },
    );
  } catch (error) {
    if (error instanceof SocialActionError) return socialErrorResponse(error);
    console.error("POST follow error:", error);
    return NextResponse.json(
      { error: "Error al realizar acción de seguimiento", code: "FOLLOW_FAILED" },
      { status: 500 },
    );
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: { username: string } },
) {
  try {
    const auth = await resolveAuthUser(req);
    if (!auth.ok) {
      return NextResponse.json(
        { error: "No autenticado", code: "UNAUTHENTICATED" },
        { status: 401 },
      );
    }

    const result = await SocialActionService.unfollow(
      auth.user.userId,
      params.username,
    );
    return NextResponse.json({
      message: `Has dejado de seguir a ${params.username}`,
      ...result,
    });
  } catch (error) {
    if (error instanceof SocialActionError) return socialErrorResponse(error);
    console.error("DELETE follow error:", error);
    return NextResponse.json(
      { error: "Error al dejar de seguir", code: "UNFOLLOW_FAILED" },
      { status: 500 },
    );
  }
}
