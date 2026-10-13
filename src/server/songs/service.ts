import { randomBytes } from "node:crypto";
import { z } from "zod";
import type { PrismaClient } from "@/generated/prisma/client";
import { MOOD_HUE, type MoodId } from "@/features/wizard/catalog";
import { InsufficientCreditsError, postCredits } from "@/server/credits/ledger";
import { getPricing } from "@/server/pricing/settings";
import { creditsFor } from "@/features/wizard/costs";
import { findProvider } from "@/server/music/registry";
import type { MusicProvider } from "@/server/music/types";
import { checkPrompt } from "@/server/moderation/prompt";
import type { AudioStorage } from "@/server/storage/types";
import { applyVariation, VARIATIONS } from "./variations";

export const MAX_ACTIVE_SONGS_PER_USER = 2;

export const createSongInput = z.object({
  title: z
    .string()
    .trim()
    .max(80)
    .optional()
    .transform((value) => value || undefined),
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
  mood: z.string().max(20).optional(),
  energy: z.number().int().min(1).max(10).optional(),
  genre: z.string().max(40).optional(),
});

export type CreateSongInput = z.infer<typeof createSongInput>;

export type SongServiceErrorCode =
  | "INVALID_PROVIDER"
  | "TOO_MANY_ACTIVE"
  | "MODERATION_BLOCKED"
  | "INSUFFICIENT_CREDITS"
  | "NOT_FOUND"
  | "INVALID_STATE";

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

export function coverHueFor(mood: string | undefined): number | null {
  return mood && Object.prototype.hasOwnProperty.call(MOOD_HUE, mood) ? MOOD_HUE[mood as MoodId] : null;
}

export type SongDeps = { db: PrismaClient; providers: MusicProvider[] };

type EnqueueInput = Omit<CreateSongInput, "instrumental"> & { instrumental: boolean; variationOf?: string };

async function enqueueSong(deps: SongDeps, userId: string, input: EnqueueInput) {
  const provider = findProvider(deps.providers, input.providerId);
  if (!provider) {
    throw new SongServiceError("INVALID_PROVIDER", "Il modello scelto non è disponibile");
  }
  if (!provider.capabilities.durations.includes(input.durationMode)) {
    throw new SongServiceError("INVALID_PROVIDER", "Questo modello non supporta la durata scelta");
  }
  const pricing = await getPricing(deps.db);
  if (pricing.disabledProviders.includes(provider.id)) {
    throw new SongServiceError("INVALID_PROVIDER", "Il modello scelto non è disponibile");
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

    const apiCostCents = provider.estimateCostCents(input.durationMode);
    const creditCost = creditsFor(apiCostCents, pricing);

    const song = await tx.song.create({
      data: {
        userId,
        title: input.title || deriveTitle(input.prompt),
        providerId: provider.id,
        durationMode: input.durationMode,
        instrumental: input.instrumental,
        prompt: input.prompt,
        lyrics: input.lyrics,
        mood: input.mood,
        energy: input.energy,
        genre: input.genre,
        coverHue: coverHueFor(input.mood),
        variationOf: input.variationOf,
        apiCostCents,
        creditCost,
      },
    });

    // Charged in the same transaction as the song: if the balance is short, neither the song nor the job exists.
    if (creditCost > 0) {
      try {
        await postCredits(tx, {
          userId,
          amount: -creditCost,
          reason: "GENERATION",
          songId: song.id,
          referenceKey: `generation:${song.id}`,
          note: `${provider.id} ${input.durationMode}`,
        });
      } catch (error) {
        if (error instanceof InsufficientCreditsError) {
          throw new SongServiceError("INSUFFICIENT_CREDITS", "Crediti insufficienti per questa canzone");
        }
        throw error;
      }
    }

    await tx.job.create({ data: { kind: "generate_song", songId: song.id, maxAttempts: 3 } });
    return song;
  });
}

export async function createSong(deps: SongDeps, userId: string, rawInput: unknown) {
  return enqueueSong(deps, userId, createSongInput.parse(rawInput));
}

const variationInput = z.object({ variation: z.enum(VARIATIONS) });

// A new generation based on an existing song, with one change: more energy, another voice, or new lyrics.
export async function createVariation(deps: SongDeps, userId: string, songId: string, rawInput: unknown) {
  const { variation } = variationInput.parse(rawInput);
  const source = await deps.db.song.findFirst({ where: { id: songId, userId } });
  if (!source) throw new SongServiceError("NOT_FOUND", "Canzone non trovata");
  if (source.status !== "READY" && source.status !== "FAILED") {
    throw new SongServiceError("INVALID_STATE", "La canzone è ancora in lavorazione");
  }

  const applied = applyVariation({ prompt: source.prompt, lyrics: source.lyrics, variation });
  return enqueueSong(deps, userId, {
    title: `${source.title} (variante)`.slice(0, 80),
    prompt: applied.prompt,
    lyrics: applied.lyrics ?? undefined,
    instrumental: source.instrumental,
    durationMode: source.durationMode,
    providerId: source.providerId,
    mood: source.mood ?? undefined,
    energy: source.energy ?? undefined,
    genre: source.genre ?? undefined,
    variationOf: source.id,
  });
}

// Owner-only lookup: a song that belongs to someone else looks the same as a missing one.
export async function getSongForUser(db: PrismaClient, userId: string, songId: string) {
  return db.song.findFirst({ where: { id: songId, userId } });
}

export const songPatchInput = z
  .object({
    title: z.string().trim().min(1).max(80).optional(),
    favorite: z.boolean().optional(),
  })
  .refine((value) => value.title !== undefined || value.favorite !== undefined, "Nessun campo da aggiornare");

export async function updateSong(db: PrismaClient, userId: string, songId: string, rawInput: unknown) {
  const patch = songPatchInput.parse(rawInput);
  const existing = await getSongForUser(db, userId, songId);
  if (!existing) throw new SongServiceError("NOT_FOUND", "Canzone non trovata");
  return db.song.update({ where: { id: songId }, data: patch });
}

export async function deleteSong(db: PrismaClient, storage: AudioStorage, userId: string, songId: string) {
  const song = await getSongForUser(db, userId, songId);
  if (!song) throw new SongServiceError("NOT_FOUND", "Canzone non trovata");
  if (song.status === "QUEUED" || song.status === "GENERATING") {
    throw new SongServiceError("INVALID_STATE", "Attendi la fine della generazione prima di eliminare la canzone");
  }
  // Audio first: if storage fails the row stays, so the user can retry and nothing is orphaned.
  if (song.audioKey) await storage.delete(song.audioKey);
  await db.song.delete({ where: { id: song.id } });
}

// Enables or disables the public link. Returns the token when enabled, null when disabled.
export async function setSharing(db: PrismaClient, userId: string, songId: string, enabled: boolean): Promise<string | null> {
  const song = await getSongForUser(db, userId, songId);
  if (!song) throw new SongServiceError("NOT_FOUND", "Canzone non trovata");

  if (!enabled) {
    await db.song.update({ where: { id: song.id }, data: { shareToken: null, sharedAt: null } });
    return null;
  }
  if (song.status !== "READY" || song.audioPurgedAt) {
    throw new SongServiceError("INVALID_STATE", "Solo le canzoni pronte e con audio disponibile si possono condividere");
  }
  if (song.shareToken) return song.shareToken;

  const token = randomBytes(24).toString("base64url");
  await db.song.update({ where: { id: song.id }, data: { shareToken: token, sharedAt: new Date() } });
  return token;
}

const TOKEN_PATTERN = /^[A-Za-z0-9_-]{32}$/;

// Public view of a shared song: only what the share page shows. Prompt and lyrics stay private.
export async function getSharedSong(db: PrismaClient, token: string) {
  if (!TOKEN_PATTERN.test(token)) return null;
  return db.song.findFirst({
    where: { shareToken: token, status: "READY" },
    select: {
      id: true,
      title: true,
      mood: true,
      energy: true,
      genre: true,
      coverHue: true,
      audioKey: true,
      mimeType: true,
      durationSeconds: true,
      audioPurgedAt: true,
    },
  });
}
