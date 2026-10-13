import "server-only";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { auth } from "@/auth";
import { getDb } from "@/server/db";

export type CurrentUser = {
  id: string;
  email: string;
  name: string | null;
  role: "USER" | "ADMIN";
  creditBalance: number;
};

// Authorization is checked against the database on every call: role and blocked status
// are never trusted from the cookie alone.
export async function getCurrentUser(): Promise<CurrentUser | null> {
  // The session is per request: opt out of prerendering so the shell never caches an auth read.
  await connection();
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return null;

  const user = await getDb().user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, name: true, role: true, blocked: true, creditBalance: true },
  });
  if (!user || user.blocked) return null;

  return { id: user.id, email: user.email, name: user.name, role: user.role, creditBalance: user.creditBalance };
}

export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}
