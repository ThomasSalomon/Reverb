import { NextResponse } from "next/server";
import { prisma } from "@/services/db";

export const dynamic = "force-dynamic";

export async function GET(
  req: Request,
  { params }: { params: { username: string } }
) {
  try {
    const { username } = params;
    const { searchParams } = new URL(req.url);
    const yearStr = searchParams.get("year");

    if (!yearStr || !/^\d{4}$/.test(yearStr)) {
      return NextResponse.json({ error: "Año inválido" }, { status: 400 });
    }

    const year = parseInt(yearStr, 10);
    const startDate = new Date(`${year}-01-01T00:00:00Z`);
    const endDate = new Date(`${year + 1}-01-01T00:00:00Z`);

    const user = await prisma.user.findUnique({
      where: { username },
      select: { id: true }
    });

    if (!user) {
      return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
    }

    // Optimizer: Fetch only required fields to avoid massive memory allocation
    const reviews = await prisma.review.findMany({
      where: {
        userId: user.id,
        createdAt: {
          gte: startDate,
          lt: endDate
        }
      },
      select: {
        ratingValue: true,
        tags: true,
        musicItem: {
          select: {
            artist: true,
            title: true,
            coverUrl: true
          }
        }
      }
    });

    if (reviews.length === 0) {
      return NextResponse.json({ 
        hasData: false, 
        message: "No hay actividad para este año" 
      });
    }

    // Aggregations
    let totalReviews = reviews.length;
    let avgRating = 0;
    const artistCounts = new Map<string, number>();
    const tagCounts = new Map<string, number>();

    let sumRating = 0;
    
    reviews.forEach(r => {
      sumRating += r.ratingValue;
      
      const artist = r.musicItem.artist;
      artistCounts.set(artist, (artistCounts.get(artist) || 0) + 1);

      if (r.tags) {
        const tList = r.tags.split(",");
        tList.forEach(tag => {
          const t = tag.trim();
          if (t) {
            tagCounts.set(t, (tagCounts.get(t) || 0) + 1);
          }
        });
      }
    });

    avgRating = sumRating / totalReviews;

    // Sort to find top artist
    const topArtist = Array.from(artistCounts.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] || "Desconocido";
    const topTag = Array.from(tagCounts.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] || "Ninguno";
    
    // Top rated items this year (sort by rating desc, take top 3)
    const topItems = reviews
      .sort((a, b) => b.ratingValue - a.ratingValue)
      .slice(0, 3)
      .map(r => ({
        title: r.musicItem.title,
        artist: r.musicItem.artist,
        coverUrl: r.musicItem.coverUrl,
        rating: r.ratingValue
      }));

    return NextResponse.json({
      hasData: true,
      year,
      totalReviews,
      avgRating: avgRating.toFixed(1),
      topArtist,
      topTag,
      topItems
    });
  } catch (error) {
    console.error("Recap API Error:", error);
    return NextResponse.json({ error: "Error al generar recap" }, { status: 500 });
  }
}
