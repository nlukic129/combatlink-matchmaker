export function SearchResultsSkeletonList() {
  return (
    <div className="fc-list-scroll scrollbar-thin min-h-0 flex-1 overflow-y-auto">
      <div className="fc-list-inner">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="fc-skeleton">
            <div className="fc-skeleton-photo shimmer" />
            <div className="fc-skeleton-main">
              <div className="h-5 w-44 rounded-md shimmer" />
              <div className="flex gap-2">
                <div className="h-3 w-16 rounded-full shimmer" />
                <div className="h-3 w-20 rounded-md shimmer" />
              </div>
            </div>
            <div className="fc-skeleton-stats">
              <div className="h-5 w-20 rounded-md shimmer" />
              <div className="h-2.5 w-12 rounded-md shimmer" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
