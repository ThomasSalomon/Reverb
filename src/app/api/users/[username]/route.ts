import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/services/db";
import { verifyToken } from "@/utils/auth";
import { MusicService } from "@/services/music";

export const dynamic = "force-dynamic";

const ALLOWED_COLORS = ["emerald", "violet", "cobalt", "amber", "rose", "slate"];

// Helper to authenticate request
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
  { params }: { params: { username: string } }
) {
  try {
    const { username } = params;

    const user = await prisma.user.findUnique({
      where: { username },
      select: {
        id: true,
        username: true,
        bio: true,
        favoriteGenre: true,
        profileColor: true,
        profileImage: true,
        createdAt: true,
        favoriteAlbums: {
          orderBy: { slot: "asc" },
          include: {
            musicItem: {
              select: {
                id: true,
                title: true,
                artist: true,
                coverUrl: true,
                type: true,
              },
            },
          },
        },
      },
    });

    if (!user) {
      return NextResponse.json(
        { error: "Usuario no encontrado" },
        { status: 404 }
      );
    }

    // Fetch counts
    const reviewsCount = await prisma.review.count({
      where: { userId: user.id },
    });

    const followersCount = await prisma.follow.count({
      where: { followingId: user.id },
    });

    const followingCount = await prisma.follow.count({
      where: { followerId: user.id },
    });

    // Check if current user is following this user
    let isFollowing = false;
    const authUser = await getAuthUser();
    if (authUser && authUser.userId !== user.id) {
      const followRecord = await prisma.follow.findUnique({
        where: {
          followerId_followingId: {
            followerId: authUser.userId,
            followingId: user.id,
          },
        },
      });
      isFollowing = !!followRecord;
    }

    // Remove internal id from return value to prevent ID harvesting
    const { id, ...publicProfile } = user;

    return NextResponse.json({
      profile: publicProfile,
      stats: {
        reviewsCount,
        followersCount,
        followingCount,
      },
      isFollowing,
    });
  } catch (error) {
    console.error("GET user profile error:", error);
    return NextResponse.json(
      { error: "Error al obtener perfil de usuario" },
      { status: 500 }
    );
  }
}

export async function PUT(
  req: Request,
  { params }: { params: { username: string } }
) {
  try {
    const { username } = params;

    // 1. Authenticate request
    const authUser = await getAuthUser();
    if (!authUser) {
      return NextResponse.json(
        { error: "No autenticado" },
        { status: 401 }
      );
    }

    // 2. Authorization check (only owner can modify)
    if (authUser.username !== username) {
      return NextResponse.json(
        { error: "Acceso prohibido (no puedes editar el perfil de otra persona)" },
        { status: 403 }
      );
    }

    // 3. Destructure and validate input
    const body = await req.json();
    const bio = typeof body.bio === "string" ? body.bio : undefined;
    const favoriteGenre = typeof body.favoriteGenre === "string" ? body.favoriteGenre : undefined;
    const profileColor = typeof body.profileColor === "string" ? body.profileColor : undefined;
    const profileImage = typeof body.profileImage === "string" ? body.profileImage : undefined;
    const favoriteAlbumsInput = Array.isArray(body.favoriteAlbums) ? body.favoriteAlbums : undefined;

    // SEC-07: Validation & length constraints
    if (bio && bio.length > 500) {
      return NextResponse.json(
        { error: "La biografía no puede superar los 500 caracteres" },
        { status: 400 }
      );
    }

    if (profileColor && !ALLOWED_COLORS.includes(profileColor)) {
      return NextResponse.json(
        { error: "Color de perfil no permitido" },
        { status: 400 }
      );
    }

    let finalProfileImage = profileImage;

    // Handle base64 image uploads
    if (profileImage && profileImage.startsWith("data:image/")) {
      const matches = profileImage.match(/^data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+);base64,(.+)$/);
      if (!matches || matches.length !== 3) {
        return NextResponse.json(
          { error: "Formato de imagen base64 inválido." },
          { status: 400 }
        );
      }

      const mimeType = matches[1];
      
      const allowedMimes = ["image/png", "image/jpeg", "image/jpg", "image/webp", "image/gif"];
      if (!allowedMimes.includes(mimeType)) {
        return NextResponse.json(
          { error: "Tipo de archivo no permitido. Solo se permiten imágenes (PNG, JPEG, WEBP, GIF)." },
          { status: 400 }
        );
      }

      // Max size limit: 2MB. A base64 string length is ~1.37 times the binary size.
      if (profileImage.length > 2.8 * 1024 * 1024) {
        return NextResponse.json(
          { error: "La imagen supera el límite de tamaño de 2MB." },
          { status: 400 }
        );
      }

      // Store the base64 string directly in the database (serverless friendly)
      finalProfileImage = profileImage;
    } else if (profileImage && profileImage.trim() !== "") {
      // Validate preset image or existing custom image/base64
      if (!profileImage.startsWith("/avatars/") && !profileImage.startsWith("/uploads/") && !profileImage.startsWith("data:image/")) {
        return NextResponse.json(
          { error: "Avatar inválido. Seleccione un preset o cargue una foto." },
          { status: 400 }
        );
      }
    } else if (profileImage === "") {
      // Image cleared, will be set to null in database
    }

    // Process favorite albums slots (Top 3)
    if (favoriteAlbumsInput) {
      for (const item of favoriteAlbumsInput) {
        const slot = parseInt(item.slot);
        if (slot >= 1 && slot <= 3) {
          const musicItemId = item.musicItemId;
          if (musicItemId) {
            // Cache the album locally first
            const cachedItem = await MusicService.getItemById(musicItemId);
            if (cachedItem) {
              await prisma.favoriteAlbum.upsert({
                where: {
                  userId_slot: {
                    userId: authUser.userId,
                    slot,
                  },
                },
                update: {
                  musicItemId,
                },
                create: {
                  userId: authUser.userId,
                  slot,
                  musicItemId,
                },
              });
            }
          } else {
            // Delete slot entry if cleared
            await prisma.favoriteAlbum.deleteMany({
              where: {
                userId: authUser.userId,
                slot,
              },
            });
          }
        }
      }
    }

    // 4. Update user details in database
    const updatedUser = await prisma.user.update({
      where: { username },
      data: {
        bio: bio !== undefined ? bio : undefined,
        favoriteGenre: favoriteGenre !== undefined ? favoriteGenre : undefined,
        profileColor: profileColor !== undefined ? profileColor : undefined,
        profileImage: finalProfileImage !== undefined ? (finalProfileImage.trim() === "" ? null : finalProfileImage) : undefined,
      },
      select: {
        username: true,
        bio: true,
        favoriteGenre: true,
        profileColor: true,
        profileImage: true,
        favoriteAlbums: {
          orderBy: { slot: "asc" },
          include: {
            musicItem: {
              select: {
                id: true,
                title: true,
                artist: true,
                coverUrl: true,
                type: true,
              },
            },
          },
        },
      },
    });

    return NextResponse.json({
      message: "Perfil actualizado con éxito",
      profile: updatedUser,
    });
  } catch (error) {
    console.error("PUT user profile error:", error);
    return NextResponse.json(
      { error: "Error al actualizar perfil de usuario" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: { username: string } }
) {
  try {
    const { username } = params;
    const authUser = await getAuthUser();
    if (!authUser) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    // Verify user exists and matches auth
    const user = await prisma.user.findUnique({
      where: { username },
    });

    if (!user) {
      return NextResponse.json(
        { error: "Usuario no encontrado" },
        { status: 404 }
      );
    }

    if (user.id !== authUser.userId) {
      return NextResponse.json(
        { error: "No autorizado para eliminar este perfil" },
        { status: 403 }
      );
    }

    // Prisma Cascade delete handles reviews, comments, lists, etc.
    await prisma.user.delete({
      where: { id: user.id },
    });

    return NextResponse.json({ message: "Cuenta eliminada con éxito" }, { status: 200 });
  } catch (error) {
    console.error("DELETE user error:", error);
    return NextResponse.json(
      { error: "Error interno al eliminar cuenta" },
      { status: 500 }
    );
  }
}
