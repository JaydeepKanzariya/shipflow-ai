import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { setActiveOrganization } from "@shipflow/auth";
import { getServerApi } from "@/trpc/server";
import { Sidebar } from "./_components/sidebar";
import { Topbar } from "./_components/topbar";

export default async function OrgLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ orgSlug: string }>;
}) {
  const { orgSlug } = await params;
  const api = await getServerApi();

  // Resolve org + verify membership server-side. bySlug throws NOT_FOUND /
  // FORBIDDEN, and the underlying procedure throws UNAUTHORIZED if no session.
  let org;
  try {
    org = await api.organization.bySlug({ slug: orgSlug });
  } catch (err) {
    const code = (err as { code?: string })?.code;
    if (code === "UNAUTHORIZED") redirect("/sign-in");
    // NOT_FOUND or FORBIDDEN → don't reveal which.
    notFound();
  }

  // Sync the session's active org to the URL (path-based tenancy) and load the
  // org switcher list. These are independent, so run them in parallel to cut a
  // sequential DB round-trip off every navigation.
  const [, orgs] = await Promise.all([
    setActiveOrganization(await headers(), org.id),
    api.organization.list(),
  ]);

  return (
    <div className="flex min-h-screen">
      <Sidebar orgSlug={org.slug} />
      <div className="flex flex-1 flex-col">
        <Topbar org={org} orgs={orgs} />
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
