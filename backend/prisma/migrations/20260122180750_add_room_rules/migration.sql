-- CreateTable
CREATE TABLE "RoomRule" (
    "id" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "dayOfWeek" INTEGER NOT NULL,
    "openAt" TEXT NOT NULL,
    "closeAt" TEXT NOT NULL,
    "isClosed" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "RoomRule_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RoomRule_roomId_dayOfWeek_idx" ON "RoomRule"("roomId", "dayOfWeek");

-- CreateIndex
CREATE UNIQUE INDEX "RoomRule_roomId_dayOfWeek_key" ON "RoomRule"("roomId", "dayOfWeek");

-- AddForeignKey
ALTER TABLE "RoomRule" ADD CONSTRAINT "RoomRule_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE CASCADE ON UPDATE CASCADE;
