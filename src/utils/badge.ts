import type { PRSnapshot } from "../types/state.js";

/** Count PRs that need the user's attention */
export function countAttentionNeeded(snapshots: PRSnapshot[]): number {
  return snapshots.filter((s) => {
    // Merge conflicts on user's own PRs
    if (s.isAuthor && s.mergeStatus === "conflicts") return true;
    // Failed pipelines on user's own PRs
    if (s.isAuthor && Object.values(s.statusChecks).some((v) => v === "failed" || v === "error"))
      return true;
    // PRs where user is reviewer and hasn't voted yet
    // (reviewerVotes has an entry for the user with vote 0)
    if (s.isReviewer && !s.isAuthor) return true;
    return false;
  }).length;
}

export async function updateBadge(snapshots: PRSnapshot[]): Promise<void> {
  const attention = countAttentionNeeded(snapshots);
  const total = snapshots.length;

  if (total === 0) {
    await chrome.action.setBadgeText({ text: "" });
    return;
  }

  await chrome.action.setBadgeText({ text: String(total) });

  if (attention > 0) {
    await chrome.action.setBadgeBackgroundColor({ color: "#E53935" }); // red
  } else {
    await chrome.action.setBadgeBackgroundColor({ color: "#43A047" }); // green
  }
}
