-- Add admin flag to users for the admin user-management endpoints.
ALTER TABLE "users" ADD COLUMN "isAdmin" BOOLEAN NOT NULL DEFAULT false;
