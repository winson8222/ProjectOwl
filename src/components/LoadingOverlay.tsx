/**
 * Full-screen loading overlay shown during LLM processing.
 */
export default function LoadingOverlay() {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
      <div className="bg-white rounded-2xl p-8 shadow-xl flex flex-col items-center gap-4 min-w-[240px]">
        {/* Spinner */}
        <div className="w-10 h-10 border-4 border-[var(--border)] border-t-[var(--primary)] rounded-full animate-spin" />
        <p className="text-sm font-medium text-gray-700">
          Analyzing receipt…
        </p>
        <p className="text-xs text-gray-400">
          This may take a few seconds
        </p>
      </div>
    </div>
  );
}
