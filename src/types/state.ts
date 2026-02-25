import type { PullRequestMergeStatus, ReviewerVote } from "./azure-devops.js";

/** Snapshot of a single PR at a point in time */
export interface PRSnapshot {
  /** Composite key: org/project/prId */
  key: string;
  organization: string;
  project: string;
  repositoryName: string;
  pullRequestId: number;
  title: string;
  createdByName: string;
  createdByImageUrl?: string;
  creationDate: string;
  sourceRefName: string;
  targetRefName: string;
  isDraft: boolean;
  mergeStatus?: PullRequestMergeStatus;
  /** Commit ID of the latest source push */
  lastMergeSourceCommitId?: string;
  /** Map of reviewer ID → vote */
  reviewerVotes: Record<string, ReviewerVote>;
  /** Map of reviewer ID → display name */
  reviewerNames: Record<string, string>;
  /** Latest status check states: context name → state */
  statusChecks: Record<string, string>;
  /** Whether the current user is the author */
  isAuthor: boolean;
  /** Whether the current user is a reviewer */
  isReviewer: boolean;
  /** Timestamp of last poll that saw this PR */
  lastSeenAt: number;
}

export type ChangeSeverity = "high" | "medium" | "low";

export type ChangeType =
  | "pipeline_failed"
  | "pipeline_recovered"
  | "new_push"
  | "vote_changed"
  | "merge_conflict"
  | "pr_merged";

export interface ChangeEvent {
  type: ChangeType;
  severity: ChangeSeverity;
  prSnapshot: PRSnapshot;
  /** Human-readable description of the change */
  description: string;
  /** Additional details (e.g. which pipeline, which reviewer) */
  details?: string;
}

/** Rolling history of PRs seen by the extension */
export interface SeenPRRecord {
  /** Same composite key as PRSnapshot */
  key: string;
  organization: string;
  project: string;
  repositoryName: string;
  pullRequestId: number;
  title: string;
  /** Last observed lifecycle state */
  lastKnownState: "active" | "merged";
  /** Last time this PR was observed/verified */
  lastSeenAt: number;
}
