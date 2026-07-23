import ListDetailClient from "./ListDetailClient";
import { getTranslations } from "next-intl/server";

export async function generateMetadata({ params }: { params: { id: string; locale: string } }) {
  const t = await getTranslations({ locale: params.locale, namespace: "Metadata" });
  return {
    title: t("listTitle"),
  };
}

export default function ListPage({ params }: { params: { id: string; locale: string } }) {
  return <ListDetailClient id={params.id} />;
}
