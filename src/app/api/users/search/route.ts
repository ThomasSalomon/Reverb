import { NextResponse } from "next/server";
import { prisma } from "@/services/db";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const query = url.searchParams.get("q") || "";
    const index = parseInt(url.searchParams.get("index") || "0", 10);
    const limit = parseInt(url.searchParams.get("limit") || "50", 10);

    if (!query) {
      // If no query, return top users by follower count
      const topUsers = await prisma.user.findMany({
        skip: index,
        take: limit,
        orderBy: [
          {
            followers: {
              _count: "desc",
            },
          },
          {
            reviews: {
              _count: "desc",
            },
          }
        ],
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
      skip: index,
      take: limit,
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
