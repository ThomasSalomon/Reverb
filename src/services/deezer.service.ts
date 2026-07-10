import { AppError, NotFoundError } from "../utils/errors";

export interface DeezerTrack {
  id: number;
  title: string;
  preview: string;
  artist: {
    id: number;
    name: string;
  };
  album: {
    id: number;
    title: string;
    cover_xl: string;
  };
}

export interface DeezerArtist {
  id: number;
  name: string;
  picture_xl: string;
}

export class DeezerService {
  private baseUrl = "https://api.deezer.com";

  async getArtist(artistId: string): Promise<DeezerArtist> {
    try {
      const response = await fetch(`${this.baseUrl}/artist/${artistId}`, {
        next: { revalidate: 86400 },
      });
      if (!response.ok) throw new AppError("Failed to fetch artist", response.status);
      const data = await response.json();
      if (data.error) throw new AppError(data.error.message, 400);
      return data;
    } catch (error) {
      throw new AppError("Internal error communicating with Deezer", 500);
    }
  }

  async getTopTracks(artistId: string, limit: number = 20): Promise<DeezerTrack[]> {
    try {
      const response = await fetch(`${this.baseUrl}/artist/${artistId}/top?limit=50`, {
        next: {
          revalidate: 86400, // Cache for 24 hours (86400 seconds)
        },
      });

      if (!response.ok) {
        if (response.status === 404) {
          throw new NotFoundError("Artist not found on Deezer");
        }
        throw new AppError("Failed to fetch from Deezer", response.status);
      }

      const data = await response.json();

      if (data.error) {
        throw new AppError(data.error.message, 400);
      }

      const tracks: DeezerTrack[] = data.data || [];
      
      // Shuffle tracks to provide a randomized playlist
      for (let i = tracks.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [tracks[i], tracks[j]] = [tracks[j], tracks[i]];
      }

      return tracks.slice(0, limit);
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError("Internal error communicating with Deezer", 500);
    }
  }
}
