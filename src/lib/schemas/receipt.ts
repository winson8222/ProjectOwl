import { z } from "zod";

/**
 * Menu item schema — mirrors the Python notebook's receipt_schema["properties"]["menu"]
 *
 * Field names (nm, cnt, price) match Gemini's expected output keys.
 * cnt is optional (defaults to 1 in the prompt, but LLM may omit it).
 */
export const MenuItemSchema = z.object({
  nm: z.string().min(1, "Item name is required"),
  cnt: z.number().int().positive("Count must be a positive integer").optional(),
  price: z.number().nonnegative("Price must be non-negative"),
});

export type MenuItem = z.infer<typeof MenuItemSchema>;

/**
 * Full receipt extraction result schema.
 *
 * Matches the notebook's receipt_schema shape:
 * - menu and total_price are required (per the Python schema)
 * - subtotal/tax/service/discount are optional
 *
 * NOTE: No math-level refine check here. The LLM transcribes what's printed
 * on the receipt. Real-world receipts often have totals that don't exactly
 * equal subtotal + tax + service - discount (bundled discounts, rounding,
 * service charge conventions). Math validation belongs in the application
 * logic layer, not the extraction layer.
 */
export const ReceiptExtractionResultSchema = z.object({
  menu: z.array(MenuItemSchema).min(1, "Menu must have at least one item"),
  subtotal_price: z.number().nonnegative().optional(),
  tax_price: z.number().nonnegative().optional(),
  service_price: z.number().nonnegative().optional(),
  discount_price: z.number().nonnegative().optional(),
  total_price: z.number().nonnegative(),
});

export type ReceiptExtractionResult = z.infer<
  typeof ReceiptExtractionResultSchema
>;

/**
 * API response types returned by POST /api/receipts/extract
 */
export type ExtractApiResponse =
  | { success: true; data: ReceiptExtractionResult }
  | { success: false; error: string; code: string };

/**
 * Frontend state machine for the scan flow
 */
export type ExtractState = {
  status: "idle" | "uploading" | "success" | "error";
  result: ReceiptExtractionResult | null;
  error: string | null;
};
