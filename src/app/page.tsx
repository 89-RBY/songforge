import Link from "next/link";

export default function HomePage() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 px-4 py-16 text-center">
      <h1 className="text-4xl font-bold tracking-tight">SongForge</h1>
      <p className="max-w-md text-lg text-zinc-300">
        Descrivi l&apos;idea, scegli stile e atmosfera, e ascolta la tua canzone.
      </p>
      <Link
        href="/login"
        className="rounded-full bg-violet-500 px-6 py-3 font-medium text-white hover:bg-violet-400"
      >
        Prova gratis
      </Link>
    </main>
  );
}
