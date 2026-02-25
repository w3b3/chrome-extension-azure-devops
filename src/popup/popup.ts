import type { PRSnapshot, SeenPRRecord } from "../types/state.js";
import { getSettings } from "../utils/storage.js";
import {
  getSnapshots,
  getLastPollTimestamp,
  getSeenPRs,
  getMergedCelebrationAckAt,
  saveMergedCelebrationAckAt,
} from "../utils/storage.js";
import { prUrl } from "../utils/url-builder.js";

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
type StepState = "failed" | "waiting" | "done" | "neutral";
type TriageState = "blocked" | "waiting" | "ready" | "draft";

interface VoteCounts {
  approved: number;
  rejected: number;
  waiting: number;
}

interface CheckCounts {
  failed: number;
  pending: number;
  passed: number;
  total: number;
}

interface PipelineStep {
  label: "Checks" | "Reviews" | "Mergeability";
  state: StepState;
  icon: string;
  text: string;
  ariaLabel: string;
}

interface PRViewModel {
  triage: TriageState;
  actionLine: string;
  details: string[];
  pipeline: PipelineStep[];
  primaryActionLabel: string;
  primaryActionHint: string;
}

let toastTimer: number | undefined;
const RECENT_MERGED_WINDOW_MS = 24 * 60 * 60 * 1000;
const MAX_RECENT_MERGED_ITEMS = 3;

async function render(): Promise<void> {
  const settings = await getSettings();
  renderRefreshInterval(settings.pollIntervalMinutes);

  if (settings.projects.length === 0) {
    $("no-config").style.display = "block";
    $("pr-list").style.display = "none";
    return;
  }

  $("no-config").style.display = "none";

  const snapshots = await getSnapshots();
  const seenPRs = await getSeenPRs();
  const lastPoll = await getLastPollTimestamp();

  renderTimestamp(lastPoll);
  renderRecentMerged(seenPRs);
  await maybeShowMergedCelebration(seenPRs);

  if (snapshots.length === 0) {
    $("empty-list").style.display = "block";
    $("pr-list").style.display = "none";
    return;
  }

  $("empty-list").style.display = "none";
  $("pr-list").style.display = "block";
  renderPRList(snapshots);
}

function renderTimestamp(ts: number): void {
  const el = $("last-updated");
  if (ts === 0) {
    el.textContent = "Never polled";
    return;
  }
  const ago = Math.round((Date.now() - ts) / 1000 / 60);
  el.textContent = ago < 1 ? "Just now" : `${ago}m ago`;
}

function renderRefreshInterval(minutes: number): void {
  $("refresh-interval").textContent = `Auto-refresh: ${minutes}m`;
}

function renderRecentMerged(seenPRs: SeenPRRecord[]): void {
  const container = $("merged-history");
  const now = Date.now();
  const recentMerged = seenPRs
    .filter((record) => record.lastKnownState === "merged" && now - record.lastSeenAt <= RECENT_MERGED_WINDOW_MS)
    .sort((a, b) => b.lastSeenAt - a.lastSeenAt)
    .slice(0, MAX_RECENT_MERGED_ITEMS);

  if (recentMerged.length === 0) {
    container.style.display = "none";
    container.innerHTML = "";
    return;
  }

  container.style.display = "block";
  container.innerHTML = `
    <div class="merged-header">✅ Recently merged</div>
    <div class="merged-list">
      ${recentMerged
        .map((record) => {
          const url = prUrl(
            record.organization,
            record.project,
            record.repositoryName,
            record.pullRequestId,
          );
          return `
            <button class="merged-item" data-url="${esc(url)}" aria-label="Open merged pull request ${record.pullRequestId}">
              <span class="merged-title">PR #${record.pullRequestId} &middot; ${esc(record.title)}</span>
              <span class="merged-ago">${esc(formatAgo(record.lastSeenAt))}</span>
            </button>
          `;
        })
        .join("")}
    </div>
  `;

  container.querySelectorAll(".merged-item").forEach((el) => {
    el.addEventListener("click", () => {
      const url = (el as HTMLElement).dataset["url"];
      if (url) {
        void openUrl(url, "Opening merged PR...");
      }
    });
  });
}

async function maybeShowMergedCelebration(seenPRs: SeenPRRecord[]): Promise<void> {
  const lastAck = await getMergedCelebrationAckAt();
  const unseenMerged = seenPRs
    .filter((record) => record.lastKnownState === "merged" && record.lastSeenAt > lastAck)
    .sort((a, b) => b.lastSeenAt - a.lastSeenAt);

  if (unseenMerged.length === 0) {
    renderMergeCelebrationBar();
    return;
  }

  const latestSeenAt = unseenMerged[0]?.lastSeenAt ?? lastAck;
  await saveMergedCelebrationAckAt(latestSeenAt);
  await refreshBadgeIcon();

  if (unseenMerged.length === 1 && unseenMerged[0]) {
    renderMergeCelebrationBar(`🎉 Nice merge! PR #${unseenMerged[0].pullRequestId} just landed.`);
    return;
  }

  renderMergeCelebrationBar(`🎉 Great momentum — ${unseenMerged.length} PRs merged since your last view.`);
}

function renderMergeCelebrationBar(message?: string): void {
  const bar = $("merge-celebration-bar");
  if (!message) {
    bar.style.display = "none";
    bar.textContent = "";
    return;
  }

  bar.textContent = message;
  bar.style.display = "block";
}

async function refreshBadgeIcon(): Promise<void> {
  await new Promise<void>((resolve) => {
    chrome.runtime.sendMessage({ type: "refresh-badge" }, () => resolve());
  });
}

function renderPRList(snapshots: PRSnapshot[]): void {
  const container = $("pr-list");

  // Sort: attention-needed first, then by creation date desc
  const sorted = [...snapshots].sort((a, b) => {
    const aAttn = needsAttention(a) ? 0 : 1;
    const bAttn = needsAttention(b) ? 0 : 1;
    if (aAttn !== bAttn) return aAttn - bAttn;
    return new Date(b.creationDate).getTime() - new Date(a.creationDate).getTime();
  });

  container.innerHTML = sorted.map((pr) => renderPRItem(pr)).join("");

  // Click handlers
  container.querySelectorAll(".pr-item").forEach((el) => {
    el.addEventListener("click", () => {
      const url = (el as HTMLElement).dataset["url"];
      if (url) {
        void openUrl(url, "Opening PR...");
      }
    });
    el.addEventListener("keydown", (event) => {
      if (!(event instanceof KeyboardEvent)) return;
      if (event.key !== "Enter" && event.key !== " ") return;

      event.preventDefault();
      const url = (el as HTMLElement).dataset["url"];
      if (url) {
        void openUrl(url, "Opening PR...");
      }
    });
  });

  container.querySelectorAll(".pr-action-btn").forEach((el) => {
    el.addEventListener("click", (event) => {
      event.stopPropagation();
      const button = el as HTMLButtonElement;
      const action = button.dataset["action"];
      const actionUrl = button.dataset["url"];

      if (action === "open" && actionUrl) {
        const hint = button.dataset["hint"] ?? "Opening PR...";
        void openUrl(actionUrl, hint);
      } else if (action === "refresh") {
        showToast("Refreshing status...");
        void pollNow();
      }
    });
  });
}

function renderPRItem(pr: PRSnapshot): string {
  const url = prUrl(pr.organization, pr.project, pr.repositoryName, pr.pullRequestId);
  const model = toViewModel(pr);
  const statusClass = getStatusBarClass(pr);
  const branch = shortenRef(pr.sourceRefName);
  const target = shortenRef(pr.targetRefName);
  const triageLabel = model.triage === "ready" ? "Ready" : model.triage === "blocked" ? "Blocked" : model.triage === "draft" ? "Draft" : "Waiting";
  const secondaryAction =
    model.primaryActionLabel === "Open PR"
      ? `<button class="pr-action-btn" data-action="refresh">Refresh status</button>`
      : `<button class="pr-action-btn" data-action="open" data-url="${esc(url)}" data-hint="Opening PR...">Open PR</button>`;

  return `
    <div class="pr-item" data-url="${esc(url)}" role="button" tabindex="0" aria-label="Open pull request ${pr.pullRequestId}">
      <div class="pr-status-bar ${statusClass}"></div>
      <div class="pr-content">
        <div class="pr-top">
          <div class="pr-title" title="${esc(pr.title)}">${esc(pr.title)}</div>
          <span class="triage-badge ${model.triage}" aria-label="${esc(`${triageLabel}: ${model.actionLine}`)}">${triageLabel}</span>
        </div>
        <div class="pr-meta">
          #${pr.pullRequestId} &middot; ${esc(pr.createdByName)} &middot; ${esc(branch)} &rarr; ${esc(target)}
        </div>
        <div class="pr-action-line">${esc(model.actionLine)}</div>
        <div class="pipeline">
          <div class="pipeline-grid">
            ${model.pipeline
              .map(
                (step) => `
                  <div class="pipeline-step">
                    <span class="pipeline-label">${step.label}</span>
                    <span class="pipeline-pill ${step.state}" aria-label="${esc(step.ariaLabel)}">${esc(`${step.icon} ${step.text}`)}</span>
                  </div>
                `,
              )
              .join("")}
          </div>
        </div>
        ${
          model.details.length > 0
            ? `<div class="pr-details">${model.details.map((detail) => `<div>&bull; ${esc(detail)}</div>`).join("")}</div>`
            : ""
        }
        <div class="pr-project">${esc(pr.organization)}/${esc(pr.project)}/${esc(pr.repositoryName)}</div>
        <div class="pr-hint">Click card to open PR</div>
        <div class="pr-actions">
          <button class="pr-action-btn primary" data-action="open" data-url="${esc(url)}" data-hint="${esc(model.primaryActionHint)}" aria-label="${esc(model.primaryActionLabel)}">${esc(model.primaryActionLabel)}</button>
          ${secondaryAction}
        </div>
      </div>
    </div>
  `;
}

function getStatusBarClass(pr: PRSnapshot): string {
  const checks = Object.values(pr.statusChecks);
  if (pr.mergeStatus === "conflicts") return "fail";
  if (checks.some((s) => s === "failed" || s === "error")) return "fail";
  if (checks.some((s) => s === "pending")) return "pending";
  if (checks.length > 0 && checks.every((s) => s === "succeeded")) return "ok";
  if (Object.values(pr.reviewerVotes).some((v) => v === -10)) return "fail";
  return "pending";
}

function toViewModel(pr: PRSnapshot): PRViewModel {
  const votes = getVoteCounts(pr);
  const checks = getCheckCounts(pr);
  const hasBlocker = checks.failed > 0 || votes.rejected > 0 || pr.mergeStatus === "conflicts";

  let triage: TriageState = "waiting";
  let actionLine = "Waiting for updates";

  if (pr.isDraft) {
    triage = "draft";
    actionLine = "Draft PR is not ready for review";
  } else if (hasBlocker) {
    triage = "blocked";
    actionLine = "Action needed: resolve blocking issues";
  } else if (votes.waiting > 0 && pr.isAuthor) {
    triage = "waiting";
    actionLine = `Needs response: ${votes.waiting} reviewer${plural(votes.waiting)} waiting for author`;
  } else if (votes.waiting > 0) {
    triage = "waiting";
    actionLine = "Waiting on reviewers";
  } else if (checks.pending > 0) {
    triage = "waiting";
    actionLine = `Waiting: ${checks.pending} running check${plural(checks.pending)}`;
  } else {
    triage = "ready";
    actionLine = "Ready to merge (no blockers detected)";
  }

  const details: string[] = [];
  if (checks.failed > 0) details.push(`${checks.failed} required check${plural(checks.failed)} failed`);
  if (votes.rejected > 0) details.push(`${votes.rejected} reviewer${plural(votes.rejected)} requested changes`);
  if (votes.waiting > 0) {
    details.push(
      pr.isAuthor
        ? `${votes.waiting} reviewer${plural(votes.waiting)} waiting for author`
        : `${votes.waiting} reviewer${plural(votes.waiting)} pending`,
    );
  }
  if (pr.mergeStatus === "conflicts") details.push("Merge conflicts detected");

  const pipeline: PipelineStep[] = [
    toCheckStep(checks),
    toReviewStep(votes, pr.isAuthor),
    toMergeStep(pr),
  ];

  const primaryActionLabel =
    checks.failed > 0
      ? "View failed checks"
      : votes.rejected > 0
        ? "Open reviewer feedback"
        : votes.waiting > 0 && pr.isAuthor
          ? "Respond to reviewers"
          : "Open PR";
  const primaryActionHint = primaryActionLabel === "Open PR" ? "Opening PR..." : `${primaryActionLabel}...`;

  return {
    triage,
    actionLine,
    details: details.slice(0, 2),
    pipeline,
    primaryActionLabel,
    primaryActionHint,
  };
}

function toCheckStep(checks: CheckCounts): PipelineStep {
  if (checks.failed > 0) return { label: "Checks", state: "failed", icon: "X", text: "Failed", ariaLabel: "Checks failed" };
  if (checks.pending > 0) return { label: "Checks", state: "waiting", icon: "...", text: "Running", ariaLabel: "Checks running" };
  if (checks.total > 0 && checks.passed === checks.total)
    return { label: "Checks", state: "done", icon: "OK", text: "Passed", ariaLabel: "All checks passed" };
  return { label: "Checks", state: "neutral", icon: "-", text: "No required checks", ariaLabel: "No required checks" };
}

function toReviewStep(votes: VoteCounts, isAuthor: boolean): PipelineStep {
  if (votes.rejected > 0) {
    return { label: "Reviews", state: "failed", icon: "!", text: "Changes requested", ariaLabel: "Review changes requested" };
  }
  if (votes.waiting > 0) {
    const text = isAuthor ? `${votes.waiting} waiting for author` : "Waiting on reviewers";
    return {
      label: "Reviews",
      state: "waiting",
      icon: "!",
      text,
      ariaLabel: `Reviews: ${text}`,
    };
  }
  if (votes.approved > 0) return { label: "Reviews", state: "done", icon: "OK", text: "Approved", ariaLabel: "Reviews approved" };
  return { label: "Reviews", state: "neutral", icon: "-", text: "No votes", ariaLabel: "No review votes" };
}

function toMergeStep(pr: PRSnapshot): PipelineStep {
  if (pr.mergeStatus === "conflicts") {
    return { label: "Mergeability", state: "failed", icon: "!", text: "Conflicts", ariaLabel: "Merge conflicts detected" };
  }
  if (pr.mergeStatus === "succeeded") {
    return { label: "Mergeability", state: "done", icon: "OK", text: "Clean", ariaLabel: "No merge conflicts" };
  }
  return { label: "Mergeability", state: "waiting", icon: "...", text: "Checking", ariaLabel: "Mergeability checking" };
}

function getVoteCounts(pr: PRSnapshot): VoteCounts {
  const votes = Object.values(pr.reviewerVotes);
  return {
    approved: votes.filter((v) => v === 10).length,
    rejected: votes.filter((v) => v === -10).length,
    waiting: votes.filter((v) => v === -5).length,
  };
}

function getCheckCounts(pr: PRSnapshot): CheckCounts {
  const checks = Object.values(pr.statusChecks);
  return {
    failed: checks.filter((s) => s === "failed" || s === "error").length,
    pending: checks.filter((s) => s === "pending").length,
    passed: checks.filter((s) => s === "succeeded").length,
    total: checks.length,
  };
}

function plural(count: number): string {
  return count === 1 ? "" : "s";
}

function formatAgo(timestamp: number): string {
  const diffMs = Date.now() - timestamp;
  const minutes = Math.floor(diffMs / (60 * 1000));
  if (minutes < 1) return "Just merged";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

async function pollNow(): Promise<void> {
  $("refresh-btn").classList.add("refreshing");
  await new Promise<void>((resolve) => {
    chrome.runtime.sendMessage({ type: "poll-now" }, () => resolve());
  });
  $("refresh-btn").classList.remove("refreshing");
  await render();
}

async function openUrl(url: string, toastMessage: string): Promise<void> {
  showToast(toastMessage);
  await chrome.tabs.create({ url });
}

function showToast(message: string, durationMs = 1200): void {
  const toast = $("action-toast");
  toast.textContent = message;
  toast.classList.add("visible");

  if (toastTimer !== undefined) {
    window.clearTimeout(toastTimer);
  }
  toastTimer = window.setTimeout(() => {
    toast.classList.remove("visible");
  }, durationMs);
}

function needsAttention(pr: PRSnapshot): boolean {
  if (pr.mergeStatus === "conflicts" && pr.isAuthor) return true;
  if (Object.values(pr.statusChecks).some((s) => s === "failed" || s === "error") && pr.isAuthor)
    return true;
  if (Object.values(pr.reviewerVotes).some((v) => v === -10)) return true;
  return false;
}

function shortenRef(ref: string): string {
  return ref.replace("refs/heads/", "");
}

function esc(str: string): string {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

// Refresh button
$<HTMLButtonElement>("refresh-btn").addEventListener("click", () => {
  void pollNow();
});

// Settings button
$<HTMLButtonElement>("settings-btn").addEventListener("click", () => {
  void chrome.runtime.openOptionsPage();
});

// Open options from empty state
const openOptionsBtn = document.getElementById("open-options");
if (openOptionsBtn) {
  openOptionsBtn.addEventListener("click", () => {
    void chrome.runtime.openOptionsPage();
  });
}

// Initial render
void render();
