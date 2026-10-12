import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SongForge",
  description: "Crea canzoni complete con l'intelligenza artificiale, senza competenze musicali.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="it" className="h-full antialiased">
      <body className="flex min-h-full flex-col bg-zinc-950 font-sans text-zinc-50">{children}</body>
    </html>
  );
}
