import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { PrismaClient } from "@/generated/prisma/client";

const testUrl = process.env.TEST_DATABASE_URL;

// Guard: this suite deletes rows. Refuse to run unless it points at a dedicated test database.
const safeToRun =
  Boolean(testUrl) && testUrl !== process.env.DATABASE_URL && /test/i.test(testUrl ?? "");

describe.skipIf(!safeToRun)("database schema (Auth.js tables)", () => {
  let db: PrismaClient;

  beforeAll(() => {
    db = new PrismaClient({ adapter: new PrismaPg({ connectionString: testUrl! }) });
  });

  beforeEach(async () => {
    await db.user.deleteMany();
    await db.verificationToken.deleteMany();
  });

  afterAll(async () => {
    await db.$disconnect();
  });

  it("gives new users the USER role and an unblocked status", async () => {
    const user = await db.user.create({ data: { email: "nuovo@esempio.it" } });
    expect(user.role).toBe("USER");
    expect(user.blocked).toBe(false);
  });

  it("rejects a second user with the same email", async () => {
    await db.user.create({ data: { email: "unico@esempio.it" } });
    await expect(db.user.create({ data: { email: "unico@esempio.it" } })).rejects.toThrow();
  });

  it("deletes sessions and linked accounts together with the user", async () => {
    const user = await db.user.create({
      data: {
        email: "cascata@esempio.it",
        sessions: { create: { sessionToken: "tok-cascade", expires: new Date(Date.now() + 60_000) } },
        accounts: {
          create: { type: "oauth", provider: "google", providerAccountId: "g-1" },
        },
      },
    });

    await db.user.delete({ where: { id: user.id } });

    expect(await db.session.count({ where: { sessionToken: "tok-cascade" } })).toBe(0);
    expect(await db.account.count({ where: { userId: user.id } })).toBe(0);
  });

  it("allows one provider account per provider id", async () => {
    const user = await db.user.create({ data: { email: "account@esempio.it" } });
    const account = { type: "oauth", provider: "google", providerAccountId: "g-dup" };
    await db.account.create({ data: { ...account, userId: user.id } });
    await expect(db.account.create({ data: { ...account, userId: user.id } })).rejects.toThrow();
  });

  it("stores verification tokens and rejects duplicates for the same identifier", async () => {
    const expires = new Date(Date.now() + 60_000);
    await db.verificationToken.create({ data: { identifier: "a@b.it", token: "t-1", expires } });
    await expect(
      db.verificationToken.create({ data: { identifier: "a@b.it", token: "t-1", expires } }),
    ).rejects.toThrow();
  });
});
