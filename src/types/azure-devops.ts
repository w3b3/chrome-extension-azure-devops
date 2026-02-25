/** Azure DevOps API list response wrapper */
export interface ApiListResponse<T> {
  count: number;
  value: T[];
}

/** Pull request status */
export type PullRequestStatus = "active" | "completed" | "abandoned" | "all";

/** Merge status of a pull request */
export type PullRequestMergeStatus =
  | "conflicts"
  | "failure"
  | "notSet"
  | "queued"
  | "rejectedByPolicy"
  | "succeeded";

/** Reviewer vote values */
export type ReviewerVote = -10 | -5 | 0 | 5 | 10;

export interface IdentityRef {
  id: string;
  displayName: string;
  uniqueName: string;
  imageUrl?: string;
}

export interface ReviewerWithVote extends IdentityRef {
  vote: ReviewerVote;
  isRequired?: boolean;
}

export interface GitCommitRef {
  commitId: string;
}

export interface GitPullRequest {
  pullRequestId: number;
  title: string;
  description?: string;
  status: PullRequestStatus;
  createdBy: IdentityRef;
  creationDate: string;
  repository: {
    id: string;
    name: string;
    project: {
      id: string;
      name: string;
    };
  };
  sourceRefName: string;
  targetRefName: string;
  mergeStatus?: PullRequestMergeStatus;
  isDraft: boolean;
  reviewers: ReviewerWithVote[];
  lastMergeSourceCommit?: GitCommitRef;
  lastMergeTargetCommit?: GitCommitRef;
  lastMergeCommit?: GitCommitRef;
  url: string;
}

/** Pipeline / status check on a PR */
export interface GitPullRequestStatus {
  id: number;
  state: "error" | "failed" | "notApplicable" | "notSet" | "pending" | "succeeded";
  description?: string;
  context: {
    name: string;
    genre?: string;
  };
  targetUrl?: string;
  creationDate: string;
  updatedDate?: string;
}

/** Connection data response for identity discovery */
export interface ConnectionData {
  authenticatedUser: {
    id: string;
    descriptor: string;
    subjectDescriptor: string;
    providerDisplayName: string;
    properties?: Record<string, unknown>;
  };
}
