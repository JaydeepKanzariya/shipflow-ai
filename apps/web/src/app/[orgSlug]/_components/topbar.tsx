"use client";

import { useRouter } from "next/navigation";
import { Check, ChevronsUpDown, LogOut, Plus } from "lucide-react";
import { authClient } from "@shipflow/auth/client";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MobileNav } from "./mobile-nav";

type Org = { id: string; name: string; slug: string; role: string };

export function Topbar({ org, orgs }: { org: Org; orgs: Org[] }) {
  const router = useRouter();
  const { data: session } = authClient.useSession();

  async function switchOrg(o: Org) {
    if (o.id === org.id) return;
    await authClient.organization.setActive({ organizationId: o.id });
    router.push(`/${o.slug}/dashboard`);
    router.refresh();
  }

  async function signOut() {
    await authClient.signOut();
    router.push("/sign-in");
    router.refresh();
  }

  const user = session?.user;
  const initials =
    user?.name
      ?.split(" ")
      .map((p) => p[0])
      .slice(0, 2)
      .join("")
      .toUpperCase() ?? "?";

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-2 border-b border-border bg-background/80 px-3 backdrop-blur-md sm:px-4">
      <div className="flex min-w-0 items-center gap-1">
        <MobileNav orgSlug={org.slug} />
        {/* Org switcher */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="max-w-[52vw] gap-2 px-2 font-semibold sm:max-w-none">
              <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-primary/15 text-xs text-primary">
                {org.name[0]?.toUpperCase()}
              </span>
              <span className="truncate">{org.name}</span>
              <ChevronsUpDown className="size-4 shrink-0 text-muted-foreground" />
            </Button>
          </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuLabel>Workspaces</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {orgs.map((o) => (
            <DropdownMenuItem key={o.id} onClick={() => switchOrg(o)}>
              <span className="flex-1 truncate">{o.name}</span>
              {o.id === org.id && <Check className="size-4" />}
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => router.push("/onboarding")}>
              <Plus className="size-4" />
              New workspace
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* User menu */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="rounded-full">
            <Avatar>
              {user?.image && <AvatarImage src={user.image} alt={user.name ?? ""} />}
              <AvatarFallback>{initials}</AvatarFallback>
            </Avatar>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuLabel>
            <div className="flex flex-col">
              <span className="text-sm font-medium">{user?.name}</span>
              <span className="text-xs font-normal text-muted-foreground">
                {user?.email}
              </span>
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={signOut}>
            <LogOut className="size-4" />
            Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
