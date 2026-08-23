-- Add daily AI recommendation budget counters to users.
ALTER TABLE "users" ADD COLUMN "recommendationCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "users" ADD COLUMN "recommendationCountDay" DATE;
