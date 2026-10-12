import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

export const TEST_DB_URL = process.env.TEST_DATABASE_URL;

// Integration suites delete rows. They only run against a dedicated test database.
export const canUseTestDb =
  Boolean(TEST_DB_URL) && TEST_DB_URL !== process.env.DATABASE_URL && /test/i.test(TEST_DB_URL ?? "");

export function createTestDb(): PrismaClient {
  return new PrismaClient({ adapter: new PrismaPg({ connectionString: TEST_DB_URL! }) });
}

export async function resetTables(db: PrismaClient): Promise<void> {
  await db.job.deleteMany();
  await db.song.deleteMany();
  await db.session.deleteMany();
  await db.account.deleteMany();
  await db.verificationToken.deleteMany();
  await db.user.deleteMany();
}
