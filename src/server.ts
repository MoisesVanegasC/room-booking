import { createApp } from "./app";
import { prisma } from "./config/prisma";

const PORT = process.env.PORT ? Number(process.env.PORT) : 3000;

const app = createApp();

app.listen(PORT, () => {
  console.log(`API running on http://localhost:${PORT}`);

  (async () => {
    const rooms = await prisma.room.findMany();
    //console.log("Rooms:", rooms);
  })();
});