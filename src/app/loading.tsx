export default function RootLoading() {
  return (
    <div className="grid min-h-dvh place-items-center p-6" role="status" aria-live="polite">
      <div className="flex flex-col items-center gap-3">
        <span className="spinner h-6 w-6 text-accent" aria-hidden="true" />
        <p className="text-sm text-muted">Loading…</p>
      </div>
    </div>
  );
}
