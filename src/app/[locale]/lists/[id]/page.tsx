import ListDetailClient from "./ListDetailClient";

export async function generateMetadata({ params }: { params: { id: string } }) {
  // Option: Fetch list from DB to set dynamic metadata title (e.g. `title - Ride The Music`)
  return {
    title: "Lista | Ride The Music",
  };
}

export default function ListPage({ params }: { params: { id: string } }) {
  return <ListDetailClient id={params.id} />;
}
