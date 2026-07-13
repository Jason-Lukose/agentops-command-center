import { AlertTriangle, RotateCw } from "lucide-react";

export function ErrorState({
  message,
  onRetry,
  compact = false,
}: {
  message: string;
  onRetry?: () => void;
  compact?: boolean;
}) {
  return (
    <div
      role="alert"
      className={`flex items-center gap-3 rounded-lg border border-red-500/30 bg-red-500/10 text-red-200 ${
        compact ? "px-3 py-2 text-sm" : "px-4 py-4"
      }`}
    >
      <AlertTriangle size={16} className="shrink-0" />
      <p className="flex-1">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="inline-flex items-center gap-1.5 rounded-md border border-red-500/40 px-2.5 py-1 text-xs font-medium text-red-100 transition-colors hover:bg-red-500/20"
        >
          <RotateCw size={12} />
          Retry
        </button>
      )}
    </div>
  );
}
