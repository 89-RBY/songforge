export default function CheckEmailPage() {
  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-4 px-4 py-16 text-center">
      <h1 className="text-3xl font-bold tracking-tight">Controlla la tua email</h1>
      <p className="text-zinc-400">
        Ti abbiamo inviato un link di accesso. Vale per 24 ore e funziona una sola volta.
      </p>
      <p className="text-sm text-zinc-500">Non lo trovi? Controlla la cartella spam.</p>
    </main>
  );
}
