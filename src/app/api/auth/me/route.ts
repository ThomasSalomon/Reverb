import { NextResponse } from "next/server";
import { resolveAuthUser } from "@/utils/auth";
import { prisma } from "@/services/db";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const auth = await resolveAuthUser(request);
    if (!auth.ok) return NextResponse.json({ user: null }, { status: 200 });

    const dbUser = await prisma.user.findUnique({
      where: { id: auth.user.userId },
      select: { id: true, username: true, profileColor: true, profileImage: true },
    });

    return NextResponse.json({ user: dbUser });
  } catch (error) {
    console.error("Auth me check error:", error);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}
