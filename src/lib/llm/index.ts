import type { LLMClient, LLMProvider } from "./types";
import { GeminiClient } from "./gemini-client";

/**
 * Factory function — creates the appropriate LLM client based on the
 * LLM_PROVIDER environment variable.
 *
 * To add a new provider:
 * 1. Create `lib/llm/<name>-client.ts` implementing LLMClient.
 * 2. Add a `case` below.
 * 3. Done — no other code changes needed.
 */
export function createLLMClient(provider?: LLMProvider): LLMClient {
  const resolved: LLMProvider =
    provider ??
    (process.env.LLM_PROVIDER as LLMProvider | undefined) ??
    "gemini";

  switch (resolved) {
    case "gemini": {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey || apiKey.trim() === "") {
        throw new Error(
          "GEMINI_API_KEY is not set. " +
            "Add it to .env.local or set it as an environment variable."
        );
      }
      return new GeminiClient(apiKey);
    }
    // Future providers:
    // case "openai": return new OpenAIClient(process.env.OPENAI_API_KEY!);
    // case "anthropic": return new AnthropicClient(process.env.ANTHROPIC_API_KEY!);
    default: {
      // When adding a new provider, add a case above and remove from this error
      const provider: string = resolved;
      throw new Error(
        `Unknown or unsupported LLM provider: "${provider}". ` +
          "Supported: gemini. Set LLM_PROVIDER in .env.local"
      );
    }
  }
}

// Re-export for convenience
export { type LLMClient, type LLMProvider, type ReceiptExtractionInput } from "./types";
