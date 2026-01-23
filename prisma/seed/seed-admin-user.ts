import "dotenv/config";
import bcrypt from "bcrypt";
import { prisma } from "../../src/config/prisma";

async function main() {
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


    console.log("ADMIN listo:", admin);
    console.log("Login con:", { email: Aemail, password: Apassword });
    console.log("USER listo:", user);
    console.log("Login USER con:", { email: Uemail, password: Upassword });
    console.log("Seed OK");
}

main()
    .catch(console.error)
    .finally(async () => prisma.$disconnect());
