-- Migration: 0001_init
-- Roadtrip4me full schema (regenerated from schema.prisma).
--
-- Contains three things that Prisma cannot generate from schema.prisma:
--   1. CREATE INDEX ... USING GIST  (spatial index on geography columns)
--   2. CHECK (value IN (1, -1))     (constraint on votes.value)
--   3. pgcrypto extension            (gen_random_uuid fallback)
-- Everything else matches `prisma migrate dev` output.

-- ─── Extensions ──────────────────────────────────────────────────────────────

CREATE EXTENSION IF NOT EXISTS "postgis";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";  -- for gen_random_uuid() fallback

-- ─── Enums ───────────────────────────────────────────────────────────────────

CREATE TYPE "TripStatus" AS ENUM ('draft', 'planned', 'in_progress', 'completed');
CREATE TYPE "TripVibe" AS ENUM ('scenic', 'foodie', 'adventure', 'historic', 'relaxed', 'family');
CREATE TYPE "StopCategory" AS ENUM ('restaurant', 'attraction', 'gas_station', 'lodging', 'park', 'viewpoint', 'campground', 'museum', 'shopping', 'other');
CREATE TYPE "RecommendationStatus" AS ENUM ('pending', 'processing', 'completed', 'failed');

-- ─── Tables ──────────────────────────────────────────────────────────────────

CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "authId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "avatarUrl" TEXT,
    "isPremium" BOOLEAN NOT NULL DEFAULT false,
    "stripeCustomerId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "trips" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "status" "TripStatus" NOT NULL DEFAULT 'draft',
    "vibes" "TripVibe"[],
    "originLabel" TEXT NOT NULL,
    "originLat" DOUBLE PRECISION NOT NULL,
    "originLng" DOUBLE PRECISION NOT NULL,
    "originPoint" geography(Point, 4326),
    "destLabel" TEXT NOT NULL,
    "destLat" DOUBLE PRECISION NOT NULL,
    "destLng" DOUBLE PRECISION NOT NULL,
    "destPoint" geography(Point, 4326),
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "totalDistanceMeters" INTEGER,
    "totalDurationSeconds" INTEGER,
    "encodedPolyline" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "trips_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "trip_collaborators" (
    "id" TEXT NOT NULL,
    "tripId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "trip_collaborators_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "trip_waypoints" (
    "id" TEXT NOT NULL,
    "tripId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "label" TEXT NOT NULL,
    "lat" DOUBLE PRECISION NOT NULL,
    "lng" DOUBLE PRECISION NOT NULL,
    "stopId" TEXT,

    CONSTRAINT "trip_waypoints_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "stops" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "category" "StopCategory" NOT NULL,
    "imageUrl" TEXT,
    "lat" DOUBLE PRECISION NOT NULL,
    "lng" DOUBLE PRECISION NOT NULL,
    "location" geography(Point, 4326),
    "street" TEXT,
    "city" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "country" TEXT NOT NULL DEFAULT 'US',
    "postalCode" TEXT,
    "externalId" TEXT,
    "externalSource" TEXT,
    "score" INTEGER NOT NULL DEFAULT 0,
    "voteCount" INTEGER NOT NULL DEFAULT 0,
    "submittedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "stops_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "trip_stops" (
    "id" TEXT NOT NULL,
    "tripId" TEXT NOT NULL,
    "stopId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "trip_stops_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "votes" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "stopId" TEXT NOT NULL,
    "value" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "votes_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "votes_value_check" CHECK ("value" IN (1, -1))
);

CREATE TABLE "saved_stops" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "stopId" TEXT NOT NULL,
    "savedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "saved_stops_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "recommendation_requests" (
    "id" TEXT NOT NULL,
    "tripId" TEXT NOT NULL,
    "status" "RecommendationStatus" NOT NULL DEFAULT 'pending',
    "stops" JSONB,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "recommendation_requests_pkey" PRIMARY KEY ("id")
);

-- ─── Indexes ─────────────────────────────────────────────────────────────────

CREATE UNIQUE INDEX "users_authId_key" ON "users"("authId");
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");
CREATE UNIQUE INDEX "users_stripeCustomerId_key" ON "users"("stripeCustomerId");

CREATE INDEX "trips_userId_createdAt_idx" ON "trips"("userId", "createdAt" DESC);
-- Spatial indexes for route distance queries
CREATE INDEX "trips_originPoint_idx" ON "trips" USING GIST ("originPoint");
CREATE INDEX "trips_destPoint_idx" ON "trips" USING GIST ("destPoint");

CREATE INDEX "trip_collaborators_userId_idx" ON "trip_collaborators"("userId");
CREATE UNIQUE INDEX "trip_collaborators_tripId_userId_key" ON "trip_collaborators"("tripId", "userId");

CREATE INDEX "trip_waypoints_tripId_idx" ON "trip_waypoints"("tripId");
CREATE UNIQUE INDEX "trip_waypoints_tripId_order_key" ON "trip_waypoints"("tripId", "order");

CREATE UNIQUE INDEX "stops_externalId_key" ON "stops"("externalId");
CREATE INDEX "stops_category_idx" ON "stops"("category");
CREATE INDEX "stops_score_idx" ON "stops"("score" DESC);
CREATE INDEX "stops_city_state_idx" ON "stops"("city", "state");
-- GIST index is what makes ST_DWithin fast — without it every spatial query
-- on stops.location does a full table scan.
CREATE INDEX "stops_location_idx" ON "stops" USING GIST ("location");

CREATE INDEX "trip_stops_tripId_idx" ON "trip_stops"("tripId");
CREATE UNIQUE INDEX "trip_stops_tripId_stopId_key" ON "trip_stops"("tripId", "stopId");
CREATE UNIQUE INDEX "trip_stops_tripId_order_key" ON "trip_stops"("tripId", "order");

CREATE INDEX "votes_stopId_idx" ON "votes"("stopId");
CREATE UNIQUE INDEX "votes_userId_stopId_key" ON "votes"("userId", "stopId");

CREATE INDEX "saved_stops_userId_idx" ON "saved_stops"("userId");
CREATE UNIQUE INDEX "saved_stops_userId_stopId_key" ON "saved_stops"("userId", "stopId");

CREATE UNIQUE INDEX "recommendation_requests_tripId_key" ON "recommendation_requests"("tripId");

-- ─── Foreign keys ────────────────────────────────────────────────────────────

ALTER TABLE "trips" ADD CONSTRAINT "trips_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "trip_collaborators" ADD CONSTRAINT "trip_collaborators_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "trips"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "trip_collaborators" ADD CONSTRAINT "trip_collaborators_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "trip_waypoints" ADD CONSTRAINT "trip_waypoints_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "trips"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "trip_waypoints" ADD CONSTRAINT "trip_waypoints_stopId_fkey" FOREIGN KEY ("stopId") REFERENCES "stops"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "stops" ADD CONSTRAINT "stops_submittedByUserId_fkey" FOREIGN KEY ("submittedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "trip_stops" ADD CONSTRAINT "trip_stops_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "trips"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "trip_stops" ADD CONSTRAINT "trip_stops_stopId_fkey" FOREIGN KEY ("stopId") REFERENCES "stops"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "votes" ADD CONSTRAINT "votes_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "votes" ADD CONSTRAINT "votes_stopId_fkey" FOREIGN KEY ("stopId") REFERENCES "stops"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "saved_stops" ADD CONSTRAINT "saved_stops_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "saved_stops" ADD CONSTRAINT "saved_stops_stopId_fkey" FOREIGN KEY ("stopId") REFERENCES "stops"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "recommendation_requests" ADD CONSTRAINT "recommendation_requests_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "trips"("id") ON DELETE CASCADE ON UPDATE CASCADE;
