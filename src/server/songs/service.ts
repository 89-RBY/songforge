import { z } from "zod";
import type { PrismaClient } from "@/generated/prisma/client";
import { findProvider } from "@/server/music/registry";
import type { MusicProvider } from "@/server/music/types";
import { checkPrompt } from "@/server/moderation/prompt";

export const MAX_ACTIVE_SONGS_PER_USER = 2;

export const createSongInput = z.object({
  title: z.string().trim().max(80).optional(),
  prompt: z.string().trim().min(10, "Descrivi la canzone in almeno 10 caratteri").max(2000),
  lyrics: z
    .string()
    .trim()
    .max(4000)
    .optional()
    .transform((value) => value || undefined),
  instrumental: z.boolean().default(false),
  durationMode: z.enum(["CLIP", "SONG"]),
  providerId: z.string().min(1),
});

export type CreateSongInput = z.infer<typeof createSongInput>;

export type SongServiceErrorCode = "INVALID_PROVIDER" | "TOO_MANY_ACTIVE" | "MODERATION_BLOCKED";

export class SongServiceError extends Error {
  readonly code: SongServiceErrorCode;

  constructor(code: SongServiceErrorCode, message: string) {
    super(message);
    this.name = "SongServiceError";
    this.code = code;
  }
}

export function deriveTitle(prompt: string): string {
  const firstLine = prompt.split("\n")[0]?.trim() ?? "";
  if (!firstLine) return "Senza titolo";
  return firstLine.length > 60 ? `${firstLine.slice(0, 57)}...` : firstLine;
}

export type SongDeps = { db: PrismaClient; providers: MusicProvider[] };

export async function createSong(deps: SongDeps, userId: string, rawInput: unknown) {
  const input: CreateSongInput = createSongInput.parse(rawInput);

  const provider = findProvider(deps.providers, input.providerId);
  if (!provider) {
    throw new SongServiceError("INVALID_PROVIDER", "Il modello scelto non è disponibile");
  }
  if (!provider.capabilities.durations.includes(input.durationMode)) {
    throw new SongServiceError("INVALID_PROVIDER", "Questo modello non supporta la durata scelta");
  }

  const moderation = checkPrompt(`${input.prompt}\n${input.lyrics ?? ""}`);
  if (!moderation.allowed) {
    throw new SongServiceError(
      "MODERATION_BLOCKED",
      "La richiesta nomina un artista reale. Descrivi lo stile senza citare persone specifiche.",
    );
  }

  return deps.db.$transaction(async (tx) => {
    // Serializes requests from the same user, so two parallel requests cannot both pass the limit check.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${userId}))`;

    const active = await tx.song.count({
      where: { userId, status: { in: ["QUEUED", "GENERATING"] } },
    });
    if (active >= MAX_ACTIVE_SONGS_PER_USER) {
      throw new SongServiceError(
        "TOO_MANY_ACTIVE",
        `Hai già ${MAX_ACTIVE_SONGS_PER_USER} canzoni in lavorazione. Attendi che finiscano.`,
      );
    }

    const song = await tx.song.create({
      data: {
        userId,
        title: input.title || deriveTitle(input.prompt),
        providerId: provider.id,
        durationMode: input.durationMode,
        instrumental: input.instrumental,
        prompt: input.prompt,
        lyrics: input.lyrics,
      },
    });
    await tx.job.create({ data: { kind: "generate_song", songId: song.id, maxAttempts: 3 } });
    return song;
  });
}

// Owner-only lookup: a song that belongs to someone else looks the same as a missing one.
export async function getSongForUser(db: PrismaClient, userId: string, songId: string) {
  return db.song.findFirst({ where: { id: songId, userId } });
}
