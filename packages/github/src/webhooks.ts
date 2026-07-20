import { getGitHubApp } from "./app";

/**
 * Verify a webhook's HMAC-SHA256 signature over the RAW request body.
 * Returns false when the secret is unset or the signature doesn't match.
 */
export async function verifyGitHubWebhook(
  rawBody: string,
  signature: string | null,
): Promise<boolean> {
  if (!signature) return false;
  try {
    const app = getGitHubApp();
    return await app.webhooks.verify(rawBody, signature);
  } catch {
    return false;
  }
}
