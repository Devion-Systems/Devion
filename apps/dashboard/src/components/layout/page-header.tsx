import Link from "next/link";
import { ChevronRight } from "lucide-react";
import type { ReactNode } from "react";

export type Breadcrumb = {
  label: string;
  href?: string;
};

type PageHeaderProps = {
  title: string;
  description?: string;
  breadcrumbs?: Breadcrumb[];
  primaryAction?: ReactNode;
  secondaryActions?: ReactNode;
};

/**
 * Reusable page header used on every route.
 *
 * Pattern:
 *   Breadcrumb (optional)
 *   Title
 *   Description (optional)
 *   Actions (optional – right-aligned on desktop, stacked below title on mobile)
 */
export function PageHeader({
  title,
  description,
  breadcrumbs,
  primaryAction,
  secondaryActions,
}: PageHeaderProps) {
  const hasActions = primaryAction || secondaryActions;

  return (
    <div data-slot="page-header" className="min-w-0">
      {breadcrumbs && breadcrumbs.length > 0 && (
        <nav
          aria-label="Breadcrumb"
          className="mb-2 flex min-w-0 items-center gap-1 text-xs text-zinc-500"
        >
          {breadcrumbs.map((crumb, i) => (
            <span key={crumb.label} className="flex items-center gap-1 min-w-0">
              {i > 0 && (
                <ChevronRight
                  className="size-3 shrink-0 text-zinc-600"
                  aria-hidden="true"
                />
              )}
              {crumb.href ? (
                <Link
                  href={crumb.href}
                  className="truncate transition hover:text-zinc-300"
                >
                  {crumb.label}
                </Link>
              ) : (
                <span
                  className="truncate text-zinc-400"
                  aria-current="page"
                >
                  {crumb.label}
                </span>
              )}
            </span>
          ))}
        </nav>
      )}

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="truncate text-xl font-semibold tracking-tight text-zinc-50">
            {title}
          </h1>
          {description && (
            <p className="mt-1 max-w-2xl text-sm leading-relaxed text-zinc-400">
              {description}
            </p>
          )}
        </div>

        {hasActions && (
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            {secondaryActions}
            {primaryAction}
          </div>
        )}
      </div>
    </div>
  );
}
