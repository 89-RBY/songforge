import { Suspense } from "react";
import { redirect } from "next/navigation";
import { z } from "zod";
import { signIn } from "@/auth";
import { getEnv } from "@/server/config/env";

const emailSchema = z.email();

const ERROR_MESSAGES: Record<string, string> = {
  "invalid-email": "Inserisci un indirizzo email valido.",
  blocked: "Questo account è sospeso. Contatta il supporto.",
  Verification: "Il link non è valido o è scaduto. Richiedine uno nuovo.",
  OAuthSignin: "Accesso con Google non riuscito. Riprova.",
  OAuthCallback: "Accesso con Google non riuscito. Riprova.",
  OAuthAccountNotLinked: "Questa email è già usata con un altro metodo di accesso.",
};
const FALLBACK_ERROR = "Accesso non riuscito. Riprova.";

// Auth.js answers with its own verify-request route. Send the browser to our page instead,
// and keep only the path so the redirect cannot leave the app.
function pathForAuthResponse(authUrl: string | undefined): string {
  if (!authUrl) return "/login?error=signin";
  const url = new URL(authUrl, getEnv().APP_URL);
  if (url.pathname === "/api/auth/verify-request") return "/login/check-email";
  return `${url.pathname}${url.search}`;
}

async function requestMagicLink(formData: FormData) {
  "use server";
  const parsed = emailSchema.safeParse(String(formData.get("email") ?? "").trim().toLowerCase());
  if (!parsed.success) {
    redirect("/login?error=invalid-email");
  }
  const authUrl = await signIn("nodemailer", {
    email: parsed.data,
    redirectTo: "/dashboard",
    redirect: false,
  });
  redirect(pathForAuthResponse(authUrl));
}

async function signInWithGoogle() {
  "use server";
  await signIn("google", { redirectTo: "/dashboard" });
}

async function LoginContent({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  const googleEnabled = Boolean(getEnv().GOOGLE_CLIENT_ID);
  const errorMessage = error ? (ERROR_MESSAGES[error] ?? FALLBACK_ERROR) : null;

  return (
    <>
      <div className="space-y-2 text-center">
        <h1 className="text-3xl font-bold tracking-tight">Accedi a SongForge</h1>
        <p className="text-zinc-400">Ti mandiamo un link di accesso via email. Nessuna password.</p>
      </div>

      {errorMessage && (
        <p role="alert" className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {errorMessage}
        </p>
      )}

      <form action={requestMagicLink} className="space-y-3">
        <label htmlFor="email" className="block text-sm font-medium text-zinc-300">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          placeholder="tu@esempio.it"
          className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-3 text-zinc-50 placeholder:text-zinc-500 focus:border-violet-400 focus:outline-none"
        />
        <button
          type="submit"
          className="w-full rounded-lg bg-violet-500 px-4 py-3 font-medium text-white hover:bg-violet-400"
        >
          Invia link di accesso
        </button>
      </form>

      {googleEnabled && (
        <>
          <div className="flex items-center gap-3 text-xs uppercase tracking-wide text-zinc-500">
            <span className="h-px flex-1 bg-zinc-800" />
            oppure
            <span className="h-px flex-1 bg-zinc-800" />
          </div>
          <form action={signInWithGoogle}>
            <button
              type="submit"
              className="w-full rounded-lg border border-zinc-700 px-4 py-3 font-medium hover:bg-zinc-900"
            >
              Continua con Google
            </button>
          </form>
        </>
      )}
    </>
  );
}

export default function LoginPage({ searchParams }: PageProps<"/login">) {
  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-6 px-4 py-16">
      <Suspense fallback={<p className="text-zinc-400">Caricamento…</p>}>
        <LoginContent searchParams={searchParams} />
      </Suspense>
    </main>
  );
}
