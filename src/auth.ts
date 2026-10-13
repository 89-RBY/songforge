import { PrismaAdapter } from "@auth/prisma-adapter";
import NextAuth, { type NextAuthConfig } from "next-auth";
import Google from "next-auth/providers/google";
import Nodemailer from "next-auth/providers/nodemailer";
import { getEnv } from "@/server/config/env";
import { getDb } from "@/server/db";
import { grantSignupBonus } from "@/server/credits/ledger";
import { sendMagicLink } from "@/server/email/send";

const MAGIC_LINK_MAX_AGE_SECONDS = 24 * 60 * 60;
const SESSION_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;

// Config is built per request from validated env, so importing this module never reads secrets.
export const { handlers, auth, signIn, signOut } = NextAuth(() => {
  const env = getEnv();

  const providers: NonNullable<NextAuthConfig["providers"]> = [
    Nodemailer({
      // Auth.js requires a transport even when sendVerificationRequest does the sending.
      // With no SMTP_URL (console mode) the JSON transport never delivers anything.
      server: env.SMTP_URL ?? { jsonTransport: true },
      from: env.EMAIL_FROM,
      maxAge: MAGIC_LINK_MAX_AGE_SECONDS,
      sendVerificationRequest: async ({ identifier, url }) => {
        await sendMagicLink({ to: identifier, url });
      },
    }),
  ];

  if (env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET) {
    providers.push(
      Google({ clientId: env.GOOGLE_CLIENT_ID, clientSecret: env.GOOGLE_CLIENT_SECRET }),
    );
  }

  return {
    adapter: PrismaAdapter(getDb()),
    secret: env.AUTH_SECRET,
    providers,
    // Database sessions: revoking a session or blocking a user takes effect on the next request.
    session: { strategy: "database", maxAge: SESSION_MAX_AGE_SECONDS },
    events: {
      // Runs once, when the adapter creates the account on the first magic-link sign-in.
      async createUser({ user }) {
        if (user.id) await grantSignupBonus(getDb(), user.id);
      },
    },
    pages: {
      signIn: "/login",
      verifyRequest: "/login/check-email",
      error: "/login",
    },
    callbacks: {
      async signIn({ user }) {
        if (!user.email) return true;
        const existing = await getDb().user.findUnique({
          where: { email: user.email },
          select: { blocked: true },
        });
        return existing?.blocked ? "/login?error=blocked" : true;
      },
      async session({ session, user }) {
        session.user.id = user.id;
        session.user.role = user.role;
        return session;
      },
    },
  };
});
