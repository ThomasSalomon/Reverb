import { NextResponse } from "next/server";
import { prisma } from "@/services/db";
import { clearAuthCookie, getAuthUser } from "@/utils/auth";
import { hashPassword, comparePassword } from "@/utils/crypto";
import { readJsonObject, rejectUnknownFields, RequestBodyError } from "@/utils/request-body";

export async function PATCH(
  req: Request,
  { params }: { params: { username: string } },
) {
  try {
    const authUser = await getAuthUser(req);
    if (!authUser) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

    const user = await prisma.user.findUnique({ where: { username: params.username } });
    if (!user) return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
    if (user.id !== authUser.userId) {
      return NextResponse.json({ error: "No autorizado para cambiar esta contraseña" }, { status: 403 });
    }

    const body = await readJsonObject(req);
    rejectUnknownFields(body, ["currentPassword", "newPassword"]);
    const { currentPassword, newPassword } = body;
    if (typeof currentPassword !== "string" || typeof newPassword !== "string" || !currentPassword || !newPassword) {
      return NextResponse.json({ error: "La contraseña actual y la nueva son requeridas" }, { status: 400 });
    }
    if (newPassword.length < 6) {
      return NextResponse.json({ error: "La nueva contraseña debe tener al menos 6 caracteres" }, { status: 400 });
    }

    const hashedPassword = await hashPassword(newPassword);
    const changed = await prisma.$transaction(async (tx) => {
      const currentUser = await tx.user.findUnique({
        where: { id: user.id },
        select: { password: true },
      });
      if (!currentUser || !(await comparePassword(currentPassword, currentUser.password))) return false;

      const now = new Date();
      await tx.user.update({
        where: { id: user.id },
        data: { password: hashedPassword, credentialsVersion: { increment: 1 } },
      });
      await tx.authSession.updateMany({
        where: { userId: user.id, revokedAt: null },
        data: { revokedAt: now },
      });
      return true;
    });

    if (!changed) {
      return NextResponse.json({ error: "La contraseña actual es incorrecta" }, { status: 400 });
    }

    const response = NextResponse.json({ message: "Contraseña actualizada con éxito" });
    clearAuthCookie(response);
    return response;
  } catch (error) {
    if (error instanceof RequestBodyError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("PATCH password error:", error);
    return NextResponse.json({ error: "Error interno al cambiar la contraseña" }, { status: 500 });
  }
}
