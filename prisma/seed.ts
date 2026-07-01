import { prisma } from "../src/services/db";

async function main() {
  console.log("Cleaning database from mock items...");

  await prisma.musicItem.deleteMany({
    where: {
      id: {
        in: [
          "pink-floyd-dark-side",
          "daft-punk-ram",
          "radiohead-ok-computer",
          "kendrick-lamar-tpab",
          "tame-impala-currents"
        ]
      }
    }
  });

  console.log("Mock music items deleted successfully!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
