// prisma/seed.ts
// Run with: bunx ts-node prisma/seed.ts
// Or add to package.json: "prisma": { "seed": "bun run prisma/seed.ts" }
// Then run: bunx prisma db seed

import { PrismaClient, StopCategory, TripStatus, TripVibe } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // ── Users ──────────────────────────────────────────────────────────────────
  const alice = await prisma.user.upsert({
    where: { email: 'alice@example.com' },
    update: {},
    create: {
      authId: 'auth0|seed_alice',
      email: 'alice@example.com',
      displayName: 'Alice Wanderer',
      isPremium: true,
    },
  });

  const bob = await prisma.user.upsert({
    where: { email: 'bob@example.com' },
    update: {},
    create: {
      authId: 'auth0|seed_bob',
      email: 'bob@example.com',
      displayName: 'Bob Roadrunner',
      isPremium: false,
    },
  });

  console.log(`  ✓ Users: ${alice.displayName}, ${bob.displayName}`);

  // ── Stops ──────────────────────────────────────────────────────────────────
  // Stops along the classic Route 66 corridor (Chicago → LA)
  // geography column is set via raw query after insert.
  const stopsData: Array<{
    name: string;
    description: string;
    category: StopCategory;
    lat: number;
    lng: number;
    city: string;
    state: string;
    externalSource: string;
    submittedByUserId: string;
  }> = [
    {
      name: 'Cadillac Ranch',
      description: 'Ten Cadillacs half-buried nose-first in a Texas field. Iconic Route 66 art installation.',
      category: StopCategory.attraction,
      lat: 35.1872,
      lng: -101.9872,
      city: 'Amarillo',
      state: 'TX',
      externalSource: 'manual',
      submittedByUserId: alice.id,
    },
    {
      name: 'Petrified Forest National Park',
      description: 'Ancient logs turned to colorful crystal over 225 million years. Stunning painted desert views.',
      category: StopCategory.park,
      lat: 34.9828,
      lng: -109.7877,
      city: 'Petrified Forest',
      state: 'AZ',
      externalSource: 'manual',
      submittedByUserId: alice.id,
    },
    {
      name: 'Meramec Caverns',
      description: 'Five-story cave system along the Meramec River. Jesse James reportedly hid here.',
      category: StopCategory.attraction,
      lat: 38.2167,
      lng: -91.1043,
      city: 'Stanton',
      state: 'MO',
      externalSource: 'manual',
      submittedByUserId: bob.id,
    },
    {
      name: "Cozy Dog Drive In",
      description: 'The original home of the corn dog on a stick. Route 66 institution since 1949.',
      category: StopCategory.restaurant,
      lat: 39.7859,
      lng: -89.6614,
      city: 'Springfield',
      state: 'IL',
      externalSource: 'manual',
      submittedByUserId: bob.id,
    },
    {
      name: 'Blue Hole',
      description: 'Stunning 80-foot wide circular pool fed by a natural spring. Crystal clear turquoise water.',
      category: StopCategory.viewpoint,
      lat: 34.8706,
      lng: -104.6078,
      city: 'Santa Rosa',
      state: 'NM',
      externalSource: 'manual',
      submittedByUserId: alice.id,
    },
  ];

  const createdStops = [];
  for (const stopData of stopsData) {
    const stop = await prisma.stop.create({ data: stopData });
    // Set the PostGIS geography column via raw query
    await prisma.$executeRaw`
      UPDATE stops
      SET location = ST_SetSRID(ST_Point(${stopData.lng}, ${stopData.lat}), 4326)::geography
      WHERE id = ${stop.id}
    `;
    createdStops.push(stop);
  }

  console.log(`  ✓ Stops: ${createdStops.length} seeded`);

  // ── Votes ──────────────────────────────────────────────────────────────────
  const voteData = [
    { userId: alice.id, stopId: createdStops[0]!.id, value: 1 },   // alice upvotes Cadillac Ranch
    { userId: bob.id,   stopId: createdStops[0]!.id, value: 1 },   // bob upvotes Cadillac Ranch
    { userId: alice.id, stopId: createdStops[2]!.id, value: 1 },   // alice upvotes Meramec Caverns
    { userId: bob.id,   stopId: createdStops[1]!.id, value: 1 },   // bob upvotes Petrified Forest
    { userId: alice.id, stopId: createdStops[3]!.id, value: -1 },  // alice downvotes Cozy Dog
  ];

  for (const vote of voteData) {
    await prisma.vote.upsert({
      where: { userId_stopId: { userId: vote.userId, stopId: vote.stopId } },
      update: { value: vote.value },
      create: vote,
    });
  }

  // Update denormalized score + voteCount for each stop
  for (const stop of createdStops) {
    const agg = await prisma.vote.aggregate({
      where: { stopId: stop.id },
      _sum: { value: true },
      _count: { value: true },
    });
    await prisma.stop.update({
      where: { id: stop.id },
      data: {
        score: agg._sum.value ?? 0,
        voteCount: agg._count.value,
      },
    });
  }

  console.log(`  ✓ Votes: ${voteData.length} cast, scores updated`);

  // ── Trip ───────────────────────────────────────────────────────────────────
  const trip = await prisma.trip.create({
    data: {
      userId: alice.id,
      title: 'Route 66 Classic',
      status: TripStatus.planned,
      vibes: [TripVibe.historic, TripVibe.scenic, TripVibe.foodie],
      originLabel: 'Chicago, IL',
      originLat: 41.8781,
      originLng: -87.6298,
      destLabel: 'Santa Monica, CA',
      destLat: 34.0195,
      destLng: -118.4912,
      startDate: new Date('2025-06-15'),
      endDate: new Date('2025-06-29'),
      tripStops: {
        create: createdStops.slice(0, 3).map((stop, i) => ({
          stopId: stop.id,
          order: i + 1,
        })),
      },
    },
  });

  // Set PostGIS geography columns on the trip
  await prisma.$executeRaw`
    UPDATE trips SET
      "originPoint" = ST_SetSRID(ST_Point(-87.6298, 41.8781), 4326)::geography,
      "destPoint"   = ST_SetSRID(ST_Point(-118.4912, 34.0195), 4326)::geography
    WHERE id = ${trip.id}
  `;

  console.log(`  ✓ Trip: "${trip.title}" with ${3} stops`);
  console.log('✅ Seed complete.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
