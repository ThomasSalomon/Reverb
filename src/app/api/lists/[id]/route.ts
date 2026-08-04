import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/services/db";
import { verifyToken } from "@/utils/auth";
import { readJsonObject, rejectUnknownFields, RequestBodyError } from "@/utils/request-body";
import { ascendingListItemWhere, getPageLimit, listItemCursor, listItemPageResult, PaginationError } from "@/utils/cursor-pagination";

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
    const searchParams = new URL(req.url).searchParams;
    const limit = getPageLimit(searchParams);
    const cursor = listItemCursor(searchParams);
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
          where: cursor ? { OR: ascendingListItemWhere(cursor) } : undefined,
          orderBy: [{ order: "asc" }, { id: "asc" }],
          take: limit + 1,
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

    const itemPage = listItemPageResult(list.items, limit);
    return NextResponse.json({ ...list, items: itemPage.items, itemsNextCursor: itemPage.nextCursor, itemsHasNextPage: itemPage.hasNextPage, itemsLimit: itemPage.limit });
  } catch (error) {
    if (error instanceof PaginationError) return NextResponse.json({ error: error.message }, { status: 400 });
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

    const body = await readJsonObject(req);
    rejectUnknownFields(body, ["title", "description", "isPublic"]);
    const { title, description, isPublic } = body;

    if (typeof title !== "string" || title.trim() === "") {
      return NextResponse.json(
        { error: "El título de la lista es requerido" },
        { status: 400 }
      );
    }

    if (title.length > 100 || (description !== undefined && description !== null && typeof description !== "string") || (typeof description === "string" && description.length > 500) || (isPublic !== undefined && typeof isPublic !== "boolean")) {
      return NextResponse.json({ error: "Los campos de la lista no son válidos" }, { status: 400 });
    }

    const updatedList = await prisma.list.update({
      where: { id: listId },
      data: {
        title: title.trim(),
        description: typeof description === "string" && description.trim() !== "" ? description.trim() : null,
        isPublic: typeof isPublic === "boolean" ? isPublic : true,
      },
    });

    return NextResponse.json(updatedList);
  } catch (error) {
    if (error instanceof RequestBodyError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
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
