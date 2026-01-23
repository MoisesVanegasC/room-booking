import { prisma } from "./config/prisma";

async function main() {
  const rooms = await prisma.room.findMany();
  console.log("Rooms:", rooms);
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });
