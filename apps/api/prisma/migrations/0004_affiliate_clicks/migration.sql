-- Log outbound affiliate-card clicks for provider/category/destination reporting.
CREATE TABLE "affiliate_clicks" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "destination" TEXT NOT NULL,
    "tripId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "affiliate_clicks_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "affiliate_clicks_provider_createdAt_idx" ON "affiliate_clicks"("provider", "createdAt" DESC);
CREATE INDEX "affiliate_clicks_category_createdAt_idx" ON "affiliate_clicks"("category", "createdAt" DESC);
CREATE INDEX "affiliate_clicks_destination_idx" ON "affiliate_clicks"("destination");
