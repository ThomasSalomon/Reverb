import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/services/db";
import { verifyToken } from "@/utils/auth";

export const dynamic = "force-dynamic";

async function getAuthUser() {
  try {
    const cookieStore = cookies();
    const token = cookieStore.get("token")?.value;
    if (!token) return null;
    return await verifyToken(token);
  } catch {
    return null;
  }
}

export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const listId = params.id;
    const authUser = await getAuthUser();

    const list = await prisma.list.findUnique({
      where: { id: listId },
      include: {
        user: {
          select: {
            username: true,
            profileColor: true,
          },
        },
        items: {
          orderBy: {
            order: "asc",
          },
          include: {
            musicItem: true,
          },
        },
      },
    });

    if (!list) {
      return NextResponse.json(
        { error: "Lista no encontrada" },
        { status: 404 }
      );
    }

    // Check privacy authorization
    if (!list.isPublic && (!authUser || authUser.userId !== list.userId)) {
      return NextResponse.json(
        { error: "Acceso denegado a esta lista privada" },
        { status: 403 }
      );
    }

    return NextResponse.json(list);
  } catch (error) {
    console.error("GET list detail error:", error);
    return NextResponse.json(
      { error: "Error al obtener detalles de la lista" },
      { status: 500 }
    );
  }
}

export async function PUT(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const listId = params.id;
    const authUser = await getAuthUser();
    if (!authUser) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const list = await prisma.list.findUnique({
      where: { id: listId },
      select: { userId: true },
    });

    if (!list) {
      return NextResponse.json(
        { error: "Lista no encontrada" },
        { status: 404 }
      );
    }

    // Owner check
    if (list.userId !== authUser.userId) {
      return NextResponse.json(
        { error: "No autorizado para modificar esta lista" },
        { status: 403 }
      );
    }

    const { title, description, isPublic } = await req.json();

    if (!title || typeof title !== "string" || title.trim() === "") {
      return NextResponse.json(
        { error: "El título de la lista es requerido" },
        { status: 400 }
      );
    }

    const updatedList = await prisma.list.update({
      where: { id: listId },
      data: {
        title: title.trim().substring(0, 100),
        description: description ? description.trim().substring(0, 500) : null,
        isPublic: typeof isPublic === "boolean" ? isPublic : true,
      },
    });

    return NextResponse.json(updatedList);
  } catch (error) {
    console.error("PUT list error:", error);
    return NextResponse.json(
      { error: "Error al actualizar la lista" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const listId = params.id;
    const authUser = await getAuthUser();
    if (!authUser) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const list = await prisma.list.findUnique({
      where: { id: listId },
      select: { userId: true },
    });

    if (!list) {
      return NextResponse.json(
        { error: "Lista no encontrada" },
        { status: 404 }
      );
    }

    // Owner check
    if (list.userId !== authUser.userId) {
      return NextResponse.json(
        { error: "No autorizado para eliminar esta lista" },
        { status: 403 }
      );
    }

    await prisma.list.delete({
      where: { id: listId },
    });

    return NextResponse.json({ message: "Lista eliminada con éxito" });
  } catch (error) {
    console.error("DELETE list error:", error);
    return NextResponse.json(
      { error: "Error al eliminar la lista" },
      { status: 500 }
    );
  }
}
