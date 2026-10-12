import { Suspense } from "react";
import { signOut } from "@/auth";
import { requireUser } from "@/server/auth/dal";

async function signOutAction() {
  "use server";
  await signOut({ redirectTo: "/" });
}

async function DashboardContent() {
  const user = await requireUser();

  return (
    <>
      <div className="space-y-1">
        <p className="text-sm text-zinc-400">Benvenuto</p>
        <h1 className="break-all text-2xl font-bold tracking-tight sm:text-3xl">{user.name ?? user.email}</h1>
      </div>
      <p className="text-zinc-400">Il wizard e la libreria arrivano nelle prossime fasi.</p>
      <form action={signOutAction}>
        <button type="submit" className="rounded-lg border border-zinc-700 px-4 py-2 text-sm hover:bg-zinc-900">
          Esci
        </button>
      </form>
    </>
  );
}

export default function DashboardPage() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-16">
      <Suspense fallback={<p className="text-zinc-400">Caricamento…</p>}>
        <DashboardContent />
      </Suspense>
    </main>
  );
}
