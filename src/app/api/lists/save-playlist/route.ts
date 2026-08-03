import { NextResponse } from "next/server";
import {
  importPlaylist,
  parsePlaylistImportInput,
  PlaylistImportError,
  readPlaylistImportJson,
} from "@/services/playlist-import";
import { resolveAuthUser } from "@/utils/auth";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const auth = await resolveAuthUser(req);
    if (!auth.ok) {
      return NextResponse.json(
        { error: "No autenticado", code: "UNAUTHENTICATED" },
        { status: 401 },
      );
    }

    const body = await readPlaylistImportJson(req);
    const input = await parsePlaylistImportInput(body);
    const list = await importPlaylist(auth.user.userId, input);
    return NextResponse.json({ list }, { status: 201 });
  } catch (error) {
    if (error instanceof PlaylistImportError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.status },
      );
    }

    console.error("POST save-playlist error:", error);
    return NextResponse.json(
      { error: "Error al guardar la lista", code: "PLAYLIST_IMPORT_FAILED" },
      { status: 500 },
    );
  }
}
