import type { PRSnapshot } from "../types/state.js";
import { getSettings } from "../utils/storage.js";
import { getSnapshots, getLastPollTimestamp } from "../utils/storage.js";
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
  text: string;
}

interface PRViewModel {
  triage: TriageState;
  actionLine: string;
  details: string[];
  pipeline: PipelineStep[];
  primaryActionLabel: string;
}

async function render(): Promise<void> {
  const settings = await getSettings();

  if (settings.projects.length === 0) {
    $("no-config").style.display = "block";
    $("pr-list").style.display = "none";
    return;
  }

  $("no-config").style.display = "none";

  const snapshots = await getSnapshots();
  const lastPoll = await getLastPollTimestamp();

  renderTimestamp(lastPoll);

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
      if (url) void chrome.tabs.create({ url });
    });
  });

  container.querySelectorAll(".pr-action-btn").forEach((el) => {
    el.addEventListener("click", (event) => {
      event.stopPropagation();
      const button = el as HTMLButtonElement;
      const action = button.dataset["action"];
      const actionUrl = button.dataset["url"];

      if (action === "open" && actionUrl) {
        void chrome.tabs.create({ url: actionUrl });
      } else if (action === "refresh") {
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
      : `<button class="pr-action-btn" data-action="open" data-url="${esc(url)}">Open PR</button>`;

  return `
    <div class="pr-item" data-url="${esc(url)}">
      <div class="pr-status-bar ${statusClass}"></div>
      <div class="pr-content">
        <div class="pr-top">
          <div class="pr-title" title="${esc(pr.title)}">${esc(pr.title)}</div>
          <span class="triage-badge ${model.triage}">${triageLabel}</span>
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
                    <span class="pipeline-pill ${step.state}">${esc(step.text)}</span>
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
        <div class="pr-actions">
          <button class="pr-action-btn primary" data-action="open" data-url="${esc(url)}">${esc(model.primaryActionLabel)}</button>
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
    actionLine = `Action needed: ${votes.waiting} reviewer${plural(votes.waiting)} waiting for author`;
  } else if (checks.pending > 0) {
    triage = "waiting";
    actionLine = `Waiting on ${checks.pending} running check${plural(checks.pending)}`;
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
        : `${votes.waiting} reviewer${plural(votes.waiting)} waiting`,
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

  return {
    triage,
    actionLine,
    details: details.slice(0, 2),
    pipeline,
    primaryActionLabel,
  };
}

function toCheckStep(checks: CheckCounts): PipelineStep {
  if (checks.failed > 0) return { label: "Checks", state: "failed", text: "Failed" };
  if (checks.pending > 0) return { label: "Checks", state: "waiting", text: "Running" };
  if (checks.total > 0 && checks.passed === checks.total)
    return { label: "Checks", state: "done", text: "Passed" };
  return { label: "Checks", state: "neutral", text: "No checks" };
}

function toReviewStep(votes: VoteCounts, isAuthor: boolean): PipelineStep {
  if (votes.rejected > 0) return { label: "Reviews", state: "failed", text: "Changes requested" };
  if (votes.waiting > 0) {
    return {
      label: "Reviews",
      state: "waiting",
      text: isAuthor ? `${votes.waiting} waiting for author` : `${votes.waiting} waiting`,
    };
  }
  if (votes.approved > 0) return { label: "Reviews", state: "done", text: "Approved" };
  return { label: "Reviews", state: "neutral", text: "No votes" };
}

function toMergeStep(pr: PRSnapshot): PipelineStep {
  if (pr.mergeStatus === "conflicts") return { label: "Mergeability", state: "failed", text: "Conflicts" };
  if (pr.mergeStatus === "succeeded") return { label: "Mergeability", state: "done", text: "Clean" };
  return { label: "Mergeability", state: "waiting", text: "Checking" };
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

async function pollNow(): Promise<void> {
  $("refresh-btn").classList.add("refreshing");
  await new Promise<void>((resolve) => {
    chrome.runtime.sendMessage({ type: "poll-now" }, () => resolve());
  });
  $("refresh-btn").classList.remove("refreshing");
  await render();
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
