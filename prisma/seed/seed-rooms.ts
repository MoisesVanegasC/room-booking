import { prisma } from "../../src/config/prisma";

async function main() {
    await prisma.room.createMany({
        data: [
            { name: "Sala A", capacity: 10 },
            { name: "Sala B", capacity: 20 },
        ],
        skipDuplicates: true,
    });

    console.log("Seed OK");
}

main()
    .catch(console.error)
    .finally(async () => {
        await prisma.$disconnect();
    });
