import { Metadata } from "next";
import { MusicService } from "@/services/music";
import AlbumDetailClient from "./AlbumDetailClient";

type Props = {
  params: { id: string };
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = params;
  
  try {
    const item = await MusicService.getItemById(id);
    
    if (!item) {
      return {
        title: "Álbum no encontrado - Ride The Music",
      };
    }
    
    return {
      title: `${item.title} por ${item.artist} - Ride The Music`,
      description: `Descubre y escucha el álbum ${item.title} de ${item.artist} en Ride The Music.`,
      openGraph: {
        title: `${item.title} - ${item.artist}`,
        description: `Escucha ${item.title} de ${item.artist} en Ride The Music.`,
        images: [
          {
            url: item.coverUrl,
            width: 500,
            height: 500,
            alt: `Portada de ${item.title}`,
          },
        ],
        type: "music.album",
      },
      twitter: {
        card: "summary_large_image",
        title: `${item.title} - ${item.artist}`,
        description: `Escucha ${item.title} de ${item.artist} en Ride The Music.`,
        images: [item.coverUrl],
      }
    };
  } catch (error) {
    return {
      title: "Ride The Music",
    };
  }
}

export default function AlbumDetailPage({ params }: Props) {
  return <AlbumDetailClient id={params.id} />;
}
