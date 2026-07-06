import { prisma } from "./db";
import { DeezerService, DeezerAlbumSearchItem } from "./deezer";

export interface Track {
  title: string;
  duration: string;
}

export interface ReviewWithUser {
  id: string;
  content: string;
  ratingValue: number;
  createdAt: Date;
  updatedAt: Date;
  userId: string;
  musicItemId: string;
  user: {
    id: string;
    username: string;
    profileColor?: string | null;
    profileImage?: string | null;
  };
}

export interface MusicItemWithStats {
  id: string;
  title: string;
  artist: string;
  type: string;
  coverUrl: string;
  releaseYear: number;
  tracks: Track[] | null;
  createdAt: Date;
  reviews?: ReviewWithUser[];
  stats: {
    averageRating: number;
    totalRatings: number;
    totalReviews: number;
  };
}

export const MusicService = {
  async getAllItems(type?: "ALBUM" | "SONG") {
    const items = await prisma.musicItem.findMany({
      where: type ? { type } : undefined,
      include: {
        ratings: true,
        reviews: {
          include: {
            user: {
              select: {
                id: true,
                username: true,
                profileColor: true,
                profileImage: true,
              },
            },
          },
          orderBy: {
            createdAt: "desc",
          },
        },
      },
    });

    return items.map((item) => this._enrichStats(item));
  },

  async getItemById(id: string) {
    console.log("getItemById called with id:", id, "type:", typeof id);
    let item = await prisma.musicItem.findUnique({
      where: { id },
      include: {
        ratings: true,
        reviews: {
          include: {
            user: {
              select: {
                id: true,
                username: true,
                profileColor: true,
                profileImage: true,
              },
            },
          },
          orderBy: {
            createdAt: "desc",
          },
        },
      },
    });

    // If album doesn't exist locally, fetch from Deezer and cache it
    if (!item) {
      const deezerAlbum = await DeezerService.getAlbumById(id);
      if (!deezerAlbum) return null;

      try {
        item = await prisma.musicItem.create({
          data: {
            id: deezerAlbum.id,
            title: deezerAlbum.title,
            artist: deezerAlbum.artist,
            type: "ALBUM",
            coverUrl: deezerAlbum.coverUrl,
            releaseYear: deezerAlbum.releaseYear,
            tracks: JSON.stringify(deezerAlbum.tracks),
          },
          include: {
            ratings: true,
            reviews: {
              include: {
                user: {
                  select: {
                    id: true,
                    username: true,
                    profileColor: true,
                    profileImage: true,
                  },
                },
              },
              orderBy: {
                createdAt: "desc",
              },
            },
          },
        });
      } catch (error: any) {
        // Handle race conditions in case another parallel thread inserted it first (Unique constraint failed)
        if (error.code === "P2002") {
          item = await prisma.musicItem.findUnique({
            where: { id },
            include: {
              ratings: true,
              reviews: {
                include: {
                  user: {
                    select: {
                      id: true,
                      username: true,
                      profileColor: true,
                      profileImage: true,
                    },
                  },
                },
                orderBy: {
                  createdAt: "desc",
                },
              },
            },
          });
        } else {
          throw error;
        }
      }
    }

    return this._enrichStats(item);
  },

  async searchItems(query: string) {
    if (!query || query.trim() === "") {
      return this.getAllItems();
    }

    // 1. Fetch from Deezer API in real-time
    let deezerResults: DeezerAlbumSearchItem[] = [];
    try {
      deezerResults = await DeezerService.searchAlbums(query);
    } catch (err) {
      console.error("Deezer searchAlbums failed (may be blocked on this server):", err);
    }
    if (deezerResults.length === 0) return [];

    // 2. Query matching local records to get their ratings and reviews
    const ids = deezerResults.map((r) => r.id);
    const localItems = await prisma.musicItem.findMany({
      where: { id: { in: ids } },
      include: {
        ratings: true,
        reviews: {
          include: {
            user: {
              select: {
                id: true,
                username: true,
                profileColor: true,
                profileImage: true,
              },
            },
          },
          orderBy: {
            createdAt: "desc",
          },
        },
      },
    });

    // Create lookup map
    const localItemsMap = new Map(localItems.map((item) => [item.id, item]));

    // 3. Blend Deezer items with local stats
    return deezerResults.map((item) => {
      const localItem = localItemsMap.get(item.id);
      if (localItem) {
        return this._enrichStats(localItem);
      }

      // Return item with 0 ratings/reviews stats
      return {
        id: item.id,
        title: item.title,
        artist: item.artist,
        type: "ALBUM",
        coverUrl: item.coverUrl,
        releaseYear: item.releaseYear,
        tracks: null,
        createdAt: new Date(),
        reviews: [],
        stats: {
          averageRating: 0,
          totalRatings: 0,
          totalReviews: 0,
        },
      };
    });
  },

  async getPopularItems() {
    // 1. Fetch popular albums from Deezer Chart
    let popularAlbums: DeezerAlbumSearchItem[] = [];
    try {
      popularAlbums = await DeezerService.getPopularAlbums();
    } catch (err) {
      console.error("Deezer getPopularAlbums failed (may be blocked on this server):", err);
    }
    if (popularAlbums.length === 0) return [];

    // 2. Query matching local records
    const ids = popularAlbums.map((r) => r.id);
    const localItems = await prisma.musicItem.findMany({
      where: { id: { in: ids } },
      include: {
        ratings: true,
        reviews: {
          include: {
            user: {
              select: {
                username: true,
              },
            },
          },
          orderBy: {
            createdAt: "desc",
          },
        },
      },
    });

    const localItemsMap = new Map(localItems.map((item) => [item.id, item]));

    // 3. Blend Deezer popular items with local stats
    return popularAlbums.map((item) => {
      const localItem = localItemsMap.get(item.id);
      if (localItem) {
        return this._enrichStats(localItem);
      }

      return {
        id: item.id,
        title: item.title,
        artist: item.artist,
        type: "ALBUM",
        coverUrl: item.coverUrl,
        releaseYear: item.releaseYear,
        tracks: null,
        createdAt: new Date(),
        reviews: [],
        stats: {
          averageRating: 0,
          totalRatings: 0,
          totalReviews: 0,
        },
      };
    });
  },

  _enrichStats(item: any): MusicItemWithStats {
    let parsedTracks: Track[] | null = null;
    if (item.tracks) {
      try {
        parsedTracks = JSON.parse(item.tracks);
      } catch (e) {
        console.error("Failed to parse tracks for item: " + item.id, e);
      }
    }

    const ratingsCount = item.ratings.length;
    const reviewsCount = item.reviews.length;

    // Calculate average rating
    let averageRating = 0;
    if (ratingsCount > 0) {
      const sum = item.ratings.reduce((acc: number, r: any) => acc + r.value, 0);
      averageRating = Math.round((sum / ratingsCount) * 10) / 10;
    }

    return {
      id: item.id,
      title: item.title,
      artist: item.artist,
      type: item.type,
      coverUrl: item.coverUrl,
      releaseYear: item.releaseYear,
      tracks: parsedTracks,
      createdAt: item.createdAt,
      reviews: item.reviews as ReviewWithUser[],
      stats: {
        averageRating,
        totalRatings: ratingsCount,
        totalReviews: reviewsCount,
      },
    };
  },
};
