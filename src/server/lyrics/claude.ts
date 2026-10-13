import Anthropic from "@anthropic-ai/sdk";
import { buildLyricsUserMessage, LYRICS_SYSTEM_PROMPT } from "./prompt";
import { LyricsError, type LyricsProvider, type LyricsRequest } from "./types";

export type ClaudeLyricsOptions = {
  apiKey: string;
  model: string;
  client?: Pick<Anthropic, "messages">;
};

// Lyrics are short, so the output cap is small; this is a deliberate limit, not a default.
const MAX_OUTPUT_TOKENS = 2000;

export class ClaudeLyricsProvider implements LyricsProvider {
  readonly id = "claude";
  private readonly client: Pick<Anthropic, "messages">;

  constructor(private readonly options: ClaudeLyricsOptions) {
    this.client = options.client ?? new Anthropic({ apiKey: options.apiKey });
  }

  async generate(request: LyricsRequest): Promise<string> {
    let response: Anthropic.Message;
    try {
      response = await this.client.messages.create({
        model: this.options.model,
        max_tokens: MAX_OUTPUT_TOKENS,
        system: LYRICS_SYSTEM_PROMPT,
        output_config: { effort: "medium" },
        messages: [{ role: "user", content: buildLyricsUserMessage(request) }],
      });
    } catch (error) {
      if (error instanceof Anthropic.APIError) {
        throw new LyricsError("UPSTREAM", `Claude ha risposto con errore ${error.status ?? "sconosciuto"}`);
      }
      throw new LyricsError("UPSTREAM", "Connessione a Claude non riuscita");
    }

    if (response.stop_reason === "refusal") {
      throw new LyricsError("UPSTREAM", "Richiesta rifiutata dal modello");
    }

    const text = response.content
      .filter((block): block is Anthropic.TextBlock => block.type === "text")
      .map((block) => block.text)
      .join("\n")
      .trim();
    if (!text) throw new LyricsError("EMPTY", "Nessun testo nella risposta di Claude");
    return text;
  }
}
