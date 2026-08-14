/**
 * Client-side image downscaling for receipt uploads.
 *
 * A modern phone camera produces 3–12 MB JPEGs, and until now those went to
 * /api/receipts/extract at full resolution. That's slow to upload on mobile
 * data, slow to base64 and hand to Gemini, and above ~4.5 MB it fails at the
 * platform's request-body limit before our own handler runs.
 *
 * None of that resolution helps: the model reads a receipt fine at 2000px on
 * the long edge, and the request gets several times smaller.
 *
 * Every failure path returns the original file. A scan that works on a big
 * upload is strictly better than one that fails because we couldn't re-encode
 * it — HEIC in particular, which most browsers can't decode via
 * createImageBitmap even though the API accepts it.
 */

/** Vercel's request body limit for a serverless function. */
export const MAX_UPLOAD_BYTES = 4.5 * 1024 * 1024;

export interface DownscaleOptions {
  /** Longest edge, in px, after scaling. */
  maxDimension?: number;
  /** JPEG quality, 0–1. */
  quality?: number;
}

function toBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
}

/**
 * Re-encode `file` so its longest edge is at most `maxDimension`.
 * Returns the original file unchanged if that isn't possible or isn't a win.
 */
export async function downscaleImage(
  file: File,
  { maxDimension = 2000, quality = 0.85 }: DownscaleOptions = {}
): Promise<File> {
  if (typeof document === "undefined") return file;
  if (!file.type.startsWith("image/")) return file;

  let bitmap: ImageBitmap;
  try {
    // from-image applies the EXIF rotation, which phone photos rely on —
    // without it a portrait receipt lands sideways.
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    return file;
  }

  try {
    const longest = Math.max(bitmap.width, bitmap.height);
    const scale = Math.min(1, maxDimension / longest);

    // Already small enough, and re-encoding a small file usually makes it
    // bigger rather than smaller.
    if (scale === 1 && file.size <= 1_000_000) return file;

    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);

    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

    const blob = await toBlob(canvas, quality);
    if (!blob || blob.size >= file.size) return file;

    return new File([blob], file.name.replace(/\.[^.]+$/, "") + ".jpg", {
      type: "image/jpeg",
      lastModified: file.lastModified,
    });
  } catch {
    return file;
  } finally {
    bitmap.close();
  }
}
