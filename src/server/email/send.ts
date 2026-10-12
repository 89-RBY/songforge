import nodemailer, { type Transporter } from "nodemailer";
import { getEnv } from "@/server/config/env";

export type MagicLinkMessage = { to: string; url: string };

export function renderMagicLinkEmail(url: string): { subject: string; text: string; html: string } {
  const safeUrl = escapeHtml(url);
  return {
    subject: "Il tuo link di accesso a SongForge",
    text: [
      "Ciao,",
      "",
      "usa il link qui sotto per accedere a SongForge. Il link scade tra 24 ore e funziona una sola volta.",
      "",
      url,
      "",
      "Se non sei stato tu a richiederlo, puoi ignorare questa email.",
    ].join("\n"),
    html: [
      "<p>Ciao,</p>",
      "<p>usa il link qui sotto per accedere a SongForge. Il link scade tra 24 ore e funziona una sola volta.</p>",
      `<p><a href="${safeUrl}">Accedi a SongForge</a></p>`,
      "<p>Se non sei stato tu a richiederlo, puoi ignorare questa email.</p>",
    ].join(""),
  };
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

let smtpTransport: Transporter | undefined;

export async function sendMagicLink({ to, url }: MagicLinkMessage): Promise<void> {
  const env = getEnv();

  if (env.EMAIL_TRANSPORT === "console") {
    // Development only: the link goes to the server log instead of an email.
    console.info(`[email] Link di accesso per ${to}: ${url}`);
    return;
  }

  if (!env.SMTP_URL) {
    throw new Error("SMTP_URL non configurato");
  }
  smtpTransport ??= nodemailer.createTransport(env.SMTP_URL);
  await smtpTransport.sendMail({ from: env.EMAIL_FROM, to, ...renderMagicLinkEmail(url) });
}
