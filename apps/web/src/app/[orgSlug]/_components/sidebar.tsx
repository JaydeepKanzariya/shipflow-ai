"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  FolderKanban,
  Inbox,
  GitPullRequest,
  Settings,
} from "lucide-react";
import { cn } from "@/lib/utils";

const NAV = [
  { label: "Dashboard", icon: LayoutDashboard, segment: "dashboard" },
  { label: "Projects", icon: FolderKanban, segment: "projects" },
  { label: "Feature Requests", icon: Inbox, segment: "features" },
  { label: "Reviews", icon: GitPullRequest, segment: "reviews" },
  { label: "Settings", icon: Settings, segment: "settings" },
] as const;

export function Sidebar({ orgSlug }: { orgSlug: string }) {
  const pathname = usePathname();

  return (
    <aside className="hidden w-60 shrink-0 border-r bg-card/40 md:flex md:flex-col">
      <div className="flex h-14 items-center gap-2 border-b px-4">
        <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-xs font-bold text-primary-foreground">
          SF
        </div>
        <span className="font-semibold tracking-tight">ShipFlow</span>
      </div>
      <nav className="flex-1 space-y-1 p-3">
        {NAV.map(({ label, icon: Icon, segment }) => {
          const href = `/${orgSlug}/${segment}`;
          const active = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <Link
              key={segment}
              href={href}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-accent text-accent-foreground"
                  : "text-muted-foreground hover:bg-accent/50 hover:text-foreground",
              )}
            >
              <Icon className="size-4" />
              {label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
