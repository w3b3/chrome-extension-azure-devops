import type { ApiListResponse, GitPullRequest } from "../types/azure-devops.js";
import { apiGet, type ApiClientOptions } from "./client.js";

interface FetchPRsOptions extends ApiClientOptions {
  project: string;
  userId: string;
}

interface FetchPRByIdOptions extends ApiClientOptions {
  project: string;
  repositoryName: string;
  pullRequestId: number;
}

/** Fetch active PRs where the user is the creator */
async function fetchCreatedPRs(options: FetchPRsOptions): Promise<GitPullRequest[]> {
  const path =
    `${options.project}/_apis/git/pullrequests` +
    `?searchCriteria.status=active` +
    `&searchCriteria.creatorId=${options.userId}`;
  const response = await apiGet<ApiListResponse<GitPullRequest>>(options, path);
  return response.value;
}

/** Fetch active PRs where the user is a reviewer */
async function fetchReviewingPRs(options: FetchPRsOptions): Promise<GitPullRequest[]> {
  const path =
    `${options.project}/_apis/git/pullrequests` +
    `?searchCriteria.status=active` +
    `&searchCriteria.reviewerId=${options.userId}`;
  const response = await apiGet<ApiListResponse<GitPullRequest>>(options, path);
  return response.value;
}

/** Fetch all active PRs for the user (created + reviewing), deduplicated */
export async function fetchActivePRs(options: FetchPRsOptions): Promise<GitPullRequest[]> {
  const [created, reviewing] = await Promise.all([
    fetchCreatedPRs(options),
    fetchReviewingPRs(options),
  ]);

  const seen = new Set<number>();
  const result: GitPullRequest[] = [];

  for (const pr of [...created, ...reviewing]) {
    if (!seen.has(pr.pullRequestId)) {
      seen.add(pr.pullRequestId);
      result.push(pr);
    }
  }

  return result;
}

/** Fetch a specific PR by ID (used to verify post-disappearance state) */
export async function fetchPRById(options: FetchPRByIdOptions): Promise<GitPullRequest> {
  const path =
    `${options.project}/_apis/git/repositories/${encodeURIComponent(options.repositoryName)}` +
    `/pullRequests/${options.pullRequestId}`;
  return apiGet<GitPullRequest>(options, path);
}
