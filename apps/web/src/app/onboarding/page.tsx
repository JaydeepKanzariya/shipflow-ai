import { redirect } from "next/navigation";
import { getServerApi } from "@/trpc/server";
import { OnboardingForm } from "./onboarding-form";

export default async function OnboardingPage() {
  const api = await getServerApi();

  // Must be authenticated; if they already have an org, skip onboarding.
  let orgs: Awaited<ReturnType<typeof api.organization.list>> = [];
  try {
    orgs = await api.organization.list();
  } catch {
    redirect("/sign-in");
  }
  if (orgs.length > 0) {
    redirect(`/${orgs[0]!.slug}/dashboard`);
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-12">
      <OnboardingForm />
    </div>
  );
}
