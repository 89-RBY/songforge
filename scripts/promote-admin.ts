// Grants or removes the admin role. The user must have signed in at least once.
// Usage: npm run admin:promote -- utente@esempio.it            (grant)
//        npm run admin:promote -- --revoke utente@esempio.it   (remove)
import { getDb } from "../src/server/db";

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const revoke = args.includes("--revoke");
  const email = args.find((arg) => !arg.startsWith("--"))?.trim().toLowerCase();
  if (!email) {
    console.error("Uso: npm run admin:promote -- [--revoke] utente@esempio.it");
    process.exitCode = 1;
    return;
  }

  const db = getDb();
  try {
    const user = await db.user.findUnique({ where: { email }, select: { id: true, role: true } });
    if (!user) {
      console.error(`Nessun utente con email ${email}: deve prima accedere a SongForge.`);
      process.exitCode = 1;
      return;
    }
    const role = revoke ? "USER" : "ADMIN";
    await db.$transaction([
      db.user.update({ where: { id: user.id }, data: { role } }),
      db.auditLog.create({
        data: { actorId: null, action: revoke ? "ADMIN_REVOKED" : "ADMIN_GRANTED", targetId: user.id, detail: { via: "script" } },
      }),
    ]);
    console.log(revoke ? `${email} non è più amministratore.` : `${email} è ora amministratore.`);
  } finally {
    await db.$disconnect();
  }
}

main().catch((error) => {
  console.error("Operazione non riuscita:", error);
  process.exitCode = 1;
});
