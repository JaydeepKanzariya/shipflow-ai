import { GithubSettings } from "./github-settings";
import { BillingSettings } from "./billing-settings";
import { Appearance } from "./appearance";

export default function SettingsPage() {
  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <div>
        <p className="eyebrow mb-1.5">Workspace</p>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Appearance, integrations, and billing.
        </p>
      </div>
      <Appearance />
      <GithubSettings />
      <BillingSettings />
    </div>
  );
}
