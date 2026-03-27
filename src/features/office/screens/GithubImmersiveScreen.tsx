"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import {
  ExternalLink,
  Github,
  RefreshCw,
  ShieldCheck,
  ShieldX,
  MessageSquare,
} from "lucide-react";
import { RunningAvatarLoader } from "@/features/agents/components/RunningAvatarLoader";

import type {
  GitHubDashboardResponse,
  GitHubDetailResponse,
  GitHubInlineCommentSide,
  GitHubPullRequestDetail,
  GitHubPullRequestSummary,
  GitHubReviewAction,
} from "@/lib/office/github";
import { resolveSkillMarketplaceMetadata } from "@/lib/skills/marketplace";
import {
  buildSkillMissingDetails,
  deriveSkillReadinessState,
  type SkillReadinessState,
} from "@/lib/skills/presentation";
import type { SkillStatusEntry } from "@/lib/skills/types";

import { FileDiffModal } from "./github/FileDiffModal";
import { useBrowserPreview } from "./github/useBrowserPreview";
import {
  GITHUB_RECORDING_PRIVACY_MASK_ACTIVE,
  formatRelativeTime,
  maskGitHubRecordingText,
  summarizeChecksTone,
} from "./github/utils";

type GithubImmersiveScreenProps = {
  agentName?: string | null;
  githubSkill?: SkillStatusEntry | null;
  onOpenSetup?: () => void;
};

export function GithubImmersiveScreen({
  agentName,
  githubSkill = null,
  onOpenSetup,
}: GithubImmersiveScreenProps) {
  const [dashboard, setDashboard] = useState<GitHubDashboardResponse | null>(
    null,
  );
  const [detail, setDetail] = useState<GitHubPullRequestDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"queue" | "repo">("queue");
  const [selectedPr, setSelectedPr] = useState<GitHubPullRequestSummary | null>(
    null,
  );
  const [reviewBody, setReviewBody] = useState("");
  const [reviewBusyAction, setReviewBusyAction] =
    useState<GitHubReviewAction | null>(null);
  const [reviewMessage, setReviewMessage] = useState<string | null>(null);
  const [detailMode, setDetailMode] = useState<"summary" | "browser">(
    "summary",
  );
  const [selectedFilePath, setSelectedFilePath] = useState<string | null>(null);
  const requestIdRef = useRef(0);
  const detailRequestIdRef = useRef(0);

  const skillReadiness = useMemo<SkillReadinessState | null>(
    () => (githubSkill ? deriveSkillReadinessState(githubSkill) : null),
    [githubSkill],
  );
  const skillMissingDetails = useMemo(
    () => (githubSkill ? buildSkillMissingDetails(githubSkill) : []),
    [githubSkill],
  );
  const skillMetadata = useMemo(
    () => (githubSkill ? resolveSkillMarketplaceMetadata(githubSkill) : null),
    [githubSkill],
  );

  const refreshDashboard = useCallback(async () => {
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/office/github", { cache: "no-store" });
      const payload = (await response.json()) as GitHubDashboardResponse & {
        error?: string;
      };
      if (!response.ok) {
        throw new Error(
          payload.error?.trim() || "Unable to load GitHub dashboard.",
        );
      }
      if (requestIdRef.current !== requestId) return;
      setDashboard(payload);
      setSelectedPr((current) => {
        if (!current) {
          return (
            payload.reviewRequests[0] ??
            payload.currentRepoPullRequests[0] ??
            payload.authoredPullRequests[0] ??
            null
          );
        }
        return (
          [
            ...payload.reviewRequests,
            ...payload.currentRepoPullRequests,
            ...payload.authoredPullRequests,
          ].find(
            (entry) =>
              entry.repo === current.repo && entry.number === current.number,
          ) ?? current
        );
      });
    } catch (error) {
      if (requestIdRef.current !== requestId) return;
      setDashboard(null);
      setError(
        error instanceof Error
          ? error.message
          : "Unable to load GitHub dashboard.",
      );
    } finally {
      if (requestIdRef.current === requestId) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    void refreshDashboard();
  }, [refreshDashboard]);

  const loadDetail = useCallback(
    async (summary: GitHubPullRequestSummary | null) => {
      if (!summary) {
        detailRequestIdRef.current += 1;
        setDetail(null);
        setSelectedFilePath(null);
        return;
      }
      const requestId = detailRequestIdRef.current + 1;
      detailRequestIdRef.current = requestId;
      setDetailLoading(true);
      try {
        const params = new URLSearchParams({
          repo: summary.repo,
          number: String(summary.number),
        });
        const response = await fetch(
          `/api/office/github?${params.toString()}`,
          {
            cache: "no-store",
          },
        );
        const payload = (await response.json()) as GitHubDetailResponse & {
          error?: string;
        };
        if (!response.ok) {
          throw new Error(
            payload.error?.trim() || "Unable to load pull request details.",
          );
        }
        if (detailRequestIdRef.current !== requestId) return;
        setDetail(payload.pullRequest);
        setSelectedFilePath(null);
      } catch (error) {
        if (detailRequestIdRef.current !== requestId) return;
        setDetail(null);
        setSelectedFilePath(null);
        setError(
          error instanceof Error
            ? error.message
            : "Unable to load pull request details.",
        );
      } finally {
        if (detailRequestIdRef.current === requestId) {
          setDetailLoading(false);
        }
      }
    },
    [],
  );

  useEffect(() => {
    void loadDetail(selectedPr);
  }, [loadDetail, selectedPr]);

  const browserPreview = useBrowserPreview(
    detail?.url ?? null,
    detailMode === "browser" && !GITHUB_RECORDING_PRIVACY_MASK_ACTIVE,
  );

  const queueEntries = useMemo(
    () =>
      dashboard
        ? [
            ...dashboard.reviewRequests,
            ...dashboard.authoredPullRequests,
          ].filter(
            (entry, index, list) =>
              list.findIndex(
                (candidate) =>
                  candidate.repo === entry.repo &&
                  candidate.number === entry.number,
              ) === index,
          )
        : [],
    [dashboard],
  );

  const activeList =
    activeTab === "queue"
      ? queueEntries
      : (dashboard?.currentRepoPullRequests ?? []);
  const currentRepoLabel = useMemo(() => {
    const slug = dashboard?.currentRepoSlug?.trim();
    if (!slug) return "No git remote";
    const segments = slug.split("/").filter(Boolean);
    return maskGitHubRecordingText(segments.at(-1) ?? slug);
  }, [dashboard?.currentRepoSlug]);
  const isInitialLoading = loading && dashboard === null && !error;
  const selectedFile = useMemo(
    () => detail?.files.find((file) => file.path === selectedFilePath) ?? null,
    [detail?.files, selectedFilePath],
  );

  useEffect(() => {
    if (!selectedFile) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setSelectedFilePath(null);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedFile]);

  const handleSelectPr = useCallback(
    (summary: GitHubPullRequestSummary, tab: "queue" | "repo") => {
      setActiveTab(tab);
      setSelectedPr(summary);
      setSelectedFilePath(null);
      setReviewBody("");
      setReviewMessage(null);
    },
    [],
  );

  const handleSubmitReview = useCallback(
    async (action: GitHubReviewAction) => {
      if (!detail) return;
      setReviewBusyAction(action);
      setReviewMessage(null);
      setError(null);
      try {
        const response = await fetch("/api/office/github", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            repo: detail.repo,
            number: detail.number,
            action,
            body: reviewBody,
          }),
        });
        const payload = (await response.json()) as {
          error?: string;
          message?: string;
        };
        if (!response.ok) {
          throw new Error(
            payload.error?.trim() || "Unable to submit GitHub review.",
          );
        }
        setReviewMessage(payload.message?.trim() || "Review submitted.");
        setReviewBody("");
        await Promise.all([refreshDashboard(), loadDetail(selectedPr)]);
      } catch (error) {
        setError(
          error instanceof Error
            ? error.message
            : "Unable to submit GitHub review.",
        );
      } finally {
        setReviewBusyAction(null);
      }
    },
    [detail, loadDetail, refreshDashboard, reviewBody, selectedPr],
  );

  const handleSubmitInlineComment = useCallback(
    async (input: {
      repo: string;
      pullNumber: number;
      commitId: string | null;
      path: string;
      line: number;
      side: GitHubInlineCommentSide;
      body: string;
    }) => {
      const response = await fetch("/api/office/github", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          repo: input.repo,
          number: input.pullNumber,
          commitId: input.commitId,
          path: input.path,
          line: input.line,
          side: input.side,
          body: input.body,
        }),
      });
      const payload = (await response.json()) as { error?: string; message?: string };
      if (!response.ok) {
        const message =
          payload.error?.trim() || "Unable to submit the GitHub inline comment.";
        throw new Error(message);
      }
    },
    [],
  );

  const shouldBlockForSkillSetup =
    githubSkill !== null &&
    skillReadiness !== null &&
    skillReadiness !== "ready";

  if (shouldBlockForSkillSetup) {
    return (
      <div className="flex h-full flex-col bg-[#050816] text-white">
        <div className="border-b border-cyan-500/10 bg-[#071122] px-8 py-6">
          <div className="flex items-center gap-3 text-cyan-200">
            <Github className="h-6 w-6" />
            <div>
              <div className="text-[11px] uppercase tracking-[0.28em] text-cyan-200/70">
                Code Review Room
              </div>
              <div className="text-xl font-semibold">
                GitHub skill setup required.
              </div>
            </div>
          </div>
        </div>
        <div className="flex flex-1 items-center justify-center px-8">
          <div className="max-w-xl rounded-3xl border border-cyan-400/15 bg-[#081427] p-8 shadow-[0_30px_120px_rgba(0,0,0,0.55)]">
            <div className="mb-4 flex items-center gap-3 text-cyan-100">
              <ShieldX className="h-5 w-5 text-amber-300" />
              <span className="text-sm uppercase tracking-[0.24em] text-cyan-100/70">
                {skillMetadata?.tagline ??
                  "GitHub access is not ready for this agent."}
              </span>
            </div>
            <div className="text-2xl font-semibold text-white">
              {skillReadiness === "disabled-globally"
                ? "GitHub is disabled for this gateway."
                : skillReadiness === "unavailable"
                  ? "This agent cannot use the GitHub skill yet."
                  : "The GitHub skill still needs setup."}
            </div>
            <p className="mt-3 text-sm leading-6 text-cyan-100/72">
              Open the Skills panel to install or enable the bundled GitHub
              skill so agents can walk here and review pull requests through
              OpenClaw.
            </p>
            <div className="mt-5 space-y-2">
              {skillMissingDetails.length > 0 ? (
                skillMissingDetails.map((line) => (
                  <div
                    key={line}
                    className="rounded-2xl border border-white/6 bg-black/20 px-4 py-3 text-sm text-white/72"
                  >
                    {line}
                  </div>
                ))
              ) : (
                <div className="rounded-2xl border border-white/6 bg-black/20 px-4 py-3 text-sm text-white/72">
                  Enable the GitHub skill for the selected agent, then come back
                  to the code review room.
                </div>
              )}
            </div>
            {onOpenSetup ? (
              <button
                type="button"
                onClick={onOpenSetup}
                className="mt-6 inline-flex items-center gap-2 rounded-full border border-cyan-300/30 bg-cyan-300/10 px-5 py-2.5 text-sm font-medium text-cyan-100 transition-colors hover:border-cyan-200/50 hover:bg-cyan-300/18"
              >
                <ShieldCheck className="h-4 w-4" />
                Open Skills Setup
              </button>
            ) : null}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex h-full flex-col overflow-hidden bg-[radial-gradient(circle_at_top,#0f1b3d_0%,#060916_42%,#020409_100%)] text-white">
      <div className="border-b border-cyan-400/12 bg-[#06101f]/82 px-6 py-4 backdrop-blur-sm">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-cyan-300/18 bg-cyan-300/8">
              <Github className="h-5 w-5 text-cyan-100" />
            </div>
            <div>
              <div className="text-[11px] uppercase tracking-[0.28em] text-cyan-200/65">
                Code Review Room
              </div>
              <div className="text-lg font-semibold text-white">
                {agentName
                  ? `${agentName} is reviewing GitHub.`
                  : "GitHub review station."}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                void refreshDashboard();
                void loadDetail(selectedPr);
              }}
              className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[12px] text-white/72 transition-colors hover:border-white/20 hover:text-white"
            >
              {loading || detailLoading ? (
                <RunningAvatarLoader size={16} trackWidth={32} inline />
              ) : (
                <RefreshCw className="h-3.5 w-3.5" />
              )}
              Refresh
            </button>
            {dashboard?.viewerLogin ? (
              <div className="rounded-full border border-cyan-300/16 bg-cyan-300/8 px-3 py-1.5 text-[12px] text-cyan-100/90">
                @{maskGitHubRecordingText(dashboard.viewerLogin)}
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {error ? (
        <div className="mx-6 mt-4 rounded-2xl border border-rose-400/16 bg-rose-400/8 px-4 py-3 text-sm text-rose-100">
          {error}
        </div>
      ) : null}
      {reviewMessage ? (
        <div className="mx-6 mt-4 rounded-2xl border border-emerald-400/16 bg-emerald-400/8 px-4 py-3 text-sm text-emerald-100">
          {reviewMessage}
        </div>
      ) : null}
      {dashboard && !dashboard.ready && dashboard.message ? (
        <div className="mx-6 mt-4 rounded-2xl border border-amber-300/16 bg-amber-300/10 px-4 py-3 text-sm text-amber-100">
          {dashboard.message}
        </div>
      ) : null}

      {isInitialLoading ? (
        <div className="flex min-h-0 flex-1 items-center justify-center px-8 py-10">
          <div className="flex max-w-md flex-col items-center rounded-3xl border border-cyan-300/12 bg-[#081122]/78 px-8 py-10 text-center shadow-[0_20px_80px_rgba(0,0,0,0.38)]">
            <RunningAvatarLoader size={40} trackWidth={104} />
            <div className="mt-5 text-[11px] uppercase tracking-[0.28em] text-cyan-100/55">
              Loading GitHub
            </div>
            <div className="mt-2 text-lg font-semibold text-white">
              Fetching your review queue.
            </div>
            <div className="mt-2 text-sm text-white/58">
              Pull requests, repo metadata, and review details are loading now.
            </div>
          </div>
        </div>
      ) : (
        <div className="grid min-h-0 flex-1 grid-cols-[340px_minmax(0,1fr)] gap-0">
          <div className="flex min-h-0 flex-col border-r border-white/6 bg-[#081122]/72">
            <div className="grid grid-cols-2 gap-2 p-3">
              <button
                type="button"
                onClick={() => setActiveTab("queue")}
                className={`min-w-0 rounded-2xl px-4 py-2.5 text-left transition-colors ${
                  activeTab === "queue"
                    ? "border border-cyan-300/20 bg-cyan-300/12 text-white"
                    : "border border-white/6 bg-white/4 text-white/65 hover:text-white"
                }`}
              >
                <div className="text-[11px] uppercase tracking-[0.24em] text-white/50">
                  My Queue
                </div>
                <div className="mt-1 text-lg font-semibold leading-none">
                  {queueEntries.length}
                </div>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("repo")}
                className={`min-w-0 rounded-2xl px-4 py-2.5 text-left transition-colors ${
                  activeTab === "repo"
                    ? "border border-cyan-300/20 bg-cyan-300/12 text-white"
                    : "border border-white/6 bg-white/4 text-white/65 hover:text-white"
                }`}
              >
                <div className="text-[11px] uppercase tracking-[0.24em] text-white/50">
                  Current Repo
                </div>
                <div className="mt-1 break-words text-sm font-medium leading-5 text-white/85">
                  {currentRepoLabel}
                </div>
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">
              {loading ? (
                <div className="rounded-2xl border border-white/6 bg-white/4 px-4 py-4 text-sm text-white/55">
                  Loading pull requests.
                </div>
              ) : activeList.length === 0 ? (
                <div className="rounded-2xl border border-white/6 bg-white/4 px-4 py-4 text-sm text-white/55">
                  {activeTab === "queue"
                    ? "No review requests or authored pull requests found."
                    : "No open pull requests found for this repository."}
                </div>
              ) : (
                <div className="space-y-3">
                  {activeList.map((entry) => {
                    const isSelected =
                      selectedPr?.repo === entry.repo &&
                      selectedPr?.number === entry.number;
                    return (
                      <button
                        key={`${entry.repo}#${entry.number}`}
                        type="button"
                        onClick={() => handleSelectPr(entry, activeTab)}
                        className={`w-full rounded-2xl border px-4 py-4 text-left transition-colors ${
                          isSelected
                            ? "border-cyan-300/24 bg-cyan-300/10"
                            : "border-white/6 bg-white/4 hover:border-white/12 hover:bg-white/6"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="text-[11px] uppercase tracking-[0.24em] text-white/45">
                              {maskGitHubRecordingText(entry.repo)}
                            </div>
                            <div className="mt-1 text-sm font-semibold text-white">
                              #{entry.number} {maskGitHubRecordingText(entry.title)}
                            </div>
                          </div>
                          {entry.isDraft ? (
                            <span className="rounded-full border border-white/10 px-2 py-1 text-[10px] uppercase tracking-[0.2em] text-white/55">
                              Draft
                            </span>
                          ) : null}
                        </div>
                        <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-white/56">
                          <span>@{maskGitHubRecordingText(entry.author)}</span>
                          <span>{formatRelativeTime(entry.updatedAt)}</span>
                          {entry.statusSummary ? (
                            <span
                              className={summarizeChecksTone(
                                entry.statusSummary,
                              )}
                            >
                              {entry.statusSummary}
                            </span>
                          ) : null}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          <div className="min-h-0 overflow-hidden">
            {detailLoading ? (
              <div className="flex h-full items-center justify-center text-sm text-white/55">
                Loading pull request details.
              </div>
            ) : detail ? (
              <div className="grid h-full grid-cols-[minmax(0,1fr)_320px]">
                <div className="min-h-0 overflow-y-auto px-6 py-5">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="text-[11px] uppercase tracking-[0.26em] text-cyan-200/55">
                        {maskGitHubRecordingText(detail.repo)}
                      </div>
                      <div className="mt-1 text-2xl font-semibold text-white">
                        #{detail.number} {maskGitHubRecordingText(detail.title)}
                      </div>
                      <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-white/62">
                        <span>@{maskGitHubRecordingText(detail.author)}</span>
                        <span>{formatRelativeTime(detail.updatedAt)}</span>
                        {detail.reviewDecision ? (
                          <span>{detail.reviewDecision}</span>
                        ) : null}
                        {detail.mergeable ? (
                          <span>{detail.mergeable}</span>
                        ) : null}
                      </div>
                    </div>
                    <a
                      href={detail.url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex min-w-[96px] shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-full border border-white/10 bg-white/5 px-3 py-2 text-[12px] text-white/75 transition-colors hover:border-white/20 hover:text-white"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                      Open PR
                    </a>
                  </div>

                  <div className="mt-5 grid gap-4 md:grid-cols-3">
                    <div className="rounded-2xl border border-white/6 bg-white/4 px-4 py-4">
                      <div className="text-[11px] uppercase tracking-[0.24em] text-white/45">
                        Checks
                      </div>
                      <div className="mt-2 text-lg font-semibold text-white">
                        {detail.statusChecks.length}
                      </div>
                    </div>
                    <div className="rounded-2xl border border-white/6 bg-white/4 px-4 py-4">
                      <div className="text-[11px] uppercase tracking-[0.24em] text-white/45">
                        Files Changed
                      </div>
                      <div className="mt-2 text-lg font-semibold text-white">
                        {detail.files.length}
                      </div>
                    </div>
                    <div className="rounded-2xl border border-white/6 bg-white/4 px-4 py-4">
                      <div className="text-[11px] uppercase tracking-[0.24em] text-white/45">
                        Reviews
                      </div>
                      <div className="mt-2 text-lg font-semibold text-white">
                        {detail.reviews.length}
                      </div>
                    </div>
                  </div>

                  <div className="mt-5 rounded-3xl border border-cyan-400/10 bg-[#071223]/88 p-5">
                    <div className="space-y-4">
                      <div>
                        <div className="text-[11px] uppercase tracking-[0.24em] text-cyan-100/52">
                          Review Actions
                        </div>
                        <div className="mt-1 text-sm text-white/68">
                          Submit the review directly from the server room.
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => void handleSubmitReview("APPROVE")}
                          disabled={Boolean(reviewBusyAction)}
                          className="inline-flex h-11 items-center justify-center whitespace-nowrap rounded-full border border-emerald-300/24 bg-emerald-300/10 px-4 text-sm text-emerald-100 transition-colors hover:border-emerald-200/40 hover:bg-emerald-300/16 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {reviewBusyAction === "APPROVE"
                            ? "Approving..."
                            : "Approve"}
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            void handleSubmitReview("REQUEST_CHANGES")
                          }
                          disabled={Boolean(reviewBusyAction)}
                          className="inline-flex h-11 items-center justify-center whitespace-nowrap rounded-full border border-amber-300/24 bg-amber-300/10 px-4 text-xs text-amber-100 transition-colors hover:border-amber-200/40 hover:bg-amber-300/16 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {reviewBusyAction === "REQUEST_CHANGES"
                            ? "Requesting..."
                            : "Request Changes"}
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleSubmitReview("COMMENT")}
                          disabled={Boolean(reviewBusyAction)}
                          className="inline-flex h-11 items-center justify-center whitespace-nowrap rounded-full border border-cyan-300/24 bg-cyan-300/10 px-4 text-sm text-cyan-100 transition-colors hover:border-cyan-200/40 hover:bg-cyan-300/16 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {reviewBusyAction === "COMMENT"
                            ? "Sending..."
                            : "Comment"}
                        </button>
                      </div>
                    </div>
                    <textarea
                      value={reviewBody}
                      onChange={(event) => setReviewBody(event.target.value)}
                      placeholder="Add an approval note or request changes summary."
                      className="mt-4 h-28 w-full resize-none rounded-2xl border border-white/8 bg-black/22 px-4 py-3 text-sm text-white outline-none placeholder:text-white/28"
                    />
                  </div>

                  <div className="mt-5 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setDetailMode("summary")}
                      className={`rounded-full px-3 py-1.5 text-[12px] transition-colors ${
                        detailMode === "summary"
                          ? "border border-white/10 bg-white/10 text-white"
                          : "border border-white/6 bg-white/4 text-white/58 hover:text-white"
                      }`}
                    >
                      Summary
                    </button>
                    <button
                      type="button"
                      onClick={() => setDetailMode("browser")}
                      className={`rounded-full px-3 py-1.5 text-[12px] transition-colors ${
                        detailMode === "browser"
                          ? "border border-white/10 bg-white/10 text-white"
                          : "border border-white/6 bg-white/4 text-white/58 hover:text-white"
                      }`}
                    >
                      Browser Preview
                    </button>
                  </div>

                  {detailMode === "summary" ? (
                    <>
                      <div className="mt-5 rounded-3xl border border-white/6 bg-white/4 p-5">
                        <div className="text-[11px] uppercase tracking-[0.24em] text-white/45">
                          Description
                        </div>
                        <div className="mt-3 whitespace-pre-wrap text-sm leading-6 text-white/78">
                          {maskGitHubRecordingText(detail.body) ||
                            "No pull request description."}
                        </div>
                      </div>

                      <div className="mt-5 rounded-3xl border border-white/6 bg-white/4 p-5">
                        <div className="text-[11px] uppercase tracking-[0.24em] text-white/45">
                          Diff Preview
                        </div>
                        <div className="mt-1 text-sm text-white/72">
                          Full pull request diff preview.
                        </div>
                        <pre className="mt-3 max-h-[320px] overflow-auto rounded-2xl border border-white/6 bg-black/28 p-4 text-[12px] leading-5 text-cyan-100/86">
                          {maskGitHubRecordingText(detail.diff) ||
                            "Diff preview unavailable."}
                        </pre>
                        {detail.diffTruncated ? (
                          <div className="mt-2 text-[11px] text-white/45">
                            Diff preview truncated for performance.
                          </div>
                        ) : null}
                      </div>
                    </>
                  ) : (
                    <div className="mt-5 rounded-3xl border border-white/6 bg-white/4 p-5">
                      <div className="mb-3 text-[11px] uppercase tracking-[0.24em] text-white/45">
                        Browser Preview
                      </div>
                      {GITHUB_RECORDING_PRIVACY_MASK_ACTIVE ? (
                        <div className="rounded-2xl border border-white/6 bg-black/20 px-4 py-5 text-sm text-white/55">
                          Browser preview is temporarily disabled so the screen
                          recording does not reveal the real GitHub username.
                        </div>
                      ) : browserPreview.loading ? (
                        <div className="rounded-2xl border border-white/6 bg-black/20 px-4 py-5 text-sm text-white/55">
                          Capturing GitHub preview.
                        </div>
                      ) : browserPreview.mediaUrl ? (
                        <Image
                          src={browserPreview.mediaUrl}
                          alt={`Preview of ${detail.url}`}
                          width={1280}
                          height={720}
                          unoptimized
                          className="h-auto w-full rounded-2xl border border-white/8 object-cover"
                        />
                      ) : (
                        <div className="rounded-2xl border border-white/6 bg-black/20 px-4 py-5 text-sm text-white/55">
                          {browserPreview.error ??
                            "Browser preview unavailable on this setup."}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="min-h-0 overflow-y-auto border-l border-white/6 bg-[#060d19]/86 px-4 py-5">
                  <div className="text-[11px] uppercase tracking-[0.24em] text-white/42">
                    Checks
                  </div>
                  <div className="mt-3 space-y-2">
                    {detail.statusChecks.length > 0 ? (
                      detail.statusChecks.map((check) => (
                        <div
                          key={`${check.name}-${check.detailsUrl ?? "local"}`}
                          className="rounded-2xl border border-white/6 bg-white/4 px-3 py-3"
                        >
                          <div className="text-sm font-medium text-white">
                            {check.name}
                          </div>
                          <div className="mt-1 text-[12px] text-white/55">
                            {[check.status, check.conclusion, check.workflow]
                              .filter(Boolean)
                              .join(" · ") || "No status"}
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="rounded-2xl border border-white/6 bg-white/4 px-3 py-3 text-sm text-white/55">
                        No checks reported.
                      </div>
                    )}
                  </div>

                  <div className="mt-6 text-[11px] uppercase tracking-[0.24em] text-white/42">
                    Files
                  </div>
                  <div className="mt-3 space-y-2">
                    {detail.files.slice(0, 12).map((file) => (
                      <button
                        key={file.path}
                        type="button"
                        onClick={() => setSelectedFilePath(file.path)}
                        className={`w-full rounded-2xl border px-3 py-3 text-left transition-colors ${
                          selectedFile?.path === file.path
                            ? "border-cyan-300/24 bg-cyan-300/10"
                            : "border-white/6 bg-white/4 hover:border-white/12 hover:bg-white/6"
                        }`}
                      >
                        <div className="truncate text-sm text-white">
                          {file.path}
                        </div>
                        <div className="mt-1 text-[12px] text-white/55">
                          +{file.additions} / -{file.deletions}
                        </div>
                        {file.status ? (
                          <div className="mt-1 text-[11px] uppercase tracking-[0.16em] text-white/40">
                            {file.status}
                          </div>
                        ) : null}
                      </button>
                    ))}
                  </div>

                  <div className="mt-6 text-[11px] uppercase tracking-[0.24em] text-white/42">
                    Recent Reviews
                  </div>
                  <div className="mt-3 space-y-2">
                    {detail.reviews.slice(0, 6).length > 0 ? (
                      detail.reviews.slice(0, 6).map((review, index) => (
                        <div
                          key={`${review.author}-${review.submittedAt ?? index}`}
                          className="rounded-2xl border border-white/6 bg-white/4 px-3 py-3"
                        >
                          <div className="flex items-center gap-2 text-sm text-white">
                            <MessageSquare className="h-3.5 w-3.5 text-cyan-200/70" />
                            <span>@{maskGitHubRecordingText(review.author)}</span>
                          </div>
                          <div className="mt-1 text-[12px] text-white/55">
                            {[review.state, review.submittedAt]
                              .filter(Boolean)
                              .join(" · ")}
                          </div>
                          {review.body ? (
                            <div className="mt-2 text-[12px] leading-5 text-white/68">
                              {maskGitHubRecordingText(review.body)}
                            </div>
                          ) : null}
                        </div>
                      ))
                    ) : (
                      <div className="rounded-2xl border border-white/6 bg-white/4 px-3 py-3 text-sm text-white/55">
                        No reviews yet.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex h-full items-center justify-center px-8 text-center text-sm text-white/55">
                Select a pull request to inspect its checks, diff, and review
                actions.
              </div>
            )}
          </div>
        </div>
      )}
      {selectedFile && detail ? (
        <FileDiffModal
          key={selectedFile.path}
          file={selectedFile}
          repo={detail.repo}
          pullNumber={detail.number}
          commitId={detail.headRefOid}
          onSubmitInlineComment={handleSubmitInlineComment}
          onClose={() => setSelectedFilePath(null)}
        />
      ) : null}
    </div>
  );
}
