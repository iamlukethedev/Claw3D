import * as childProcess from "node:child_process";

export type GitHubAuthState = "ready" | "missing-gh" | "unauthenticated";

export type GitHubPullRequestSummary = {
  number: number;
  title: string;
  url: string;
  repo: string;
  author: string;
  updatedAt: string | null;
  isDraft: boolean;
  labels: string[];
  reviewDecision: string | null;
  headRefName: string | null;
  baseRefName: string | null;
  statusSummary: string | null;
};

export type GitHubStatusCheck = {
  name: string;
  status: string | null;
  conclusion: string | null;
  workflow: string | null;
  detailsUrl: string | null;
};

export type GitHubReviewEntry = {
  author: string;
  state: string | null;
  body: string;
  submittedAt: string | null;
};

export type GitHubCommentEntry = {
  author: string;
  body: string;
  createdAt: string | null;
  url: string | null;
};

export type GitHubCommitEntry = {
  oid: string;
  messageHeadline: string;
  authoredDate: string | null;
};

export type GitHubFileEntry = {
  path: string;
  additions: number;
  deletions: number;
  status: string | null;
  previousPath: string | null;
  patch: string | null;
};

export type GitHubPullRequestDetail = GitHubPullRequestSummary & {
  body: string;
  state: string | null;
  mergeable: string | null;
  headRefOid: string | null;
  statusChecks: GitHubStatusCheck[];
  reviews: GitHubReviewEntry[];
  comments: GitHubCommentEntry[];
  commits: GitHubCommitEntry[];
  files: GitHubFileEntry[];
  diff: string;
  diffTruncated: boolean;
};

export type GitHubDashboardResponse = {
  ready: boolean;
  authState: GitHubAuthState;
  viewerLogin: string | null;
  currentRepoSlug: string | null;
  currentRepoPullRequests: GitHubPullRequestSummary[];
  reviewRequests: GitHubPullRequestSummary[];
  authoredPullRequests: GitHubPullRequestSummary[];
  message: string | null;
};

export type GitHubDetailResponse = {
  ready: boolean;
  authState: GitHubAuthState;
  viewerLogin: string | null;
  currentRepoSlug: string | null;
  pullRequest: GitHubPullRequestDetail | null;
  message: string | null;
};

export type GitHubReviewAction = "APPROVE" | "COMMENT" | "REQUEST_CHANGES";
export type GitHubInlineCommentSide = "LEFT" | "RIGHT";

const DEFAULT_MAX_BUFFER = 8 * 1024 * 1024;
const DIFF_PREVIEW_LIMIT = 80_000;

const trimText = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
};

const toNumber = (value: unknown): number => {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
};

const toRecord = (value: unknown): Record<string, unknown> => {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
};

const toArray = (value: unknown): unknown[] => {
  return Array.isArray(value) ? value : [];
};

const extractCommandMessage = (stderr: string, stdout: string, fallback: string): string => {
  const stderrText = stderr.trim();
  if (stderrText) return stderrText;
  const stdoutText = stdout.trim();
  if (stdoutText) return stdoutText;
  return fallback;
};

const runCommand = (command: string, args: string[], options?: { input?: string; maxBuffer?: number }) => {
  const result = childProcess.spawnSync(command, args, {
    cwd: process.cwd(),
    encoding: "utf8",
    input: options?.input,
    maxBuffer: options?.maxBuffer ?? DEFAULT_MAX_BUFFER,
  });
  if (result.error) {
    throw result.error;
  }
  return {
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
    status: result.status ?? 0,
  };
};

const runJsonCommand = <T>(command: string, args: string[], label: string): T => {
  const result = runCommand(command, args);
  if (result.status !== 0) {
    throw new Error(
      extractCommandMessage(result.stderr, result.stdout, `Failed to run ${label}.`),
    );
  }
  const trimmed = result.stdout.trim();
  if (!trimmed) {
    throw new Error(`Empty JSON response from ${label}.`);
  }
  try {
    return JSON.parse(trimmed) as T;
  } catch {
    throw new Error(`Invalid JSON response from ${label}.`);
  }
};

const runTextCommand = (command: string, args: string[], label: string): string => {
  const result = runCommand(command, args);
  if (result.status !== 0) {
    throw new Error(
      extractCommandMessage(result.stderr, result.stdout, `Failed to run ${label}.`),
    );
  }
  return result.stdout;
};

const getGitHubAuthState = (): { authState: GitHubAuthState; viewerLogin: string | null; message: string | null } => {
  try {
    const version = runCommand("gh", ["--version"]);
    if (version.status !== 0) {
      return {
        authState: "missing-gh",
        viewerLogin: null,
        message: extractCommandMessage(version.stderr, version.stdout, "GitHub CLI is not installed."),
      };
    }
  } catch {
    return {
      authState: "missing-gh",
      viewerLogin: null,
      message: "GitHub CLI is not installed.",
    };
  }

  try {
    const viewerLogin = runTextCommand("gh", ["api", "user", "--jq", ".login"], "gh api user").trim();
    return {
      authState: "ready",
      viewerLogin: viewerLogin || null,
      message: null,
    };
  } catch (error) {
    return {
      authState: "unauthenticated",
      viewerLogin: null,
      message: error instanceof Error ? error.message : "GitHub CLI is not authenticated.",
    };
  }
};

const parseRemoteUrl = (remoteUrl: string): string | null => {
  const trimmed = remoteUrl.trim();
  if (!trimmed) return null;
  try {
    const url = new URL(trimmed);
    const pathname = url.pathname.replace(/^\/+/, "").replace(/\.git$/i, "");
    return pathname || null;
  } catch {
    const sshMatch = trimmed.match(/github\.com[:/](.+?)(?:\.git)?$/i);
    return sshMatch?.[1]?.trim() || null;
  }
};

export const resolveCurrentRepoSlug = (): string | null => {
  const override = process.env.GITHUB_CURRENT_REPO?.trim();
  if (override) return override || null;
  try {
    const remoteUrl = runTextCommand("git", ["remote", "get-url", "origin"], "git remote get-url origin");
    return parseRemoteUrl(remoteUrl);
  } catch {
    return null;
  }
};

const summarizeStatusChecks = (value: unknown): string | null => {
  const entries = toArray(value);
  if (entries.length === 0) return null;
  let failed = 0;
  let pending = 0;
  let passed = 0;
  for (const entry of entries) {
    const record = toRecord(entry);
    const state = trimText(record.state)?.toUpperCase() ?? trimText(record.status)?.toUpperCase() ?? "";
    const conclusion = trimText(record.conclusion)?.toUpperCase() ?? "";
    if (conclusion === "FAILURE" || conclusion === "TIMED_OUT" || conclusion === "CANCELLED") {
      failed += 1;
    } else if (state === "PENDING" || state === "IN_PROGRESS" || state === "QUEUED" || state === "EXPECTED") {
      pending += 1;
    } else {
      passed += 1;
    }
  }
  if (failed > 0) return `${failed} failing`;
  if (pending > 0) return `${pending} pending`;
  if (passed > 0) return `${passed} passing`;
  return null;
};

const normalizeLabels = (value: unknown): string[] => {
  return toArray(value)
    .map((entry) => trimText(toRecord(entry).name) ?? trimText(entry))
    .filter((entry): entry is string => Boolean(entry));
};

const normalizeSummary = (value: unknown, fallbackRepo: string | null = null): GitHubPullRequestSummary => {
  const record = toRecord(value);
  const repository = toRecord(record.repository);
  const repo =
    trimText(repository.nameWithOwner) ??
    trimText(record.repo) ??
    fallbackRepo ??
    "unknown/unknown";
  return {
    number: toNumber(record.number),
    title: trimText(record.title) ?? "Untitled pull request",
    url: trimText(record.url) ?? "",
    repo,
    author: trimText(toRecord(record.author).login) ?? "unknown",
    updatedAt: trimText(record.updatedAt),
    isDraft: Boolean(record.isDraft),
    labels: normalizeLabels(record.labels),
    reviewDecision: trimText(record.reviewDecision),
    headRefName: trimText(record.headRefName),
    baseRefName: trimText(record.baseRefName),
    statusSummary: summarizeStatusChecks(record.statusCheckRollup),
  };
};

const normalizeStatusChecks = (value: unknown): GitHubStatusCheck[] => {
  return toArray(value).map((entry) => {
    const record = toRecord(entry);
    return {
      name:
        trimText(record.name) ??
        trimText(record.context) ??
        trimText(record.workflowName) ??
        "Unnamed check",
      status: trimText(record.state) ?? trimText(record.status),
      conclusion: trimText(record.conclusion),
      workflow: trimText(record.workflowName),
      detailsUrl: trimText(record.detailsUrl) ?? trimText(record.targetUrl),
    };
  });
};

const normalizeReviews = (value: unknown): GitHubReviewEntry[] => {
  return toArray(value).map((entry) => {
    const record = toRecord(entry);
    return {
      author: trimText(toRecord(record.author).login) ?? "unknown",
      state: trimText(record.state),
      body: trimText(record.body) ?? "",
      submittedAt: trimText(record.submittedAt),
    };
  });
};

const normalizeComments = (value: unknown): GitHubCommentEntry[] => {
  return toArray(value).map((entry) => {
    const record = toRecord(entry);
    return {
      author: trimText(toRecord(record.author).login) ?? "unknown",
      body: trimText(record.body) ?? "",
      createdAt: trimText(record.createdAt),
      url: trimText(record.url),
    };
  });
};

const normalizeCommits = (value: unknown): GitHubCommitEntry[] => {
  return toArray(value).map((entry) => {
    const record = toRecord(entry);
    return {
      oid: trimText(record.oid) ?? "",
      messageHeadline: trimText(record.messageHeadline) ?? "Commit",
      authoredDate: trimText(record.authoredDate),
    };
  });
};

const normalizeFiles = (value: unknown): GitHubFileEntry[] => {
  return toArray(value).map((entry) => {
    const record = toRecord(entry);
    const rawPatch = typeof record.patch === "string" ? record.patch.trimEnd() : "";
    return {
      path: trimText(record.path) ?? trimText(record.filename) ?? "unknown",
      additions: toNumber(record.additions),
      deletions: toNumber(record.deletions),
      status: trimText(record.status),
      previousPath:
        trimText(record.previousPath) ?? trimText(record.previous_filename),
      patch: rawPatch.trim() ? rawPatch : null,
    };
  });
};

const loadSearchResults = (args: string[]): GitHubPullRequestSummary[] => {
  const payload = runJsonCommand<unknown[]>("gh", args, "gh search prs");
  return payload.map((entry) => normalizeSummary(entry));
};

const loadRepoPullRequests = (repo: string): GitHubPullRequestSummary[] => {
  const payload = runJsonCommand<unknown[]>(
    "gh",
    [
      "pr",
      "list",
      "--repo",
      repo,
      "--state",
      "open",
      "--limit",
      "25",
      "--json",
      "number,title,url,author,reviewDecision,isDraft,updatedAt,headRefName,baseRefName,statusCheckRollup,labels",
    ],
    "gh pr list",
  );
  return payload.map((entry) => normalizeSummary(entry, repo));
};

const loadPullRequestDiff = (repo: string, number: number): { diff: string; diffTruncated: boolean } => {
  try {
    const output = runTextCommand(
      "gh",
      ["pr", "diff", String(number), "--repo", repo],
      "gh pr diff",
    );
    const diff = output.trimEnd();
    if (diff.length <= DIFF_PREVIEW_LIMIT) {
      return { diff, diffTruncated: false };
    }
    return {
      diff: `${diff.slice(0, DIFF_PREVIEW_LIMIT).trimEnd()}\n\n... diff truncated ...`,
      diffTruncated: true,
    };
  } catch {
    return { diff: "", diffTruncated: false };
  }
};

const loadPullRequestFiles = (repo: string, number: number): GitHubFileEntry[] => {
  try {
    const payload = runJsonCommand<unknown[]>(
      "gh",
      ["api", `repos/${repo}/pulls/${number}/files`, "--paginate", "--slurp"],
      "gh api pull request files",
    );
    return normalizeFiles(payload.flatMap((page) => toArray(page)));
  } catch {
    return [];
  }
};

const loadPullRequestDetail = (repo: string, number: number): GitHubPullRequestDetail => {
  const payload = runJsonCommand<Record<string, unknown>>(
    "gh",
    [
      "pr",
      "view",
      String(number),
      "--repo",
      repo,
      "--json",
      "number,title,url,author,files,reviews,comments,commits,reviewDecision,statusCheckRollup,headRefName,headRefOid,baseRefName,updatedAt,isDraft,labels,body,state,mergeable",
    ],
    "gh pr view",
  );
  const diff = loadPullRequestDiff(repo, number);
  const files = loadPullRequestFiles(repo, number);
  return {
    ...normalizeSummary(payload, repo),
    body: trimText(payload.body) ?? "",
    state: trimText(payload.state),
    mergeable: trimText(payload.mergeable),
    headRefOid: trimText(payload.headRefOid),
    statusChecks: normalizeStatusChecks(payload.statusCheckRollup),
    reviews: normalizeReviews(payload.reviews),
    comments: normalizeComments(payload.comments),
    commits: normalizeCommits(payload.commits),
    files: files.length > 0 ? files : normalizeFiles(payload.files),
    diff: diff.diff,
    diffTruncated: diff.diffTruncated,
  };
};

export const loadGitHubDashboard = (): GitHubDashboardResponse => {
  const auth = getGitHubAuthState();
  const currentRepoSlug = resolveCurrentRepoSlug();
  if (auth.authState !== "ready") {
    return {
      ready: false,
      authState: auth.authState,
      viewerLogin: auth.viewerLogin,
      currentRepoSlug,
      currentRepoPullRequests: [],
      reviewRequests: [],
      authoredPullRequests: [],
      message: auth.message,
    };
  }

  return {
    ready: true,
    authState: auth.authState,
    viewerLogin: auth.viewerLogin,
    currentRepoSlug,
    currentRepoPullRequests: currentRepoSlug ? loadRepoPullRequests(currentRepoSlug) : [],
    reviewRequests: loadSearchResults([
      "search",
      "prs",
      "--review-requested",
      "@me",
      "--state",
      "open",
      "--limit",
      "25",
      "--json",
      "number,title,url,author,repository,updatedAt,isDraft,labels",
    ]),
    authoredPullRequests: loadSearchResults([
      "search",
      "prs",
      "--author",
      "@me",
      "--state",
      "open",
      "--limit",
      "25",
      "--json",
      "number,title,url,author,repository,updatedAt,isDraft,labels",
    ]),
    message: null,
  };
};

export const loadGitHubPullRequestDetail = (params: {
  repo: string;
  number: number;
}): GitHubDetailResponse => {
  const auth = getGitHubAuthState();
  const currentRepoSlug = resolveCurrentRepoSlug();
  if (auth.authState !== "ready") {
    return {
      ready: false,
      authState: auth.authState,
      viewerLogin: auth.viewerLogin,
      currentRepoSlug,
      pullRequest: null,
      message: auth.message,
    };
  }
  return {
    ready: true,
    authState: auth.authState,
    viewerLogin: auth.viewerLogin,
    currentRepoSlug,
    pullRequest: loadPullRequestDetail(params.repo, params.number),
    message: null,
  };
};

export const submitGitHubPullRequestReview = (params: {
  repo: string;
  number: number;
  action: GitHubReviewAction;
  body?: string | null;
}) => {
  const auth = getGitHubAuthState();
  if (auth.authState !== "ready") {
    throw new Error(auth.message ?? "GitHub CLI is not ready.");
  }

  const args = ["pr", "review", String(params.number), "--repo", params.repo];
  if (params.action === "APPROVE") {
    args.push("--approve");
  } else if (params.action === "REQUEST_CHANGES") {
    args.push("--request-changes");
  } else {
    args.push("--comment");
  }

  const body =
    params.body?.trim() ||
    (params.action === "COMMENT"
      ? "Reviewed in Claw3D."
      : params.action === "REQUEST_CHANGES"
        ? "Please address the requested updates from Claw3D."
        : "");
  if (body) {
    args.push("--body", body);
  }

  const result = runCommand("gh", args, { maxBuffer: DEFAULT_MAX_BUFFER });
  if (result.status !== 0) {
    throw new Error(
      extractCommandMessage(
        result.stderr,
        result.stdout,
        "Failed to submit the GitHub review.",
      ),
    );
  }

  return {
    ok: true,
    message:
      params.action === "APPROVE"
        ? "Pull request approved."
        : params.action === "REQUEST_CHANGES"
          ? "Requested changes on pull request."
          : "Review comment submitted.",
  };
};

const resolvePullRequestHeadOid = (repo: string, number: number): string => {
  const oid = runTextCommand(
    "gh",
    [
      "pr",
      "view",
      String(number),
      "--repo",
      repo,
      "--json",
      "headRefOid",
      "--jq",
      ".headRefOid",
    ],
    "gh pr view headRefOid",
  ).trim();
  if (!oid) {
    throw new Error("Unable to determine the latest pull request commit.");
  }
  return oid;
};

export const submitGitHubInlineComment = (params: {
  repo: string;
  number: number;
  path: string;
  line: number;
  side: GitHubInlineCommentSide;
  body: string;
  commitId?: string | null;
}) => {
  const auth = getGitHubAuthState();
  if (auth.authState !== "ready") {
    throw new Error(auth.message ?? "GitHub CLI is not ready.");
  }

  const trimmedBody = params.body.trim();
  if (!trimmedBody) {
    throw new Error("Comment body is required.");
  }

  const commitId = params.commitId?.trim() || resolvePullRequestHeadOid(params.repo, params.number);
  const result = runCommand(
    "gh",
    [
      "api",
      `repos/${params.repo}/pulls/${params.number}/comments`,
      "--method",
      "POST",
      "-f",
      `body=${trimmedBody}`,
      "-f",
      `commit_id=${commitId}`,
      "-f",
      `path=${params.path}`,
      "-F",
      `line=${params.line}`,
      "-f",
      `side=${params.side}`,
    ],
    { maxBuffer: DEFAULT_MAX_BUFFER },
  );

  if (result.status !== 0) {
    throw new Error(
      extractCommandMessage(
        result.stderr,
        result.stdout,
        "Failed to submit the GitHub inline comment.",
      ),
    );
  }

  return {
    ok: true,
    message: "Inline comment submitted.",
  };
};
