import { deezerArray, deezerObject, DeezerError, getDeezerJson, requireDeezerId } from "./deezer-http";

export interface DeezerTrack {
  id: number;
  title: string;
  preview: string;
  artist: { id: number; name: string };
  album: { id: number; title: string; cover_xl: string };
}

export interface DeezerArtist { id: number; name: string; picture_xl: string; }

function asNumber(value: unknown, operation: string): number {
  const parsed = typeof value === "number" ? value : typeof value === "string" ? Number(value) : Number.NaN;
  if (!Number.isSafeInteger(parsed) || parsed < 0) throw new DeezerError("DEEZER_INVALID_PAYLOAD", operation, 502);
  return parsed;
}

function asText(value: unknown, operation: string): string {
  if (typeof value !== "string" || value.trim() === "") throw new DeezerError("DEEZER_INVALID_PAYLOAD", operation, 502);
  return value;
}

export class DeezerService {
  async getArtist(artistId: string, signal?: AbortSignal): Promise<DeezerArtist> {
    const operation = "event-artist";
    const data = deezerObject(await getDeezerJson(`/artist/${requireDeezerId(artistId, operation)}`, { operation, signal, revalidate: 86_400 }), operation);
    return { id: asNumber(data.id, operation), name: asText(data.name, operation), picture_xl: asText(data.picture_xl, operation) };
  }

  async getTopTracks(artistId: string, limit = 20, signal?: AbortSignal): Promise<DeezerTrack[]> {
    const operation = "event-top-tracks";
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > 50) throw new DeezerError("DEEZER_INVALID_INPUT", operation, 400);
    const payload = await getDeezerJson(`/artist/${requireDeezerId(artistId, operation)}/top`, { operation, params: { limit }, signal, revalidate: 86_400 });
    return deezerArray(deezerObject(payload, operation).data, operation).map((track) => {
      const artist = deezerObject(track.artist, operation); const album = deezerObject(track.album, operation);
      return {
        id: asNumber(track.id, operation), title: asText(track.title, operation), preview: typeof track.preview === "string" ? track.preview : "",
        artist: { id: asNumber(artist.id, operation), name: asText(artist.name, operation) },
        album: { id: asNumber(album.id, operation), title: asText(album.title, operation), cover_xl: typeof album.cover_xl === "string" ? album.cover_xl : "" },
      };
    });
  }
}
