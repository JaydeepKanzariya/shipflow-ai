"use client";

import { Suspense, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useTRPC } from "@/trpc/client";

/**
 * GitHub App post-install callback (the App's "Setup URL"). GitHub redirects
 * here with ?installation_id=…&state=<orgId>. We store the installation on
 * the active workspace, then land on its settings page.
 */
export default function GithubSetupPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <Loader2 className="size-6 animate-spin" />
        </div>
      }
    >
      <SetupInner />
    </Suspense>
  );
}

function SetupInner() {
  const router = useRouter();
  const params = useSearchParams();
  const trpc = useTRPC();
  const ran = useRef(false);

  const current = useQuery(trpc.organization.current.queryOptions());
  const connect = useMutation(trpc.github.connectInstallation.mutationOptions());

  const installationId = params.get("installation_id");

  useEffect(() => {
    if (ran.current || !installationId || !current.data) return;
    ran.current = true;
    connect.mutate(
      { installationId },
      {
        onSuccess: () => {
          toast.success("GitHub connected.");
          router.replace(`/${current.data!.slug}/settings`);
        },
        onError: (e) => {
          toast.error(e.message);
          router.replace(`/${current.data!.slug}/settings`);
        },
      },
    );
  }, [installationId, current.data, connect, router]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3">
      <Loader2 className="size-6 animate-spin" />
      <p className="text-sm text-muted-foreground">
        {installationId
          ? "Finishing GitHub installation…"
          : "Missing installation id — return to GitHub and try again."}
      </p>
    </div>
  );
}
