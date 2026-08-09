interface ErrorAlertProps {
  message: string;
  onRetry?: () => void;
}

/**
 * Error display with a retry button.
 */
export default function ErrorAlert({ message, onRetry }: ErrorAlertProps) {
  return (
    <div className="w-full max-w-md mx-auto bg-negative-tint border border-negative-soft rounded-xl p-4">
      <div className="flex items-start gap-3">
        <span className="text-lg shrink-0">⚠️</span>
        <div className="min-w-0">
          <p className="text-sm font-medium text-negative mb-1">Error</p>
          <p className="text-sm text-negative break-words">{message}</p>
        </div>
      </div>
      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-3 w-full px-4 py-2 text-sm font-medium text-negative bg-negative-soft
                     rounded-lg hover:bg-negative-soft transition-colors"
        >
          Try again
        </button>
      )}
    </div>
  );
}
