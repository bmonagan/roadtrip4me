-- Migration: 0001_init
-- Roadtrip4me initial schema
--
-- Two things in this file that Prisma cannot generate from schema.prisma:
--   1. CREATE INDEX ... USING GIST  (spatial index on geography columns)
--   2. CHECK (value IN (1, -1))     (constraint on votes.value)
-- Everything else matches what `prisma migrate dev` would produce.

-- ─── Extensions ──────────────────────────────────────────────────────────────

CREATE EXTENSION IF NOT EXISTS "postgis";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";  -- for gen_random_uuid() fallback

-- ─── Enums ───────────────────────────────────────────────────────────────────

CREATE TYPE "TripStatus" AS ENUM (
  'draft',
  'planned',
  'in_progress',
  'completed'
);

CREATE TYPE "TripVibe" AS ENUM (
  'scenic',
  'foodie',
  'adventure',
  'historic',
  'relaxed',
  'family'
);

CREATE TYPE "StopCategory" AS ENUM (
  'restaurant',
  'attraction',
  'gas_station',
  'lodging',
  'park',
  'viewpoint',
  'campground',
  'museum',
  'shopping',
  'other'
);

-- ─── Users ───────────────────────────────────────────────────────────────────

CREATE TABLE "users" (
  "id"          TEXT        NOT NULL DEFAULT gen_random_uuid()::text,
  "authId"      TEXT        NOT NULL,
  "email"       TEXT        NOT NULL,
  "displayName" TEXT        NOT NULL,
  "avatarUrl"   TEXT,
  "isPremium"   BOOLEAN     NOT NULL DEFAULT false,
  "createdAt"   TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt"   TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "users_authId_key" ON "users" ("authId");
CREATE UNIQUE INDEX "users_email_key"  ON "users" ("email");

-- ─── Trips ───────────────────────────────────────────────────────────────────

CREATE TABLE "trips" (
  "id"                   TEXT          NOT NULL DEFAULT gen_random_uuid()::text,
  "userId"               TEXT          NOT NULL,
  "title"                TEXT          NOT NULL,
  "status"               "TripStatus"  NOT NULL DEFAULT 'draft',
  "vibes"                "TripVibe"[]  NOT NULL DEFAULT '{}',

  "originLabel"          TEXT          NOT NULL,
  "originLat"            DOUBLE PRECISION NOT NULL,
  "originLng"            DOUBLE PRECISION NOT NULL,
  "originPoint"          geography(Point, 4326),

  "destLabel"            TEXT          NOT NULL,
  "destLat"              DOUBLE PRECISION NOT NULL,
  "destLng"              DOUBLE PRECISION NOT NULL,
  "destPoint"            geography(Point, 4326),

  "startDate"            TIMESTAMPTZ,
  "endDate"              TIMESTAMPTZ,
  "totalDistanceMeters"  INTEGER,
  "totalDurationSeconds" INTEGER,
  "encodedPolyline"      TEXT,

  "createdAt"            TIMESTAMPTZ   NOT NULL DEFAULT now(),
  "updatedAt"            TIMESTAMPTZ   NOT NULL DEFAULT now(),

  CONSTRAINT "trips_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "trips_userId_fkey" FOREIGN KEY ("userId")
    REFERENCES "users" ("id") ON DELETE CASCADE
);

CREATE INDEX "trips_userId_createdAt_idx" ON "trips" ("userId", "createdAt" DESC);
CREATE INDEX "trips_originPoint_idx"      ON "trips" USING GIST ("originPoint");
CREATE INDEX "trips_destPoint_idx"        ON "trips" USING GIST ("destPoint");

-- ─── Trip Waypoints ───────────────────────────────────────────────────────────

CREATE TABLE "trip_waypoints" (
  "id"     TEXT    NOT NULL DEFAULT gen_random_uuid()::text,
  "tripId" TEXT    NOT NULL,
  "order"  INTEGER NOT NULL,
  "label"  TEXT    NOT NULL,
  "lat"    DOUBLE PRECISION NOT NULL,
  "lng"    DOUBLE PRECISION NOT NULL,
  "stopId" TEXT,

  CONSTRAINT "trip_waypoints_pkey"          PRIMARY KEY ("id"),
  CONSTRAINT "trip_waypoints_tripId_fkey"   FOREIGN KEY ("tripId")
    REFERENCES "trips" ("id") ON DELETE CASCADE,
  CONSTRAINT "trip_waypoints_stopId_fkey"   FOREIGN KEY ("stopId")
    REFERENCES "stops" ("id") ON DELETE SET NULL,  -- stops table created below
  CONSTRAINT "trip_waypoints_tripId_order_key" UNIQUE ("tripId", "order")
);

CREATE INDEX "trip_waypoints_tripId_idx" ON "trip_waypoints" ("tripId");

-- ─── Stops ───────────────────────────────────────────────────────────────────

CREATE TABLE "stops" (
  "id"                TEXT            NOT NULL DEFAULT gen_random_uuid()::text,
  "name"              TEXT            NOT NULL,
  "description"       TEXT,
  "category"          "StopCategory"  NOT NULL,
  "imageUrl"          TEXT,

  "lat"               DOUBLE PRECISION NOT NULL,
  "lng"               DOUBLE PRECISION NOT NULL,
  -- geography column is the source of truth for spatial queries.
  -- Always set via: ST_SetSRID(ST_Point(lng, lat), 4326)::geography
  "location"          geography(Point, 4326),

  "street"            TEXT,
  "city"              TEXT            NOT NULL,
  "state"             TEXT            NOT NULL,
  "country"           TEXT            NOT NULL DEFAULT 'US',
  "postalCode"        TEXT,

  "externalId"        TEXT,
  "externalSource"    TEXT,

  -- Denormalized vote aggregates. Updated in a transaction every time
  -- a vote is cast. Never SUM at read time.
  "score"             INTEGER         NOT NULL DEFAULT 0,
  "voteCount"         INTEGER         NOT NULL DEFAULT 0,

  "submittedByUserId" TEXT,
  "createdAt"         TIMESTAMPTZ     NOT NULL DEFAULT now(),
  "updatedAt"         TIMESTAMPTZ     NOT NULL DEFAULT now(),

  CONSTRAINT "stops_pkey"               PRIMARY KEY ("id"),
  CONSTRAINT "stops_externalId_key"     UNIQUE ("externalId"),
  CONSTRAINT "stops_submittedBy_fkey"   FOREIGN KEY ("submittedByUserId")
    REFERENCES "users" ("id") ON DELETE SET NULL
);

-- GIST index is what makes ST_DWithin fast — without it every spatial query
-- is a full table scan. Required before going to production.
CREATE INDEX "stops_location_idx"       ON "stops" USING GIST ("location");
CREATE INDEX "stops_category_idx"       ON "stops" ("category");
CREATE INDEX "stops_score_idx"          ON "stops" ("score" DESC);
CREATE INDEX "stops_city_state_idx"     ON "stops" ("city", "state");

-- ─── Trip Stops ───────────────────────────────────────────────────────────────

CREATE TABLE "trip_stops" (
  "id"      TEXT        NOT NULL DEFAULT gen_random_uuid()::text,
  "tripId"  TEXT        NOT NULL,
  "stopId"  TEXT        NOT NULL,
  "order"   INTEGER     NOT NULL,
  "addedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT "trip_stops_pkey"              PRIMARY KEY ("id"),
  CONSTRAINT "trip_stops_tripId_fkey"       FOREIGN KEY ("tripId")
    REFERENCES "trips" ("id") ON DELETE CASCADE,
  CONSTRAINT "trip_stops_stopId_fkey"       FOREIGN KEY ("stopId")
    REFERENCES "stops" ("id") ON DELETE CASCADE,
  CONSTRAINT "trip_stops_tripId_stopId_key" UNIQUE ("tripId", "stopId"),
  CONSTRAINT "trip_stops_tripId_order_key"  UNIQUE ("tripId", "order")
);

CREATE INDEX "trip_stops_tripId_idx" ON "trip_stops" ("tripId");

-- ─── Votes ───────────────────────────────────────────────────────────────────

CREATE TABLE "votes" (
  "id"        TEXT        NOT NULL DEFAULT gen_random_uuid()::text,
  "userId"    TEXT        NOT NULL,
  "stopId"    TEXT        NOT NULL,
  "value"     INTEGER     NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT "votes_pkey"             PRIMARY KEY ("id"),
  CONSTRAINT "votes_userId_fkey"      FOREIGN KEY ("userId")
    REFERENCES "users" ("id") ON DELETE CASCADE,
  CONSTRAINT "votes_stopId_fkey"      FOREIGN KEY ("stopId")
    REFERENCES "stops" ("id") ON DELETE CASCADE,
  CONSTRAINT "votes_userId_stopId_key" UNIQUE ("userId", "stopId"),
  -- This constraint is the thing Prisma cannot express in schema.prisma.
  -- It ensures value is always exactly 1 or -1 at the database level,
  -- independent of application-layer validation.
  CONSTRAINT "votes_value_check"      CHECK ("value" IN (1, -1))
);

CREATE INDEX "votes_stopId_idx" ON "votes" ("stopId");

-- ─── Saved Stops ─────────────────────────────────────────────────────────────

CREATE TABLE "saved_stops" (
  "id"      TEXT        NOT NULL DEFAULT gen_random_uuid()::text,
  "userId"  TEXT        NOT NULL,
  "stopId"  TEXT        NOT NULL,
  "savedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT "saved_stops_pkey"               PRIMARY KEY ("id"),
  CONSTRAINT "saved_stops_userId_fkey"        FOREIGN KEY ("userId")
    REFERENCES "users" ("id") ON DELETE CASCADE,
  CONSTRAINT "saved_stops_stopId_fkey"        FOREIGN KEY ("stopId")
    REFERENCES "stops" ("id") ON DELETE CASCADE,
  CONSTRAINT "saved_stops_userId_stopId_key"  UNIQUE ("userId", "stopId")
);

CREATE INDEX "saved_stops_userId_idx" ON "saved_stops" ("userId");

-- ─── updatedAt triggers ───────────────────────────────────────────────────────
-- Postgres does not auto-update updatedAt. This trigger handles it so the
-- application never has to remember to set it manually.

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW."updatedAt" = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "users_updated_at"
  BEFORE UPDATE ON "users"
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER "trips_updated_at"
  BEFORE UPDATE ON "trips"
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER "stops_updated_at"
  BEFORE UPDATE ON "stops"
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER "votes_updated_at"
  BEFORE UPDATE ON "votes"
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
