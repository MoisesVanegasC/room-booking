import { prisma } from "../src/config/prisma";
import bcrypt from "bcrypt";
import "dotenv/config";

async function main() {
    //ROOMS
    await prisma.room.createMany({
        data: [
            { name: "Sala A", capacity: 10 },
            { name: "Sala B", capacity: 20 },
        ],
        skipDuplicates: true,
    });

    //ADMIN
    const Aemail = "admin@test.com";
    const Apassword = "AdminSeguro123";
    const ApasswordHash = await bcrypt.hash(Apassword, 12);

    const admin = await prisma.user.upsert({
        where: { email : Aemail },
        update: { role: "ADMIN" },
        create: { email : Aemail, passwordHash:ApasswordHash, role: "ADMIN" },
        select: { id: true, email : true, role: true },
    });

    //USER
    const Uemail = "user@test.com";
    const Upassword = "UserSeguro123";
    const UpasswordHash = await bcrypt.hash(Upassword, 12);

    const user = await prisma.user.upsert({
        where: { email: Uemail },
        update: { role: "USER" },
        create: { email: Uemail, passwordHash: UpasswordHash, role: "USER" },
        select: { id: true, email: true, role: true },
    });

    //ROOM RULES
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

    /*
    console.log("ADMIN listo:", admin);
    console.log("Login con:", { email: Aemail, password: Apassword });

    console.log("USER listo:", user);
    console.log("Login USER con:", { email: Uemail, password: Upassword });

    console.log("Seed OK");
    */

    console.log("ADMIN listo | Login admin:", Aemail);
    console.log("USER listo | Login user:", Uemail);

    console.log("Seed OK");
}

main()
    .catch(console.error)
    .finally(async () => {
        await prisma.$disconnect();
    });
