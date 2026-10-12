import { connection, NextResponse } from "next/server";
import { getMusicProviders } from "@/server/music/registry";

// Lists only the configured providers, with what they support. Contains no credentials.
export async function GET() {
  // Reads runtime configuration: opt out of prerendering so the build does not need secrets.
  await connection();

  const providers = getMusicProviders().map((provider) => ({
    id: provider.id,
    label: provider.label,
    durations: provider.capabilities.durations,
    imageInput: provider.capabilities.imageInput,
    costCents: {
      CLIP: provider.estimateCostCents("CLIP"),
      SONG: provider.estimateCostCents("SONG"),
    },
  }));
  return NextResponse.json({ providers });
}
