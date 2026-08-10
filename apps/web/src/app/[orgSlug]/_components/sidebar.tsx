import { NavLinks, Wordmark } from "./nav";

/** Desktop sidebar (hidden on mobile — see MobileNav for the drawer). */
export function Sidebar({ orgSlug }: { orgSlug: string }) {
  return (
    <aside className="hidden w-60 shrink-0 flex-col border-r border-border bg-card/30 md:flex">
      <div className="flex h-14 items-center border-b border-border px-4">
        <Wordmark />
      </div>
      <div className="flex-1 overflow-y-auto p-3">
        <NavLinks orgSlug={orgSlug} />
      </div>
      <div className="border-t border-border p-3">
        <p className="px-3 font-mono text-[10px] uppercase tracking-widest text-muted-foreground/60">
          Idea → Ship
        </p>
      </div>
    </aside>
  );
}
