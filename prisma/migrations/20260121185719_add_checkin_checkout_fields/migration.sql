-- AlterTable
ALTER TABLE "Reservation" ADD COLUMN     "checkInAt" TIMESTAMP(3),
ADD COLUMN     "checkOutAt" TIMESTAMP(3),
ADD COLUMN     "lateCheckout" BOOLEAN NOT NULL DEFAULT false;
