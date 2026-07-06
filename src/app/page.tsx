import Link from "next/link";

/**
 * Home page — app overview with a link to the receipt scanner.
 */
export default function HomePage() {
  return (
    <main className="min-h-dvh flex flex-col items-center justify-center px-4 py-12">
      <div className="text-center max-w-sm">
        <div className="text-5xl mb-4">🦉</div>
        <h1 className="text-3xl font-bold text-gray-900 mb-2">ProjectOwl</h1>
        <p className="text-sm text-gray-500 mb-8">
          Split receipts with friends — without the math.
        </p>

        <Link
          href="/scan"
          className="inline-block w-full px-6 py-3 text-sm font-semibold text-white
                     bg-[var(--primary)] rounded-xl hover:bg-[var(--primary-hover)]
                     transition-colors shadow-sm"
        >
          Scan a receipt
        </Link>

        <div className="mt-12 space-y-3 text-xs text-gray-400">
          <p className="text-sm font-medium text-gray-500">
            How it works
          </p>
          <div className="space-y-2">
            <p>1. Take a photo of your receipt</p>
            <p>2. AI extracts every item and price</p>
            <p>3. Split with friends in one tap</p>
          </div>
        </div>

        <p className="mt-12 text-xs text-gray-400">
          Prototype — receipt scanning only
        </p>
      </div>
    </main>
  );
}
