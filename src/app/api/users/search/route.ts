import { NextResponse } from "next/server";
import { prisma } from "@/services/db";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const query = url.searchParams.get("q") || "";

    if (!query) {
      // If no query, return top users by follower count
      const topUsers = await prisma.user.findMany({
        take: 10,
        orderBy: {
          followers: {
            _count: "desc",
          },
        },
        select: {
          id: true,
          username: true,
          profileColor: true,
          profileImage: true,
          _count: {
            select: { followers: true, following: true, reviews: true },
          },
        },
      });
      return NextResponse.json(topUsers);
    }

    const users = await prisma.user.findMany({
      where: {
        username: {
          contains: query,
        },
      },
      take: 20,
      select: {
        id: true,
        username: true,
        profileColor: true,
        profileImage: true,
        _count: {
          select: { followers: true, following: true, reviews: true },
        },
      },
    });

    return NextResponse.json(users);
  } catch (error) {
    console.error("GET user search error:", error);
    return NextResponse.json(
      { error: "Error al buscar usuarios" },
      { status: 500 }
    );
  }
}
