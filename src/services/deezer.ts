export interface DeezerAlbumSearchItem {
  id: string;
  title: string;
  artist: string;
  coverUrl: string;
  releaseYear: number;
}

export interface DeezerTrack {
  title: string;
  duration: string;
  preview?: string;
}

export interface DeezerAlbumDetail {
  id: string;
  title: string;
  artist: string;
  coverUrl: string;
  releaseYear: number;
  tracks: DeezerTrack[];
}

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

export const DeezerService = {
  async searchAlbums(query: string): Promise<DeezerAlbumSearchItem[]> {
    if (!query || query.trim() === "") return [];

    try {
      const response = await fetch(
        `https://api.deezer.com/search/album?q=${encodeURIComponent(query)}`,
        { cache: "no-store" }
      );
      if (!response.ok) {
        throw new Error(`Deezer API search error: ${response.statusText}`);
      }

      const data = await response.json();
      if (!data.data || !Array.isArray(data.data)) return [];

      return data.data.map((item: any) => {
        // Deezer doesn't return release year in generic search, we fallback to 2000 or get it on details.
        // But some search results might have release_date or we can default to a standard placeholder.
        return {
          id: String(item.id),
          title: item.title,
          artist: item.artist?.name || "Artista Desconocido",
          coverUrl: item.cover_medium || item.cover || "/covers/placeholder.png",
          releaseYear: 2000, // Default for search preview
        };
      });
    } catch (error) {
      console.error("Error in DeezerService.searchAlbums:", error);
      return [];
    }
  },

  async getAlbumById(id: string): Promise<DeezerAlbumDetail | null> {
    if (!id) return null;

    try {
      const response = await fetch(`https://api.deezer.com/album/${id}`, {
        cache: "no-store",
      });
      if (!response.ok) {
        throw new Error(`Deezer API album details error: ${response.statusText}`);
      }

      const data = await response.json();
      if (data.error) {
        throw new Error(`Deezer API error: ${data.error.message}`);
      }

      const releaseYear = data.release_date
        ? parseInt(data.release_date.substring(0, 4), 10)
        : 2000;

      const tracks: DeezerTrack[] =
        data.tracks?.data?.map((track: any) => ({
          title: track.title,
          duration: formatDuration(track.duration || 0),
          preview: track.preview,
        })) || [];

      return {
        id: String(data.id),
        title: data.title,
        artist: data.artist?.name || "Artista Desconocido",
        coverUrl: data.cover_medium || data.cover || "/covers/placeholder.png",
        releaseYear,
        tracks,
      };
    } catch (error) {
      console.error("Error in DeezerService.getAlbumById:", error);
      return null;
    }
  },

  async getPopularAlbums(): Promise<DeezerAlbumSearchItem[]> {
    try {
      const response = await fetch("https://api.deezer.com/chart/0/albums", {
        cache: "no-store",
      });
      if (!response.ok) {
        throw new Error(`Deezer API chart error: ${response.statusText}`);
      }

      const data = await response.json();
      if (!data.data || !Array.isArray(data.data)) return [];

      return data.data.map((item: any) => ({
        id: String(item.id),
        title: item.title,
        artist: item.artist?.name || "Artista Desconocido",
        coverUrl: item.cover_medium || item.cover || "/covers/placeholder.png",
        releaseYear: 2000,
      }));
    } catch (error) {
      console.error("Error in DeezerService.getPopularAlbums:", error);
      return [];
    }
  },
};
