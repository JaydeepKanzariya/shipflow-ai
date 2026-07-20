import { App, Octokit } from "octokit";

/**
 * GitHub App singleton. Authenticates as the App (JWT) and mints
 * per-installation tokens on demand. The private key is stored in env with
 * literal "\n" escapes (single-line), normalized here.
 */
let _app: App | null = null;

export function getGitHubApp(): App {
  if (_app) return _app;
  const appId = process.env.GITHUB_APP_ID;
  const privateKey = process.env.GITHUB_APP_PRIVATE_KEY?.replace(/\\n/g, "\n");
  const webhookSecret = process.env.GITHUB_WEBHOOK_SECRET;
  if (!appId || !privateKey) {
    throw new Error(
      "GitHub App not configured: set GITHUB_APP_ID and GITHUB_APP_PRIVATE_KEY.",
    );
  }
  _app = new App({
    appId,
    privateKey,
    ...(webhookSecret ? { webhooks: { secret: webhookSecret } } : {}),
  });
  return _app;
}

/** Octokit authenticated for a specific installation. */
export async function getInstallationClient(
  installationId: string | number,
): Promise<Octokit> {
  const app = getGitHubApp();
  return app.getInstallationOctokit(Number(installationId));
}
