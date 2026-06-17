import { cn } from "@/lib/utils";
import { Logo } from "@/components/ui/logo";
import type { PageLoaderKey } from "@/lib/page-loading";
import { ShimmerBlock } from "./shimmer-block";
import { SearchResultsSkeletonList } from "./search-results-skeleton";

export function AuthGateLoader() {
  return (
    <div className="app-loading app-loading--full auth-gradient">
      <div className="app-loading-brand">
        <div className="app-loading-glow" aria-hidden />
        <Logo size="md" variant="brand" productLabel />
        <LoadingTrack className="mt-8" />
        <p className="app-loading-caption">Loading workspace…</p>
      </div>
    </div>
  );
}

export function AppLoadingHeader() {
  return (
    <header className="app-loading-header">
      <Logo size="sm" variant="brand" productLabel className="items-start!" />
      <div className="app-loading-header-nav" aria-hidden>
        <ShimmerBlock className="app-loading-shimmer--nav" />
        <ShimmerBlock className="app-loading-shimmer--nav" />
      </div>
      <div className="app-loading-header-actions" aria-hidden>
        <ShimmerBlock className="app-loading-shimmer--icon" />
        <ShimmerBlock className="app-loading-shimmer--avatar" />
      </div>
    </header>
  );
}

export function PageLoaderContent({ page }: { page: PageLoaderKey }) {
  switch (page) {
    case "search-setup":
      return <SearchSetupLoader />;
    case "search":
      return <SearchResultsLoader />;
    case "favourites":
      return <FavouritesLoader />;
    case "compare":
      return <CompareLoader />;
    case "notifications":
      return <NotificationsLoader />;
    case "settings":
      return <SettingsLoader />;
    default:
      return <DefaultPageLoader />;
  }
}

function SearchSetupLoader() {
  return (
    <div className="page-loader page-loader--search-setup search-setup search-content-vt">
      <div className="search-setup-stage relative mx-auto flex min-h-full w-full max-w-full flex-col justify-center px-6 py-10 sm:px-10 lg:max-w-[1020px] lg:px-0 xl:max-w-[1160px]">
        <div className="page-loader-setup-globe" aria-hidden />
        <div className="relative z-10 max-w-xl space-y-8">
          <div className="space-y-3">
            <ShimmerBlock className="page-loader-setup-eyebrow" />
            <ShimmerBlock className="page-loader-setup-title" />
            <ShimmerBlock className="page-loader-setup-desc" />
          </div>
          <div className="space-y-3">
            <ShimmerBlock className="page-loader-setup-label" />
            <div className="grid grid-cols-3 gap-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <ShimmerBlock key={i} className="page-loader-setup-sport" style={{ animationDelay: `${i * 70}ms` }} />
              ))}
            </div>
          </div>
          <div className="space-y-3">
            <ShimmerBlock className="page-loader-setup-label" />
            <div className="grid grid-cols-2 gap-3">
              <ShimmerBlock className="page-loader-setup-gender" />
              <ShimmerBlock className="page-loader-setup-gender" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function SearchResultsLoader() {
  return (
    <div className="page-loader page-loader--search search-content-vt flex h-[calc(100dvh-3.5rem)] flex-col">
      <div className="page-loader-search-filters" aria-hidden>
        <ShimmerBlock className="page-loader-filter-pill" />
        <ShimmerBlock className="page-loader-filter-pill" />
        <ShimmerBlock className="page-loader-filter-pill page-loader-filter-pill--wide" />
        <div className="flex-1" />
        <ShimmerBlock className="page-loader-filter-chip" />
        <ShimmerBlock className="page-loader-filter-chip" />
      </div>
      <div className="mx-auto flex w-full max-w-[1600px] flex-1 overflow-hidden">
        <aside className="page-loader-sidebar scrollbar-thin" aria-hidden>
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="page-loader-sidebar-section">
              <ShimmerBlock className="page-loader-sidebar-label" />
              <ShimmerBlock className="page-loader-sidebar-field" />
              {i % 2 === 0 && <ShimmerBlock className="page-loader-sidebar-field page-loader-sidebar-field--short" />}
            </div>
          ))}
        </aside>
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <div className="page-loader-results-toolbar" aria-hidden>
            <ShimmerBlock className="page-loader-results-count" />
            <div className="flex-1" />
            <ShimmerBlock className="page-loader-results-toggle" />
          </div>
          <div className="fc-list-shell relative flex min-h-0 flex-1 flex-col">
            <SearchResultsSkeletonList />
          </div>
        </div>
      </div>
    </div>
  );
}

export function FavouritesLoader() {
  return (
    <div className="page-loader page-loader--favourites">
      <div className="sticky top-0 z-20 border-b border-border bg-background/96 backdrop-blur-md">
        <div className="flex items-center gap-3 px-8 py-3">
          <ShimmerBlock className="page-loader-fav-count" />
          <div className="flex-1" />
          <ShimmerBlock className="page-loader-fav-search" />
          <ShimmerBlock className="page-loader-fav-sort" />
        </div>
        <div className="flex items-center gap-2 px-8 pb-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <ShimmerBlock key={i} className="page-loader-fav-tab" style={{ animationDelay: `${i * 50}ms` }} />
          ))}
        </div>
      </div>
      <div className="space-y-1.5 px-8 py-4 pb-20">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="page-loader-fav-row">
            <ShimmerBlock className="page-loader-fav-avatar" style={{ animationDelay: `${i * 60}ms` }} />
            <div className="min-w-0 flex-1 space-y-2">
              <ShimmerBlock className="page-loader-fav-name" />
              <ShimmerBlock className="page-loader-fav-meta" />
            </div>
            <ShimmerBlock className="page-loader-fav-actions" />
          </div>
        ))}
      </div>
    </div>
  );
}

function CompareLoader() {
  return (
    <div className="page-loader page-loader--compare cmp-page">
      <div className="cmp-inner">
        <header className="cmp-header">
          <ShimmerBlock className="page-loader-cmp-back" />
          <ShimmerBlock className="page-loader-cmp-eyebrow" />
          <ShimmerBlock className="page-loader-cmp-title" />
          <ShimmerBlock className="page-loader-cmp-pill" />
        </header>
        <div className="cmp-arena">
          <ShimmerBlock className="page-loader-cmp-poster page-loader-cmp-poster--left" />
          <div className="cmp-vs-col" aria-hidden>
            <div className="page-loader-cmp-vs">VS</div>
          </div>
          <ShimmerBlock className="page-loader-cmp-poster page-loader-cmp-poster--right" />
        </div>
        <div className="page-loader-cmp-tabs" aria-hidden>
          {Array.from({ length: 5 }).map((_, i) => (
            <ShimmerBlock key={i} className="page-loader-cmp-tab" />
          ))}
        </div>
      </div>
    </div>
  );
}

export function NotificationsLoader() {
  return (
    <div className="page-loader page-loader--notifications notif-page">
      <div className="notif-inner">
        <header className="notif-header">
          <div className="space-y-2">
            <ShimmerBlock className="page-loader-notif-eyebrow" />
            <ShimmerBlock className="page-loader-notif-title" />
            <ShimmerBlock className="page-loader-notif-sub" />
          </div>
        </header>
        <ShimmerBlock className="page-loader-notif-insight" />
        <div className="space-y-2">
          <ShimmerBlock className="page-loader-notif-group" />
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="page-loader-notif-row">
              <ShimmerBlock className="page-loader-notif-avatar" style={{ animationDelay: `${i * 70}ms` }} />
              <div className="min-w-0 flex-1 space-y-2">
                <ShimmerBlock className="page-loader-notif-line page-loader-notif-line--head" />
                <ShimmerBlock className="page-loader-notif-line" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function SettingsLoader() {
  return (
    <div className="page-loader page-loader--settings mx-auto max-w-lg px-4 py-8 sm:px-6">
      <div className="space-y-2">
        <ShimmerBlock className="page-loader-settings-title" />
        <ShimmerBlock className="page-loader-settings-desc" />
      </div>
      <div className="mt-6 space-y-4">
        <ShimmerBlock className="page-loader-settings-card" />
        <ShimmerBlock className="page-loader-settings-card page-loader-settings-card--short" />
      </div>
    </div>
  );
}

function DefaultPageLoader() {
  return (
    <div className="page-loader page-loader--default flex flex-1 items-center justify-center auth-gradient">
      <LoadingTrack />
    </div>
  );
}

function LoadingTrack({ className }: { className?: string }) {
  return (
    <div
      className={cn("app-loading-track", className)}
      role="progressbar"
      aria-label="Loading"
      aria-busy="true"
    >
      <div className="app-loading-track-fill" />
    </div>
  );
}