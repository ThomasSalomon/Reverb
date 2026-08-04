import {
  deezerArray,
  deezerObject,
  DeezerError,
  getDeezerJson,
  requireDeezerId,
  requireDeezerPage,
  requireDeezerQuery,
} from "./deezer-http";

export interface DeezerAlbumSearchItem { id: string; title: string; artist: string; coverUrl: string; releaseYear: number; }
export interface DeezerArtistSearchItem { id: string; name: string; pictureUrl: string; }
export interface DeezerTrack { title: string; duration: string; preview?: string; }
export interface DeezerAlbumDetail { id: string; title: string; artist: string; coverUrl: string; releaseYear: number; tracks: DeezerTrack[]; }
export interface DeezerArtistDetail { id: string; name: string; pictureUrl: string; pictureXlUrl: string; nb_fan: number; nb_album: number; }
export interface DeezerArtistTopTrack { id: string; title: string; duration: string; album: { id: string; title: string }; }
export interface DeezerRelatedArtist { id: string; name: string; pictureUrl: string; }
export interface DeezerArtistAlbumsPage { albums: DeezerAlbumSearchItem[]; nextIndex: number | null; }

const placeholder = "/covers/placeholder.png";
const text = (value: unknown): string | null => typeof value === "string" && value.trim() ? value : null;
const numericId = (value: unknown): string | null => (typeof value === "number" || typeof value === "string") && /^\d+$/.test(String(value)) ? String(value) : null;
const numberOr = (value: unknown, fallback: number) => typeof value === "number" && Number.isFinite(value) ? value : fallback;
const formatDuration = (seconds: unknown) => {
  const value = Math.max(0, Math.floor(numberOr(seconds, 0)));
  return `${Math.floor(value / 60)}:${String(value % 60).padStart(2, "0")}`;
};
const image = (item: Record<string, unknown>) => text(item.cover_medium) ?? text(item.cover) ?? text(item.picture_medium) ?? text(item.picture) ?? placeholder;

function collection(payload: unknown, operation: string) {
  const root = deezerObject(payload, operation);
  if ("error" in root) throw new DeezerError("DEEZER_INVALID_PAYLOAD", operation, 502);
  return deezerArray(root.data, operation);
}

function album(item: Record<string, unknown>, operation: string): DeezerAlbumSearchItem {
  const id = numericId(item.id); const title = text(item.title);
  const artist = deezerObject(item.artist, operation); const artistName = text(artist.name);
  if (!id || !title || !artistName) throw new DeezerError("DEEZER_INVALID_PAYLOAD", operation, 502);
  const release = text(item.release_date);
  return { id, title, artist: artistName, coverUrl: image(item), releaseYear: release && /^\d{4}/.test(release) ? Number(release.slice(0, 4)) : 2000 };
}

function artistSummary(item: Record<string, unknown>, operation: string): DeezerArtistSearchItem {
  const id = numericId(item.id); const name = text(item.name);
  if (!id || !name) throw new DeezerError("DEEZER_INVALID_PAYLOAD", operation, 502);
  return { id, name, pictureUrl: image(item) };
}

export const DeezerService = {
  async searchAlbums(query: string, index = 0, limit = 50, signal?: AbortSignal): Promise<DeezerAlbumSearchItem[]> {
    const operation = "search-albums";
    const q = requireDeezerQuery(query, operation); const page = requireDeezerPage(index, limit, operation);
    return collection(await getDeezerJson("/search/album", { operation, params: { q, ...page }, signal }), operation).map((item) => album(item, operation));
  },

  async getAlbumById(id: string, signal?: AbortSignal): Promise<DeezerAlbumDetail | null> {
    const operation = "album-detail";
    try {
      const payload = deezerObject(await getDeezerJson(`/album/${requireDeezerId(id, operation)}`, { operation, signal }), operation);
      const base = album(payload, operation);
      const tracksRoot = deezerObject(payload.tracks, operation);
      const tracks = deezerArray(tracksRoot.data, operation).map((track) => {
        const title = text(track.title); if (!title) throw new DeezerError("DEEZER_INVALID_PAYLOAD", operation, 502);
        return { title, duration: formatDuration(track.duration), ...(text(track.preview) ? { preview: text(track.preview)! } : {}) };
      });
      return { ...base, tracks };
    } catch (error) {
      if (error instanceof DeezerError && error.code === "DEEZER_NOT_FOUND") return null;
      throw error;
    }
  },

  async getPopularAlbums(signal?: AbortSignal) {
    const operation = "popular-albums";
    return collection(await getDeezerJson("/chart/0/albums", { operation, signal }), operation).map((item) => album(item, operation));
  },

  async getPopularArtists(signal?: AbortSignal) {
    const operation = "popular-artists";
    return collection(await getDeezerJson("/chart/0/artists", { operation, signal }), operation).map((item) => artistSummary(item, operation));
  },

  async searchArtists(query: string, index = 0, limit = 50, signal?: AbortSignal) {
    const operation = "search-artists";
    const q = requireDeezerQuery(query, operation); const page = requireDeezerPage(index, limit, operation);
    return collection(await getDeezerJson("/search/artist", { operation, params: { q, ...page }, signal }), operation).map((item) => artistSummary(item, operation));
  },

  async getArtist(idOrName: string, signal?: AbortSignal): Promise<DeezerArtistDetail | null> {
    const operation = "artist-detail";
    const normalized = idOrName.trim();
    if (!normalized || normalized.length > 200) throw new DeezerError("DEEZER_INVALID_INPUT", operation, 400);
    try {
      let detail: Record<string, unknown>;
      if (/^\d+$/.test(normalized)) {
        detail = deezerObject(await getDeezerJson(`/artist/${requireDeezerId(normalized, operation)}`, { operation, signal }), operation);
      } else {
        const found = collection(await getDeezerJson("/search/artist", { operation, params: { q: requireDeezerQuery(normalized, operation), limit: 1 }, signal }), operation)[0];
        if (!found) return null;
        detail = deezerObject(await getDeezerJson(`/artist/${requireDeezerId(numericId(found.id) ?? "", operation)}`, { operation, signal }), operation);
      }
      const summary = artistSummary(detail, operation);
      return { ...summary, pictureXlUrl: text(detail.picture_xl) ?? summary.pictureUrl, nb_fan: numberOr(detail.nb_fan, 0), nb_album: numberOr(detail.nb_album, 0) };
    } catch (error) {
      if (error instanceof DeezerError && error.code === "DEEZER_NOT_FOUND") return null;
      throw error;
    }
  },

  async getArtistTopTracks(artistId: string, signal?: AbortSignal): Promise<DeezerArtistTopTrack[]> {
    const operation = "artist-top-tracks";
    const data = collection(await getDeezerJson(`/artist/${requireDeezerId(artistId, operation)}/top`, { operation, params: { limit: 5 }, signal }), operation);
    return data.map((track) => {
      const id = numericId(track.id); const title = text(track.title); const albumData = deezerObject(track.album, operation); const albumId = numericId(albumData.id); const albumTitle = text(albumData.title);
      if (!id || !title || !albumId || !albumTitle) throw new DeezerError("DEEZER_INVALID_PAYLOAD", operation, 502);
      return { id, title, duration: formatDuration(track.duration), album: { id: albumId, title: albumTitle } };
    });
  },

  async getArtistAlbums(artistId: string, limit = 50, signal?: AbortSignal) {
    const operation = "artist-albums";
    requireDeezerPage(0, limit, operation);
    return collection(await getDeezerJson(`/artist/${requireDeezerId(artistId, operation)}/albums`, { operation, params: { limit }, signal }), operation).map((item) => album(item, operation));
  },

  async getArtistAlbumsPage(artistId: string, index: number, limit: number, signal?: AbortSignal): Promise<DeezerArtistAlbumsPage> {
    const operation = "artist-albums-page";
    const page = requireDeezerPage(index, limit, operation);
    const root = deezerObject(await getDeezerJson(`/artist/${requireDeezerId(artistId, operation)}/albums`, { operation, params: page, signal }), operation);
    const albums = deezerArray(root.data, operation).map((item) => album(item, operation));
    return { albums, nextIndex: text(root.next) && albums.length > 0 ? index + albums.length : null };
  },

  async getRelatedArtists(artistId: string, signal?: AbortSignal) {
    const operation = "related-artists";
    return collection(await getDeezerJson(`/artist/${requireDeezerId(artistId, operation)}/related`, { operation, params: { limit: 6 }, signal }), operation).map((item) => artistSummary(item, operation));
  },
};
