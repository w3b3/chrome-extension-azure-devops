import type { PRSnapshot, ChangeEvent } from "../types/state.js";

/**
 * Compare previous and current snapshots to detect meaningful state transitions.
 * Returns a list of ChangeEvents describing what changed.
 */
export function diffSnapshots(
  previous: PRSnapshot[],
  current: PRSnapshot[],
): ChangeEvent[] {
  const prevMap = new Map(previous.map((s) => [s.key, s]));
  const events: ChangeEvent[] = [];

  for (const cur of current) {
    const prev = prevMap.get(cur.key);
    if (!prev) continue; // New PR — no diff to report

    // Pipeline status changes
    detectPipelineChanges(prev, cur, events);

    // New push detection
    if (
      prev.lastMergeSourceCommitId &&
      cur.lastMergeSourceCommitId &&
      prev.lastMergeSourceCommitId !== cur.lastMergeSourceCommitId
    ) {
      events.push({
        type: "new_push",
        severity: "medium",
        prSnapshot: cur,
        description: `New push to PR #${cur.pullRequestId}`,
        details: `Source commit changed in "${cur.title}"`,
      });
    }

    // Reviewer vote changes
    detectVoteChanges(prev, cur, events);

    // Merge conflict detection
    if (prev.mergeStatus !== "conflicts" && cur.mergeStatus === "conflicts") {
      events.push({
        type: "merge_conflict",
        severity: "high",
        prSnapshot: cur,
        description: `Merge conflict in PR #${cur.pullRequestId}`,
        details: `"${cur.title}" now has merge conflicts`,
      });
    }
  }

  return events;
}

function detectPipelineChanges(
  prev: PRSnapshot,
  cur: PRSnapshot,
  events: ChangeEvent[],
): void {
  for (const [context, state] of Object.entries(cur.statusChecks)) {
    const prevState = prev.statusChecks[context];
    if (!prevState) continue;

    if (prevState !== "failed" && prevState !== "error" && (state === "failed" || state === "error")) {
      events.push({
        type: "pipeline_failed",
        severity: "high",
        prSnapshot: cur,
        description: `Pipeline failed on PR #${cur.pullRequestId}`,
        details: `${context} → ${state}`,
      });
    }

    if ((prevState === "failed" || prevState === "error") && state === "succeeded") {
      events.push({
        type: "pipeline_recovered",
        severity: "medium",
        prSnapshot: cur,
        description: `Pipeline recovered on PR #${cur.pullRequestId}`,
        details: `${context} → succeeded`,
      });
    }
  }
}

function detectVoteChanges(
  prev: PRSnapshot,
  cur: PRSnapshot,
  events: ChangeEvent[],
): void {
  for (const [reviewerId, vote] of Object.entries(cur.reviewerVotes)) {
    const prevVote = prev.reviewerVotes[reviewerId];
    if (prevVote === undefined || prevVote === vote) continue;

    const reviewerName = cur.reviewerNames[reviewerId] ?? "A reviewer";
    const voteLabel = formatVote(vote);
    const severity = vote === -10 ? "high" : "medium";

    events.push({
      type: "vote_changed",
      severity,
      prSnapshot: cur,
      description: `Vote changed on PR #${cur.pullRequestId}`,
      details: `${reviewerName}: ${voteLabel}`,
    });
  }
}

function formatVote(vote: number): string {
  switch (vote) {
    case 10:
      return "Approved";
    case 5:
      return "Approved with suggestions";
    case -5:
      return "Waiting for author";
    case -10:
      return "Rejected";
    default:
      return "No vote";
  }
}
