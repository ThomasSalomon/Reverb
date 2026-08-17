import type { PrismaClient } from "@prisma/client";
import { prisma } from "@/services/db";
import { MusicService } from "@/services/music";
import type { ProfileUpdateInput } from "@/services/profile-input";
import { AppError } from "@/utils/errors";

const MAX_PROFILE_IMAGE_BASE64_LENGTH = 2.8 * 1024 * 1024;
const ALLOWED_PROFILE_IMAGE_MIMES = new Set([
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
  "image/gif",
]);

function validateProfileImage(profileImage: string | undefined): string | undefined {
  if (profileImage === undefined || profileImage === "") return profileImage;

  if (profileImage.startsWith("data:image/")) {
    const match = profileImage.match(
      /^data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+);base64,(.+)$/,
    );
    if (!match) {
      throw new AppError(
        "Formato de imagen base64 inválido.",
        400,
        "INVALID_PROFILE_IMAGE",
      );
    }
    if (!ALLOWED_PROFILE_IMAGE_MIMES.has(match[1])) {
      throw new AppError(
        "Tipo de archivo no permitido. Solo se permiten imágenes (PNG, JPEG, WEBP, GIF).",
        400,
        "PROFILE_IMAGE_TYPE_NOT_ALLOWED",
      );
    }
    if (profileImage.length > MAX_PROFILE_IMAGE_BASE64_LENGTH) {
      throw new AppError(
        "La imagen supera el límite de tamaño de 2MB.",
        400,
        "PROFILE_IMAGE_TOO_LARGE",
      );
    }
    return profileImage;
  }

  if (
    !profileImage.startsWith("/avatars/") &&
    !profileImage.startsWith("/uploads/")
  ) {
    throw new AppError(
      "Avatar inválido. Seleccione un preset o cargue una foto.",
      400,
      "INVALID_PROFILE_IMAGE",
    );
  }

  return profileImage;
}

export async function updateProfile(
  actor: { userId: string },
  username: string,
  input: ProfileUpdateInput,
  client: PrismaClient = prisma,
) {
  const profileImage = validateProfileImage(input.profileImage);
  const requestedAlbums = await Promise.all(
    (input.favoriteAlbums ?? [])
      .filter((item) => item.musicItemId !== null)
      .map((item) => MusicService.getItemById(item.musicItemId!)),
  );
  if (requestedAlbums.some((item) => !item || item.type !== "ALBUM")) {
    throw new AppError(
      "Álbum no encontrado en el catálogo",
      404,
      "FAVORITE_ALBUM_NOT_FOUND",
    );
  }

  if (input.favoriteAlbums) {
    for (const { slot, musicItemId } of input.favoriteAlbums) {
      if (musicItemId === null) {
        await client.favoriteAlbum.deleteMany({
          where: { userId: actor.userId, slot },
        });
      } else {
        await client.favoriteAlbum.upsert({
          where: { userId_slot: { userId: actor.userId, slot } },
          update: { musicItemId },
          create: { userId: actor.userId, slot, musicItemId },
        });
      }
    }
  }

  return client.user.update({
    where: { username },
    data: {
      bio: input.bio,
      favoriteGenre: input.favoriteGenre,
      profileColor: input.profileColor,
      profileImage: profileImage === undefined
        ? undefined
        : profileImage.trim() === ""
          ? null
          : profileImage,
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
}
