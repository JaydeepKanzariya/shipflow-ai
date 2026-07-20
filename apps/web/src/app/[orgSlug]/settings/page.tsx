import { GithubSettings } from "./github-settings";

export default function SettingsPage() {
  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Workspace configuration and integrations.
        </p>
      </div>
      <GithubSettings />
    </div>
  );
}
