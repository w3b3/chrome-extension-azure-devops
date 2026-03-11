import type { PRSnapshot, SeenPRRecord } from "../types/state.js";
import type { ProjectConfig } from "../types/settings.js";
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
const JIRA_KEY_RE = /\b([A-Z][A-Z0-9]+-\d+)\b/;

const SVG_CHECK = '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>';
const SVG_X = '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';
const SVG_CLOCK = '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>';
const SVG_MINUS = '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"/></svg>';
const SVG_ALERT = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>';
const SVG_EXTERNAL = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>';
const SVG_REFRESH = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>';
const SVG_FOLDER = '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>';
const SVG_ARROW = '<svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>';
const SVG_DETAIL_X = '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';
const SVG_DETAIL_ALERT = '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>';

const STEP_SVG: Record<StepState, string> = {
  done: SVG_CHECK,
  failed: SVG_X,
  waiting: SVG_CLOCK,
  neutral: SVG_MINUS,
};

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
  renderPRList(snapshots, settings.projects, settings.jiraDomainDefault);
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
    <div class="merged-header">
      <div class="merged-label">
        <div class="merged-icon">${SVG_CHECK}</div>
        Recently merged
      </div>
      <span class="count-pill">${recentMerged.length}</span>
    </div>
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
              <span class="m-num">#${record.pullRequestId}</span>
              <span class="m-title">${esc(record.title)}</span>
              <span class="m-ago">${esc(formatAgo(record.lastSeenAt))}</span>
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
    renderMergeCelebrationBar(`Nice merge! PR #${unseenMerged[0].pullRequestId} just landed.`);
    return;
  }

  renderMergeCelebrationBar(`Great momentum — ${unseenMerged.length} PRs merged since your last view.`);
}

function renderMergeCelebrationBar(message?: string): void {
  const bar = $("merge-celebration-bar");
  if (!message) {
    bar.style.display = "none";
    bar.innerHTML = "";
    return;
  }

  bar.innerHTML = `${SVG_CHECK} ${esc(message)}`;
  bar.style.display = "flex";
}

async function refreshBadgeIcon(): Promise<void> {
  await new Promise<void>((resolve) => {
    chrome.runtime.sendMessage({ type: "refresh-badge" }, () => resolve());
  });
}

function renderPRList(
  snapshots: PRSnapshot[],
  projects: ProjectConfig[],
  jiraDomainDefault?: string,
): void {
  const container = $("pr-list");
  const projectJiraDomains = new Map<string, string>();
  for (const project of projects) {
    if (project.jiraDomain) {
      projectJiraDomains.set(buildProjectKey(project.organization, project.project), project.jiraDomain);
    }
  }

  const sorted = [...snapshots].sort((a, b) => {
    const aAttn = needsAttention(a) ? 0 : 1;
    const bAttn = needsAttention(b) ? 0 : 1;
    if (aAttn !== bAttn) return aAttn - bAttn;
    return new Date(b.creationDate).getTime() - new Date(a.creationDate).getTime();
  });

  container.innerHTML = sorted.map((pr) => renderPRItem(pr, projectJiraDomains, jiraDomainDefault)).join("");

  container.querySelectorAll(".pr-card").forEach((el) => {
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

  container.querySelectorAll(".jira-reminder-link").forEach((el) => {
    el.addEventListener("click", (event) => {
      event.stopPropagation();
    });
  });
}

function renderPRItem(
  pr: PRSnapshot,
  projectJiraDomains: Map<string, string>,
  jiraDomainDefault?: string,
): string {
  const url = prUrl(pr.organization, pr.project, pr.repositoryName, pr.pullRequestId);
  const model = toViewModel(pr);
  const jiraReminder = getJiraReminder(pr, projectJiraDomains, jiraDomainDefault);
  const branch = shortenRef(pr.sourceRefName);
  const target = shortenRef(pr.targetRefName);
  const triageLabel = model.triage === "ready" ? "Ready" : model.triage === "blocked" ? "Blocked" : model.triage === "draft" ? "Draft" : "Waiting";

  const primaryBtnClass = model.triage === "blocked" ? "danger" : "primary";
  const secondaryAction =
    model.primaryActionLabel === "Open PR"
      ? `<button class="pr-action-btn" data-action="refresh">${SVG_REFRESH} Refresh</button>`
      : `<button class="pr-action-btn" data-action="open" data-url="${esc(url)}" data-hint="Opening PR...">${SVG_EXTERNAL} Open PR</button>`;

  const pipelineHtml = model.pipeline
    .map((step) => {
      const shortLabel = step.label === "Mergeability" ? "Merge" : step.label;
      return `<div class="pi ${step.state}" aria-label="${esc(step.ariaLabel)}">${STEP_SVG[step.state]} ${shortLabel}</div>`;
    })
    .join("");

  const detailsHtml =
    model.details.length > 0
      ? `<div class="pr-details">${model.details.map((detail) => `<div class="detail-item">${SVG_DETAIL_ALERT} ${esc(detail)}</div>`).join("")}</div>`
      : "";

  const jiraHtml = jiraReminder
    ? `<div class="jira-reminder">
        ${SVG_ALERT}
        <div class="jira-reminder-body">
          <span class="jira-reminder-label">Jira Reminder</span>
          ${
            jiraReminder.url
              ? `<a class="jira-reminder-link" href="${esc(jiraReminder.url)}" target="_blank" rel="noopener noreferrer">Update ${esc(jiraReminder.ticketKey)} status</a>`
              : `<span class="jira-reminder-text">Update ${esc(jiraReminder.ticketKey)} status (configure Jira domain in settings)</span>`
          }
        </div>
      </div>`
    : "";

  return `
    <div class="pr-card" data-url="${esc(url)}" role="button" tabindex="0" aria-label="Open pull request ${pr.pullRequestId}">
      <div class="pr-accent ${model.triage}"></div>
      <div class="pr-body">
        <div class="pr-top">
          <div class="pr-title" title="${esc(pr.title)}">${esc(pr.title)}</div>
          <span class="triage-badge ${model.triage}" aria-label="${esc(`${triageLabel}: ${model.actionLine}`)}">${triageLabel}</span>
        </div>
        <div class="pr-meta">
          <span class="num">#${pr.pullRequestId}</span>
          <span class="sep">&middot;</span>
          <span class="author">${esc(pr.createdByName)}</span>
          <span class="sep">&middot;</span>
          <span class="branch">${esc(branch)} ${SVG_ARROW} ${esc(target)}</span>
        </div>
        <div class="pipeline-row">${pipelineHtml}</div>
        <div class="pr-action-line">
          <span class="status-dot ${model.triage}"></span>
          ${esc(model.actionLine)}
        </div>
        ${jiraHtml}
        ${detailsHtml}
        <div class="pr-project">${SVG_FOLDER} ${esc(pr.organization)}/${esc(pr.project)}/${esc(pr.repositoryName)}</div>
        <div class="pr-actions">
          <button class="pr-action-btn ${primaryBtnClass}" data-action="open" data-url="${esc(url)}" data-hint="${esc(model.primaryActionHint)}" aria-label="${esc(model.primaryActionLabel)}">${model.triage === "blocked" ? SVG_ALERT : SVG_EXTERNAL} ${esc(model.primaryActionLabel)}</button>
          ${secondaryAction}
        </div>
      </div>
    </div>
  `;
}

function getJiraReminder(
  pr: PRSnapshot,
  projectJiraDomains: Map<string, string>,
  jiraDomainDefault?: string,
): { ticketKey: string; url?: string } | null {
  const ticketKey = extractJiraTicketKey(pr.title);
  if (!ticketKey) return null;

  const jiraDomain =
    projectJiraDomains.get(buildProjectKey(pr.organization, pr.project)) ??
    jiraDomainDefault;
  if (!jiraDomain) {
    return { ticketKey };
  }
  return {
    ticketKey,
    url: `https://${jiraDomain}.atlassian.net/browse/${ticketKey}`,
  };
}

function extractJiraTicketKey(title: string): string | null {
  return title.match(JIRA_KEY_RE)?.[1] ?? null;
}

function buildProjectKey(organization: string, project: string): string {
  return `${organization.toLowerCase()}::${project.toLowerCase()}`;
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

$<HTMLButtonElement>("refresh-btn").addEventListener("click", () => {
  void pollNow();
});

$<HTMLButtonElement>("settings-btn").addEventListener("click", () => {
  void chrome.runtime.openOptionsPage();
});

const openOptionsBtn = document.getElementById("open-options");
if (openOptionsBtn) {
  openOptionsBtn.addEventListener("click", () => {
    void chrome.runtime.openOptionsPage();
  });
}

void render();
