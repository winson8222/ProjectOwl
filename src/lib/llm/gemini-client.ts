import type { LLMClient, ReceiptExtractionInput } from "./types";
import {
  ReceiptExtractionResultSchema,
  type ReceiptExtractionResult,
} from "@/lib/schemas/receipt";
import { withRetry } from "@/lib/retry";
import { LLMError, ValidationError } from "@/lib/errors";
import { z } from "zod";

/**
 * Prompt copied from the Python notebook's RECEIPT_PROMPT.
 *
 * Design philosophy: transcription-only — no calculation, no inference of
 * values not printed on the receipt. Business logic stays in the backend.
 */
const RECEIPT_PROMPT = `
You are transcribing a photo of a receipt. Extract exactly what is printed - do not
calculate, infer, or estimate any value that is not directly shown on the receipt.

Rules:
- nm = item name, exactly as printed (keep original language, do not translate).
- cnt = quantity. If not explicit, use 1.
- price = the line's total price as printed (not unit price, not your own calculation).
- subtotal_price, tax_price, service_price, discount_price, total_price are separate
  fields - do not fold them into item prices.
- If a field is not present on the receipt, omit it or return 0 - do not estimate or
  back-calculate a value that isn't printed.
- Do not invent items or amounts that aren't visibly on the receipt.
`;

/**
 * JSON Schema for Gemini's structured output (response_schema).
 *
 * Mirrors the notebook's receipt_schema exactly.
 * Men items: nm (string), cnt (integer, optional), price (number).
 * Totals: subtotal_price, tax_price, service_price, discount_price, total_price.
 */
const RECEIPT_RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    menu: {
      type: "array",
      items: {
        type: "object",
        properties: {
          nm: { type: "string" },
          cnt: { type: "integer" },
          price: { type: "number" },
        },
        required: ["nm", "price"],
      },
    },
    subtotal_price: { type: "number" },
    tax_price: { type: "number" },
    service_price: { type: "number" },
    discount_price: { type: "number" },
    total_price: { type: "number" },
  },
  required: ["menu", "total_price"],
} as const;

/**
 * Gemini implementation of LLMClient.
 *
 * Uses raw REST API (not the @google/genai SDK) for full control over
 * response_schema and structured output parsing. The SDK's TypeScript types
 * may not fully support responseSchema yet.
 *
 * Endpoint: gemini-2.0-flash (fast, cheap) — can switch to gemini-2.5-flash
 * for higher accuracy by passing a different model name to the constructor.
 */
export class GeminiClient implements LLMClient {
  private apiKey: string;
  private model: string;

  constructor(apiKey: string, model = "gemini-2.5-flash") {
    this.apiKey = apiKey;
    this.model = model;
  }

  async extractReceipt(
    input: ReceiptExtractionInput
  ): Promise<ReceiptExtractionResult> {
    const base64Image = input.imageBuffer.toString("base64");

    const body = {
      contents: [
        {
          parts: [
            { text: RECEIPT_PROMPT },
            {
              inlineData: {
                mimeType: input.mimeType,
                data: base64Image,
              },
            },
          ],
        },
      ],
      generationConfig: {
        temperature: 0.1,
        responseMimeType: "application/json",
        responseSchema: RECEIPT_RESPONSE_SCHEMA,
      },
    };

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${this.apiKey}`;

    const raw = await withRetry(async () => {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const errorText = await res.text().catch(() => "unknown");
        const isRetryable =
          res.status === 429 ||
          res.status === 503 ||
          errorText.includes("RESOURCE_EXHAUSTED") ||
          errorText.includes("UNAVAILABLE");

        throw new LLMError(
          `Gemini API returned ${res.status}: ${errorText.slice(0, 300)}`,
          isRetryable
        );
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const json: any = await res.json();

      // Extract the text content from Gemini's response structure
      const text =
        json?.candidates?.[0]?.content?.parts?.[0]?.text ?? null;

      if (!text) {
        // Check for blocked content (safety filters)
        const blockReason =
          json?.candidates?.[0]?.finishReason ??
          json?.promptFeedback?.blockReason ??
          "unknown";
        throw new LLMError(
          `Gemini returned no text content (finishReason: ${blockReason})`,
          false
        );
      }

      return text;
    }, { maxRetries: 3, baseDelayMs: 1000 });

    return this.parseResponse(raw);
  }

  /**
   * Parse and validate the LLM's JSON response.
   * Separated so the retry wrapper only wraps the network call,
   * not the parse/validate step.
   */
  private parseResponse(raw: string): ReceiptExtractionResult {
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new LLMError(
        `Gemini response was not valid JSON: ${raw.slice(0, 200)}`,
        false
      );
    }

    // Validate against our Zod schema
    try {
      return ReceiptExtractionResultSchema.parse(parsed);
    } catch (err) {
      if (err instanceof z.ZodError) {
        throw new ValidationError(
          `Receipt extraction failed schema validation: ${err.message}`
        );
      }
      throw new ValidationError("Receipt extraction returned unexpected data");
    }
  }
}
