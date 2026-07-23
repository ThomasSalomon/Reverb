import { Metadata } from "next";
import { MusicService } from "@/services/music";
import AlbumDetailClient from "./AlbumDetailClient";
import { getTranslations } from "next-intl/server";

type Props = {
  params: { id: string; locale: string };
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id, locale } = params;
  const t = await getTranslations({ locale, namespace: "Metadata" });
  
  try {
    const item = await MusicService.getItemById(id);
    
    if (!item) {
      return {
        title: t("albumNotFound"),
      };
    }
    
    return {
      title: t("albumTitle", { title: item.title, artist: item.artist }),
      description: t("albumDescription", { title: item.title, artist: item.artist }),
      openGraph: {
        title: `${item.title} - ${item.artist}`,
        description: t("albumDescription", { title: item.title, artist: item.artist }),
        images: [
          {
            url: item.coverUrl,
            width: 500,
            height: 500,
            alt: t("coverAlt", { title: item.title }),
          },
        ],
        type: "music.album",
      },
      twitter: {
        card: "summary_large_image",
        title: `${item.title} - ${item.artist}`,
        description: t("albumDescription", { title: item.title, artist: item.artist }),
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
