import type { PRSnapshot } from "../types/state.js";
import { getSettings } from "../utils/storage.js";
import { getSnapshots, getLastPollTimestamp } from "../utils/storage.js";
import { prUrl } from "../utils/url-builder.js";

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

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
}

function renderPRItem(pr: PRSnapshot): string {
  const url = prUrl(pr.organization, pr.project, pr.repositoryName, pr.pullRequestId);
  const statusClass = getStatusBarClass(pr);
  const badges = getBadges(pr);
  const branch = shortenRef(pr.sourceRefName);
  const target = shortenRef(pr.targetRefName);

  return `
    <div class="pr-item" data-url="${esc(url)}">
      <div class="pr-status-bar ${statusClass}"></div>
      <div class="pr-content">
        <div class="pr-title" title="${esc(pr.title)}">${esc(pr.title)}</div>
        <div class="pr-meta">
          #${pr.pullRequestId} &middot; ${esc(pr.createdByName)} &middot; ${esc(branch)} &rarr; ${esc(target)}
        </div>
        <div class="pr-project">${esc(pr.organization)}/${esc(pr.project)}/${esc(pr.repositoryName)}</div>
        ${badges.length > 0 ? `<div class="pr-badges">${badges.join("")}</div>` : ""}
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

function getBadges(pr: PRSnapshot): string[] {
  const badges: string[] = [];

  if (pr.isDraft) badges.push(`<span class="badge draft">Draft</span>`);
  if (pr.mergeStatus === "conflicts") badges.push(`<span class="badge conflict">Conflicts</span>`);

  // Reviewer votes
  const votes = Object.values(pr.reviewerVotes);
  const approved = votes.filter((v) => v === 10).length;
  const rejected = votes.filter((v) => v === -10).length;
  const waiting = votes.filter((v) => v === -5).length;

  if (rejected > 0) badges.push(`<span class="badge rejected">${rejected} Rejected</span>`);
  if (waiting > 0) badges.push(`<span class="badge waiting">${waiting} Waiting</span>`);
  if (approved > 0) badges.push(`<span class="badge approved">${approved} Approved</span>`);

  // Pipeline status
  const checks = Object.values(pr.statusChecks);
  const failed = checks.filter((s) => s === "failed" || s === "error").length;
  const passed = checks.filter((s) => s === "succeeded").length;
  const pending = checks.filter((s) => s === "pending").length;

  if (failed > 0) badges.push(`<span class="badge pipeline-fail">${failed} Failed</span>`);
  if (pending > 0) badges.push(`<span class="badge pipeline-pending">${pending} Pending</span>`);
  if (passed > 0 && failed === 0 && pending === 0)
    badges.push(`<span class="badge pipeline-ok">Checks OK</span>`);

  return badges;
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
  $("refresh-btn").classList.add("refreshing");
  chrome.runtime.sendMessage({ type: "poll-now" }, () => {
    $("refresh-btn").classList.remove("refreshing");
    void render();
  });
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
