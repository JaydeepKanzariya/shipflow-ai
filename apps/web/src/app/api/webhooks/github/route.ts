import { prisma } from "@shipflow/db";
import { verifyGitHubWebhook } from "@shipflow/github";

export const maxDuration = 60;

/**
 * GitHub webhook receiver. Verifies the HMAC-SHA256 signature over the RAW
 * body, then processes installation + pull_request events. PRs are upserted
 * and auto-linked to a feature when the branch name or PR body contains the
 * feature's id.
 */
export async function POST(request: Request) {
  const rawBody = await request.text();
  const signature = request.headers.get("x-hub-signature-256");
  const event = request.headers.get("x-github-event") ?? "";

  const valid = await verifyGitHubWebhook(rawBody, signature);
  if (!valid) {
    return new Response("Invalid signature", { status: 401 });
  }

  const payload = JSON.parse(rawBody) as Record<string, unknown>;

  try {
    switch (event) {
      case "installation":
        await handleInstallation(payload);
        break;
      case "pull_request":
        await handlePullRequest(payload);
        break;
      default:
        // Unhandled event types are acknowledged, not errors.
        break;
    }
    return new Response("ok", { status: 200 });
  } catch (err) {
    console.error("[github-webhook] error:", err);
    return new Response("Handler error", { status: 500 });
  }
}

type InstallationPayload = {
  action?: string;
  installation?: { id: number };
};

async function handleInstallation(payload: InstallationPayload) {
  if (payload.action === "deleted" && payload.installation) {
    const installationId = String(payload.installation.id);
    // The app was uninstalled — detach it from any workspace using it.
    await prisma.organization.updateMany({
      where: { githubInstallationId: installationId },
      data: { githubInstallationId: null },
    });
  }
}

type PullRequestPayload = {
  action?: string;
  repository?: { id: number; full_name: string };
  pull_request?: {
    number: number;
    title: string;
    body: string | null;
    state: string;
    merged: boolean;
    html_url: string;
    head: { ref: string; sha: string };
    base: { ref: string };
    user: { login: string } | null;
  };
};

async function handlePullRequest(payload: PullRequestPayload) {
  const pr = payload.pull_request;
  const ghRepo = payload.repository;
  if (!pr || !ghRepo) return;

  // Only process PRs on repos connected to a workspace.
  const repo = await prisma.repository.findFirst({
    where: {
      OR: [{ githubRepoId: String(ghRepo.id) }, { fullName: ghRepo.full_name }],
    },
    select: { id: true, organizationId: true },
  });
  if (!repo) return;

  const state = pr.merged ? "MERGED" : pr.state === "closed" ? "CLOSED" : "OPEN";

  // Auto-link: does the branch name or PR body mention a feature id?
  const haystack = `${pr.head.ref}\n${pr.body ?? ""}`;
  const features = await prisma.featureRequest.findMany({
    where: { organizationId: repo.organizationId },
    select: { id: true, status: true },
  });
  const linked = features.find((f) => haystack.includes(f.id));

  await prisma.pullRequest.upsert({
    where: { repositoryId_number: { repositoryId: repo.id, number: pr.number } },
    create: {
      organizationId: repo.organizationId,
      repositoryId: repo.id,
      featureRequestId: linked?.id,
      number: pr.number,
      title: pr.title,
      branch: pr.head.ref,
      baseBranch: pr.base.ref,
      headSha: pr.head.sha,
      state,
      url: pr.html_url,
      authorLogin: pr.user?.login,
    },
    update: {
      title: pr.title,
      headSha: pr.head.sha,
      state,
      // Preserve an existing manual link; only fill when newly detected.
      ...(linked ? { featureRequestId: linked.id } : {}),
    },
  });

  // A PR arriving for a planned feature moves it into development.
  if (
    linked &&
    (linked.status === "TASKS_READY" || linked.status === "PRD_APPROVED")
  ) {
    await prisma.featureRequest.update({
      where: { id: linked.id },
      data: { status: "IN_DEVELOPMENT" },
    });
  }
}
