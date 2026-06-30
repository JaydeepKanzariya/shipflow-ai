import { redirect } from "next/navigation";
import { getServerApi } from "@/trpc/server";

// Post-authentication router: send the user to their workspace dashboard,
// or to onboarding if they don't belong to any organization yet.
export default async function PostAuthPage() {
  const api = await getServerApi();

  let orgs: Awaited<ReturnType<typeof api.organization.list>> = [];
  try {
    orgs = await api.organization.list();
  } catch {
    // Not authenticated → back to sign-in.
    redirect("/sign-in");
  }

  if (orgs.length === 0) {
    redirect("/onboarding");
  }

  // Prefer the active org; otherwise the first one.
  const current = await api.organization.current();
  const target = current?.slug ?? orgs[0]!.slug;
  redirect(`/${target}/dashboard`);
}
