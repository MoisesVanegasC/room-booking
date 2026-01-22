import { createApp } from "./app";
import { prisma } from "./config/prisma";
import { runNoShowSweep } from "./workers/noShowWorker";


const PORT = process.env.PORT ? Number(process.env.PORT) : 3000;
const app = createApp();
const ENABLE_WORKERS = process.env.ENABLE_WORKERS === "true";

app.listen(PORT, () => {
  console.log(`API running on http://localhost:${PORT}`);

  (async () => {
    const rooms = await prisma.room.findMany();
    //console.log("Rooms:", rooms);
  })();
});

if (ENABLE_WORKERS) {
  // Cada 60s en dev
  setInterval(async () => {
    try {
      const out = await runNoShowSweep();
      console.log("[no-show-worker]", out);
    } catch (e) {
      console.error("[no-show-worker] error", e);
    }
  }, 60_000);
}

createApp().listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});