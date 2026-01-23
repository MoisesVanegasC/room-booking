-- CreateEnum
CREATE TYPE "ReservationStatus" AS ENUM ('CONFIRMED', 'IN_PROGRESS', 'FINISHED', 'CANCELLED', 'NO_SHOW');

-- CreateTable
CREATE TABLE "Reservation" (
    "id" SERIAL NOT NULL,
    "roomId" INTEGER NOT NULL,
    "startAt" TIMESTAMP(3) NOT NULL,
    "endAt" TIMESTAMP(3) NOT NULL,
    "status" "ReservationStatus" NOT NULL DEFAULT 'CONFIRMED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Reservation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Reservation_roomId_startAt_idx" ON "Reservation"("roomId", "startAt");

-- AddForeignKey
ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE "Reservation"
    ADD CONSTRAINT "reservation_time_order"
    CHECK ("endAt" > "startAt");

ALTER TABLE "Reservation"
    ADD CONSTRAINT "reservation_no_overlap_per_room"
    EXCLUDE USING gist (
        "roomId" WITH =,
        tsrange("startAt", "endAt", '[)') WITH &&
    );
