export function SkeletonCard() {
  return (
    <div className="card overflow-hidden rounded-2xl" aria-hidden="true">
      <div className="aspect-square animate-pulse bg-fill" />
      <div className="space-y-2 p-2.5">
        <div className="h-3 w-4/5 animate-pulse rounded bg-fill" />
        <div className="h-2.5 w-1/2 animate-pulse rounded bg-fill" />
      </div>
    </div>
  );
}
