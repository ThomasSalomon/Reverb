import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/services/db";
import { verifyToken } from "@/utils/auth";
import { MAX_LISTS_PER_USER } from "@/services/list-constraints";
import { readJsonObject, rejectUnknownFields, RequestBodyError } from "@/utils/request-body";
import { descendingTemporalWhere, getPageLimit, pageResult, PaginationError, temporalCursor } from "@/utils/cursor-pagination";

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

export async function POST(req: Request) {
  try {
    const authUser = await getAuthUser();
    if (!authUser) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
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

    const listsCount = await prisma.list.count({
      where: { userId: authUser.userId },
    });

    if (listsCount >= MAX_LISTS_PER_USER) {
      return NextResponse.json(
        { error: "Has alcanzado el límite máximo de 50 listas." },
        { status: 403 }
      );
    }

    if (title.length > 100 || (description !== undefined && description !== null && typeof description !== "string") || (typeof description === "string" && description.length > 500) || (isPublic !== undefined && typeof isPublic !== "boolean")) {
      return NextResponse.json({ error: "Los campos de la lista no son válidos" }, { status: 400 });
    }
    const sanitizedTitle = title.trim().replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const sanitizedDesc = typeof description === "string" && description.trim() !== "" ? description.trim().replace(/</g, "&lt;").replace(/>/g, "&gt;") : null;

    const newList = await prisma.list.create({
      data: {
        title: sanitizedTitle,
        description: sanitizedDesc,
        isPublic: typeof isPublic === "boolean" ? isPublic : true,
        userId: authUser.userId,
      },
    });

    return NextResponse.json(newList, { status: 201 });
  } catch (error) {
    if (error instanceof RequestBodyError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("POST list error:", error);
    return NextResponse.json(
      { error: "Error al crear la lista" },
      { status: 500 }
    );
  }
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const limit = getPageLimit(searchParams);
    const cursor = temporalCursor(searchParams);
    const username = searchParams.get("username");
    const authUser = await getAuthUser();

    let whereClause: any = {
      isPublic: true,
    };

    if (username) {
      const targetUser = await prisma.user.findUnique({
        where: { username },
        select: { id: true },
      });

      if (!targetUser) {
        return NextResponse.json(
          { error: "Usuario no encontrado" },
          { status: 404 }
        );
      }

      // If the requester is the owner, return all lists, otherwise return only public lists
      if (authUser && authUser.userId === targetUser.id) {
        whereClause = { userId: targetUser.id };
      } else {
        whereClause = { userId: targetUser.id, isPublic: true };
      }
    }

    const lists = await prisma.list.findMany({
      where: { ...whereClause, ...(cursor ? { OR: descendingTemporalWhere(cursor) } : {}) },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: limit + 1,
      include: {
        user: {
          select: {
            username: true,
            profileColor: true,
          },
        },
        items: {
          include: {
            musicItem: {
              select: {
                coverUrl: true,
              },
            },
          },
          take: 4, // Just load up to 4 covers for card stack visualization
        },
      },
    });

    return NextResponse.json(pageResult(lists, limit, "createdAt"));
  } catch (error) {
    if (error instanceof PaginationError) return NextResponse.json({ error: error.message }, { status: 400 });
    console.error("GET lists error:", error);
    return NextResponse.json(
      { error: "Error al obtener las listas" },
      { status: 500 }
    );
  }
}
