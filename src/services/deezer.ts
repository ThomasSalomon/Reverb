export interface DeezerAlbumSearchItem {
  id: string;
  title: string;
  artist: string;
  coverUrl: string;
  releaseYear: number;
}

export interface DeezerArtistSearchItem {
  id: string;
  name: string;
  pictureUrl: string;
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

export interface DeezerArtistDetail {
  id: string;
  name: string;
  pictureUrl: string;
  pictureXlUrl: string;
  nb_fan: number;
  nb_album: number;
}

export interface DeezerArtistTopTrack {
  id: string;
  title: string;
  duration: string;
  album: {
    id: string;
    title: string;
  };
}

export interface DeezerRelatedArtist {
  id: string;
  name: string;
  pictureUrl: string;
}

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

export const DeezerService = {
  async searchAlbums(query: string, index: number = 0, limit: number = 50): Promise<DeezerAlbumSearchItem[]> {
    if (!query || query.trim() === "") return [];

    try {
      const response = await fetch(
        `https://api.deezer.com/search/album?q=${encodeURIComponent(query)}&index=${index}&limit=${limit}`,
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
      throw error;
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

  async getPopularArtists(): Promise<any[]> {
    try {
      const response = await fetch("https://api.deezer.com/chart/0/artists", {
        cache: "no-store",
      });
      if (!response.ok) {
        throw new Error(`Deezer API chart error: ${response.statusText}`);
      }

      const data = await response.json();
      if (!data.data || !Array.isArray(data.data)) return [];

      return data.data.map((item: any) => ({
        id: String(item.id),
        name: item.name,
        pictureUrl: item.picture_medium || item.picture || "/covers/placeholder.png",
      }));
    } catch (error) {
      console.error("Error in DeezerService.getPopularArtists:", error);
      return [];
    }
  },

  async searchArtists(query: string, index: number = 0, limit: number = 50): Promise<DeezerArtistSearchItem[]> {
    if (!query || query.trim() === "") return [];

    try {
      const response = await fetch(`https://api.deezer.com/search/artist?q=${encodeURIComponent(query)}&index=${index}&limit=${limit}`, {
        cache: "no-store",
      });
      if (!response.ok) {
        throw new Error(`Deezer API search error: ${response.statusText}`);
      }

      const data = await response.json();
      if (!data.data || !Array.isArray(data.data)) return [];

      return data.data.map((item: any) => ({
        id: String(item.id),
        name: item.name,
        pictureUrl: item.picture_medium || item.picture || "/covers/placeholder.png",
      }));
    } catch (error) {
      console.error("Error in DeezerService.searchArtists:", error);
      throw error;
    }
  },

  async getArtist(idOrName: string): Promise<DeezerArtistDetail | null> {
    if (!idOrName || idOrName.trim() === "") return null;

    try {
      let url = "";
      // Check if it's a numeric ID or a name
      if (/^\d+$/.test(idOrName)) {
        url = `https://api.deezer.com/artist/${idOrName}`;
      } else {
        url = `https://api.deezer.com/search/artist?q=${encodeURIComponent(idOrName)}&limit=1`;
      }

      const response = await fetch(url, { cache: "no-store" });
      if (!response.ok) throw new Error(`Deezer API artist error: ${response.statusText}`);

      const data = await response.json();
      if (data.error) throw new Error(`Deezer API error: ${data.error.message}`);

      // If it was a search, the actual artist object is inside data.data[0]
      const artistData = data.data && data.data.length > 0 ? data.data[0] : data;

      if (!artistData.id) return null;

      // If we searched by name, we might want to fetch the full artist profile to get nb_fan if it's missing from search result
      let fullArtistData = artistData;
      if (data.data && data.data.length > 0) {
          const fullRes = await fetch(`https://api.deezer.com/artist/${artistData.id}`, { cache: "no-store" });
          fullArtistData = await fullRes.json();
      }

      return {
        id: String(fullArtistData.id),
        name: fullArtistData.name,
        pictureUrl: fullArtistData.picture_medium || fullArtistData.picture || "/covers/placeholder.png",
        pictureXlUrl: fullArtistData.picture_xl || fullArtistData.picture_medium || "/covers/placeholder.png",
        nb_fan: fullArtistData.nb_fan || 0,
        nb_album: fullArtistData.nb_album || 0,
      };
    } catch (error) {
      console.error("Error in DeezerService.getArtist:", error);
      return null;
    }
  },

  async getArtistTopTracks(artistId: string): Promise<DeezerArtistTopTrack[]> {
    if (!artistId) return [];
    try {
      const response = await fetch(`https://api.deezer.com/artist/${artistId}/top?limit=5`, { cache: "no-store" });
      if (!response.ok) throw new Error("API Error");
      const data = await response.json();
      if (!data.data) return [];
      
      return data.data.map((track: any) => ({
        id: String(track.id),
        title: track.title,
        duration: formatDuration(track.duration || 0),
        album: {
          id: String(track.album.id),
          title: track.album.title
        }
      }));
    } catch (error) {
      console.error("Error getting artist top tracks:", error);
      return [];
    }
  },

  async getArtistAlbums(artistId: string, limit: number = 50): Promise<DeezerAlbumSearchItem[]> {
    if (!artistId) return [];
    try {
      const response = await fetch(`https://api.deezer.com/artist/${artistId}/albums?limit=${limit}`, { cache: "no-store" });
      if (!response.ok) throw new Error("API Error");
      const data = await response.json();
      if (!data.data) return [];

      return data.data.map((item: any) => ({
        id: String(item.id),
        title: item.title,
        artist: item.artist?.name || "Artista Desconocido",
        coverUrl: item.cover_medium || item.cover || "/covers/placeholder.png",
        releaseYear: item.release_date ? parseInt(item.release_date.substring(0, 4), 10) : 2000,
      }));
    } catch (error) {
      console.error("Error getting artist albums:", error);
      return [];
    }
  },

  async getRelatedArtists(artistId: string): Promise<DeezerRelatedArtist[]> {
    if (!artistId) return [];
    try {
      const response = await fetch(`https://api.deezer.com/artist/${artistId}/related?limit=6`, { cache: "no-store" });
      if (!response.ok) throw new Error("API Error");
      const data = await response.json();
      if (!data.data) return [];

      return data.data.map((item: any) => ({
        id: String(item.id),
        name: item.name,
        pictureUrl: item.picture_medium || item.picture || "/covers/placeholder.png",
      }));
    } catch (error) {
      console.error("Error getting related artists:", error);
      return [];
    }
  }
};
