import "dotenv/config";
import bcrypt from "bcrypt";
import { prisma } from "../../src/config/prisma";

async function main() {
    const email = "admin@test.com";
    const password = "AdminSeguro123";

    const passwordHash = await bcrypt.hash(password, 12);

    const admin = await prisma.user.upsert({
        where: { email },
        update: { role: "ADMIN" },
        create: { email, passwordHash, role: "ADMIN" },
        select: { id: true, email: true, role: true },
    });

    console.log("ADMIN listo:", admin);
    console.log("Login con:", { email, password });
    console.log("Seed OK");
}

main()
    .catch(console.error)
    .finally(async () => prisma.$disconnect());
