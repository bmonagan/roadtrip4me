-- Migration: 0002_add_trip_collaborators
-- Collaborators can view/edit a trip; the owner is Trip.userId.

CREATE TABLE "trip_collaborators" (
  "id"      TEXT        NOT NULL DEFAULT gen_random_uuid()::text,
  "tripId"  TEXT        NOT NULL,
  "userId"  TEXT        NOT NULL,
  "addedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT "trip_collaborators_pkey"          PRIMARY KEY ("id"),
  CONSTRAINT "trip_collaborators_tripId_fkey"   FOREIGN KEY ("tripId")
    REFERENCES "trips" ("id") ON DELETE CASCADE,
  CONSTRAINT "trip_collaborators_userId_fkey"   FOREIGN KEY ("userId")
    REFERENCES "users" ("id") ON DELETE CASCADE,
  CONSTRAINT "trip_collaborators_tripId_userId_key" UNIQUE ("tripId", "userId")
);

CREATE INDEX "trip_collaborators_userId_idx" ON "trip_collaborators" ("userId");
