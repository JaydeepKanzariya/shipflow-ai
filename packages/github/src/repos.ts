import { getInstallationClient } from "./app";

export interface RepoSummary {
  githubRepoId: string;
  owner: string;
  name: string;
  fullName: string;
  private: boolean;
  defaultBranch: string;
}

/** Repositories the installation can access. */
export async function listInstallationRepos(
  installationId: string,
): Promise<RepoSummary[]> {
  const octokit = await getInstallationClient(installationId);
  const repos = await octokit.paginate(
    octokit.rest.apps.listReposAccessibleToInstallation,
    { per_page: 100 },
  );
  return repos.map((r) => ({
    githubRepoId: String(r.id),
    owner: r.owner.login,
    name: r.name,
    fullName: r.full_name,
    private: r.private,
    defaultBranch: r.default_branch,
  }));
}

export interface PrFile {
  filename: string;
  status: string;
  additions: number;
  deletions: number;
  /** Unified diff hunk for the file (absent for binary/huge files). */
  patch?: string;
}

/** Changed files (with patches) for a pull request — feeds the AI review. */
export async function getPrFiles(opts: {
  installationId: string;
  owner: string;
  repo: string;
  pullNumber: number;
}): Promise<PrFile[]> {
  const octokit = await getInstallationClient(opts.installationId);
  const files = await octokit.paginate(octokit.rest.pulls.listFiles, {
    owner: opts.owner,
    repo: opts.repo,
    pull_number: opts.pullNumber,
    per_page: 100,
  });
  return files.map((f) => ({
    filename: f.filename,
    status: f.status,
    additions: f.additions,
    deletions: f.deletions,
    patch: f.patch,
  }));
}

export interface RepoOverview {
  fullName: string;
  defaultBranch: string;
  description: string | null;
  languages: string[];
  /** Paths of the repo tree (truncated to a sane cap). */
  tree: string[];
  /** Contents of a few key manifest/docs files, when present. */
  keyFiles: { path: string; content: string }[];
}

const KEY_FILE_CANDIDATES = [
  "package.json",
  "README.md",
  "pyproject.toml",
  "go.mod",
  "Cargo.toml",
  "composer.json",
];

/** Lightweight repo snapshot (tree + key files) for the AI repo analysis. */
export async function getRepoOverview(opts: {
  installationId: string;
  owner: string;
  repo: string;
}): Promise<RepoOverview> {
  const octokit = await getInstallationClient(opts.installationId);
  const { data: repo } = await octokit.rest.repos.get({
    owner: opts.owner,
    repo: opts.repo,
  });

  const { data: langs } = await octokit.rest.repos.listLanguages({
    owner: opts.owner,
    repo: opts.repo,
  });

  const { data: treeData } = await octokit.rest.git.getTree({
    owner: opts.owner,
    repo: opts.repo,
    tree_sha: repo.default_branch,
    recursive: "true",
  });
  const tree = treeData.tree
    .filter((t) => t.type === "blob" && t.path)
    .map((t) => t.path as string)
    .slice(0, 400);

  const keyFiles: { path: string; content: string }[] = [];
  for (const path of KEY_FILE_CANDIDATES) {
    if (!tree.includes(path)) continue;
    try {
      const { data } = await octokit.rest.repos.getContent({
        owner: opts.owner,
        repo: opts.repo,
        path,
      });
      if (!Array.isArray(data) && data.type === "file" && data.content) {
        const content = Buffer.from(data.content, "base64").toString("utf8");
        keyFiles.push({ path, content: content.slice(0, 8000) });
      }
    } catch {
      // best effort — skip unreadable files
    }
  }

  return {
    fullName: repo.full_name,
    defaultBranch: repo.default_branch,
    description: repo.description,
    languages: Object.keys(langs),
    tree,
    keyFiles,
  };
}
