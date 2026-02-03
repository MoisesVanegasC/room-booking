ALTER TABLE "Reservation"
DROP CONSTRAINT IF EXISTS "reservation_no_overlap_per_room";

CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE "Reservation"
ADD CONSTRAINT "reservation_no_overlap_per_room"
EXCLUDE USING gist (
    "roomId" WITH =,
    tsrange("startAt", "endAt", '[)') WITH &&
)
WHERE ("status" IN ('CONFIRMED', 'IN_PROGRESS'));
