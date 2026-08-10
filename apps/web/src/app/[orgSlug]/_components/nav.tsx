"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  FolderKanban,
  Inbox,
  GitPullRequest,
  CalendarDays,
  Settings,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

export const NAV: { label: string; icon: LucideIcon; segment: string }[] = [
  { label: "Dashboard", icon: LayoutDashboard, segment: "dashboard" },
  { label: "Projects", icon: FolderKanban, segment: "projects" },
  { label: "Feature Requests", icon: Inbox, segment: "features" },
  { label: "Reviews", icon: GitPullRequest, segment: "reviews" },
  { label: "Calendar", icon: CalendarDays, segment: "calendar" },
  { label: "Settings", icon: Settings, segment: "settings" },
];

/** The wordmark used in the sidebar and mobile drawer. */
export function Wordmark() {
  return (
    <div className="flex items-center gap-2.5">
      <div
        className="flex size-7 items-center justify-center rounded-lg text-xs font-bold text-white shadow-sm"
        style={{
          backgroundImage:
            "linear-gradient(135deg, var(--primary), var(--brand-accent))",
        }}
      >
        SF
      </div>
      <span className="font-display text-[15px] font-semibold tracking-tight">
        ShipFlow
      </span>
    </div>
  );
}

/** Shared nav links; `onNavigate` lets the mobile drawer close on click. */
export function NavLinks({
  orgSlug,
  onNavigate,
}: {
  orgSlug: string;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  return (
    <nav className="space-y-1">
      {NAV.map(({ label, icon: Icon, segment }) => {
        const href = `/${orgSlug}/${segment}`;
        const active = pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={segment}
            href={href}
            onClick={onNavigate}
            className={cn(
              "group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              active
                ? "bg-accent text-accent-foreground"
                : "text-muted-foreground hover:bg-accent/50 hover:text-foreground",
            )}
          >
            <Icon
              className={cn(
                "size-4 transition-colors",
                active ? "text-primary" : "text-muted-foreground group-hover:text-foreground",
              )}
            />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
