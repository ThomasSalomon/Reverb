import { prisma } from "../src/services/db";

async function main() {
  console.log("Seeding MusicEvent for testing...");

  const today = new Date();
  
  // Michael Jackson Deezer ID is 259
  await prisma.musicEvent.create({
    data: {
      dateMonth: today.getMonth() + 1,
      dateDay: today.getDate(),
      artistName: "Michael Jackson",
      artistId: "259",
      eventType: "DEATH",
      description: "Recordamos a la leyenda del pop en su aniversario.",
    }
  });

  console.log("Test event created successfully!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
