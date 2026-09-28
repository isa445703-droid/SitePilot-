import { SkeletonList } from "@/components/ui/status";

export default function AppLoading() {
  return (
    <div className="p-1">
      <div className="mb-5 h-7 w-48 animate-pulse rounded-lg bg-surface-2" aria-hidden="true" />
      <SkeletonList rows={5} />
      <span className="sr-only" role="status">
        Loading…
      </span>
    </div>
  );
}
