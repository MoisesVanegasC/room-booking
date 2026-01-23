import { prisma } from "../../src/config/prisma";

export async function seedRoomRules() {
    const rooms = await prisma.room.findMany({ select: { id: true } });

    for (const room of rooms) {
        // Domingo 0 cerrado
        await prisma.roomRule.upsert({
            where: { roomId_dayOfWeek: { roomId: room.id, dayOfWeek: 0 } },
            update: { isClosed: true, openAt: "00:00", closeAt: "00:00" },
            create: { roomId: room.id, dayOfWeek: 0, isClosed: true, openAt: "00:00", closeAt: "00:00" },
        });

        // Lunes a Viernes 1..5
        for (let dow = 1; dow <= 5; dow++) {
            await prisma.roomRule.upsert({
                where: { roomId_dayOfWeek: { roomId: room.id, dayOfWeek: dow } },
                update: { isClosed: false, openAt: "08:00", closeAt: "20:00" },
                create: { roomId: room.id, dayOfWeek: dow, isClosed: false, openAt: "08:00", closeAt: "20:00" },
            });
        }

        // Sábado 6
        await prisma.roomRule.upsert({
            where: { roomId_dayOfWeek: { roomId: room.id, dayOfWeek: 6 } },
            update: { isClosed: false, openAt: "10:00", closeAt: "14:00" },
            create: { roomId: room.id, dayOfWeek: 6, isClosed: false, openAt: "10:00", closeAt: "14:00" },
        });
    }

    console.log("Seed OK");
}

seedRoomRules()
    .catch(console.error)
    .finally(async () => prisma.$disconnect());