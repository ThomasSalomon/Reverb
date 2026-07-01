import { NextResponse } from "next/server";
import { prisma } from "@/services/db";
import { getAuthUser } from "@/utils/auth";
import { hashPassword, comparePassword } from "@/utils/crypto";

export async function PATCH(
  req: Request,
  { params }: { params: { username: string } }
) {
  try {
    const { username } = params;
    const authUser = await getAuthUser();
    
    if (!authUser) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { username },
    });

    if (!user) {
      return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
    }

    if (user.id !== authUser.userId) {
      return NextResponse.json(
        { error: "No autorizado para cambiar esta contraseña" },
        { status: 403 }
      );
    }

    const { currentPassword, newPassword } = await req.json();

    if (!currentPassword || !newPassword) {
      return NextResponse.json(
        { error: "La contraseña actual y la nueva son requeridas" },
        { status: 400 }
      );
    }

    if (newPassword.length < 6) {
      return NextResponse.json(
        { error: "La nueva contraseña debe tener al menos 6 caracteres" },
        { status: 400 }
      );
    }

    const isMatch = await comparePassword(currentPassword, user.password);
    if (!isMatch) {
      return NextResponse.json(
        { error: "La contraseña actual es incorrecta" },
        { status: 400 }
      );
    }

    const hashedPassword = await hashPassword(newPassword);

    await prisma.user.update({
      where: { id: user.id },
      data: { password: hashedPassword },
    });

    return NextResponse.json({ message: "Contraseña actualizada con éxito" }, { status: 200 });
  } catch (error) {
    console.error("PATCH password error:", error);
    return NextResponse.json(
      { error: "Error interno al cambiar la contraseña" },
      { status: 500 }
    );
  }
}
